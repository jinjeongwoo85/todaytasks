// 메인 할 일 리스트의 터치 제스처를 단일 native 리스너 경로로 통합 — 버그 A(좌우 스와이프) 근본 대응.
//
// 기존 문제: 같은 터치 스트림을 두 경로가 동시에 처리했다.
//   1) 컨테이너 native 리스너(스와이프), 2) 각 할일 행의 React 터치 props(롱프레스/드래그).
// 두 경로가 서로 간섭 → 스와이프가 씹히거나 오작동. 또 컨테이너에 touch-action이 없어
// 브라우저 기본 제스처가 먼저 개입했다.
//
// 대응:
//   - 모든 터치 처리를 이 hook의 컨테이너 native 리스너 한 경로로 통합.
//   - 눌린 행은 e.target.closest('[data-task-id]')로 식별(행에서 React 터치 props 제거).
//   - 컨테이너에 touch-action: pan-y 부여(세로 스크롤=브라우저, 가로=앱)는 호출부에서 지정.
//
// 드래그 UX(라이브 정렬): 드래그 중인 행은 손가락을 따라 떠오르고(offsetY), 다른 행들은
// 드롭 위치에 맞춰 실시간으로 밀려난다(TaskList가 dropIndex·height로 계산). 화면 가장자리에
// 닿으면 자동 스크롤. 롱프레스 진입 순간 햅틱 진동. 드롭 후 짧은 안착 애니메이션(settlingId).
//
// 핵심 안정성: 드롭 위치 판정(computeDropIndex)은 "변형되지 않는 바깥 래퍼(data-task-id)"의
// 실측 위치로만 한다. 밀려나는 효과는 래퍼 안쪽 transform으로만 주므로 측정이 흔들리지 않는다.
//
// 불변 조건(보존): 좌→우 -1일 / 우→좌 +1일, 롱프레스 450ms, 10px 이동 시 press 취소.
//
// opts: { visibleTasks, swipeEnabled, onToggleSelect, onShiftDate, onReorder }
// 반환: { containerRef, dragInfo, dropIndex, settlingId, longPressFiredRef }
//   dragInfo = { id, startY, currentY, originalIndex, height, offsetY }
import { useState, useRef, useCallback } from 'react';
import { LONG_PRESS_MS, PRESS_MOVE_TOLERANCE, SWIPE_THRESHOLD } from '../styles/tokens';

const EDGE = 75;        // 화면 위/아래 이 안에 들어오면 자동 스크롤
const AUTOSCROLL_MAX = 12;

export function useTaskListGestures(opts) {
  const [dragInfo, setDragInfo] = useState(null);
  const [settlingId, setSettlingId] = useState(null);

  // 최신 opts/dragInfo를 ref로 노출 → 단 한 번 등록되는 native 리스너가 항상 최신 값을 읽음(stale 방지)
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const dragInfoRef = useRef(dragInfo);
  dragInfoRef.current = dragInfo;

  const longPressFiredRef = useRef(false); // 롱프레스 직후의 click을 호출부가 무시할 수 있게 노출
  const pressTimerRef = useRef(null);
  const pressedIdRef = useRef(null);
  const swipeStartRef = useRef({ x: 0, y: 0 });
  const swipeActiveRef = useRef(false);
  const containerElRef = useRef(null);
  const cleanupRef = useRef(null);

  // 드래그 보조 상태
  const rafRef = useRef(0);
  const lastPointYRef = useRef(0);
  const scrollAccumRef = useRef(0); // 드래그 중 자동스크롤로 이동한 누적량(떠있는 카드 보정)
  const settleTimerRef = useRef(null);

  const cancelPress = () => {
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
  };

  const vibrate = (ms) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) { try { navigator.vibrate(ms); } catch {} }
  };

  const findRow = (id) => {
    const el = containerElRef.current;
    if (!el) return null;
    const nodes = el.querySelectorAll('[data-task-id]');
    for (let i = 0; i < nodes.length; i++) if (nodes[i].getAttribute('data-task-id') === id) return nodes[i];
    return null;
  };

  // 바깥 래퍼(절대 transform 안 됨)의 실측 위치로 드롭 인덱스 계산 → 측정이 흔들리지 않음.
  const computeDropIndex = (clientY) => {
    const el = containerElRef.current;
    if (!el) return 0;
    const nodes = el.querySelectorAll('[data-task-id]');
    let idx = nodes.length;
    for (let i = 0; i < nodes.length; i++) {
      const rect = nodes[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) { idx = i; break; }
    }
    return idx;
  };

  // ── 자동 스크롤 ─────────────────────────────────────────────
  const stopAutoScroll = () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; } };
  const autoScrollTick = () => {
    rafRef.current = 0;
    if (!dragInfoRef.current) return;
    const y = lastPointYRef.current;
    const h = window.innerHeight;
    let step = 0;
    if (y < EDGE) step = -Math.ceil(AUTOSCROLL_MAX * (EDGE - y) / EDGE);
    else if (y > h - EDGE) step = Math.ceil(AUTOSCROLL_MAX * (y - (h - EDGE)) / EDGE);
    if (step) {
      const before = window.scrollY;
      window.scrollBy(0, step);
      const actual = window.scrollY - before; // 끝에 닿으면 0
      if (actual) {
        scrollAccumRef.current += actual;
        setDragInfo((prev) => prev ? { ...prev, offsetY: prev.currentY - prev.startY + scrollAccumRef.current } : null);
      }
    }
    rafRef.current = requestAnimationFrame(autoScrollTick);
  };
  const startAutoScroll = () => { if (!rafRef.current) rafRef.current = requestAnimationFrame(autoScrollTick); };

  const commitDrag = (clientY) => {
    stopAutoScroll();
    const di = dragInfoRef.current;
    if (!di) return;
    const vis = optsRef.current.visibleTasks;
    const fromIdx = di.originalIndex;
    const toIdx = computeDropIndex(clientY);
    if (fromIdx !== toIdx && toIdx !== fromIdx + 1) {
      const newOrder = vis.map((t) => t.id);
      const [moved] = newOrder.splice(fromIdx, 1);
      const insertAt = toIdx > fromIdx ? toIdx - 1 : toIdx;
      newOrder.splice(insertAt, 0, moved);
      optsRef.current.onReorder(newOrder, moved); // moved = 이동한 할일 id

    }
    setDragInfo(null);
    // 드롭 후 짧은 안착 애니메이션(.settle): 위치는 즉시 확정되고 scale/그림자만 가라앉음.
    setSettlingId(di.id);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => setSettlingId(null), 220);
  };

  const onTouchStart = (e) => {
    if (!e.touches || e.touches.length !== 1) { swipeActiveRef.current = false; return; }
    const point = e.touches[0];
    // 하위 할일 영역(자체 드래그 정렬 보유)에서 시작된 터치는 부모 행 누름으로 보지 않는다.
    const inSubtasks = e.target.closest && e.target.closest('[data-list-subtasks]');
    const rowEl = !inSubtasks && e.target.closest ? e.target.closest('[data-task-id]') : null;
    const id = rowEl ? rowEl.getAttribute('data-task-id') : null;
    swipeStartRef.current = { x: point.clientX, y: point.clientY };
    swipeActiveRef.current = true;
    longPressFiredRef.current = false;
    pressedIdRef.current = null;
    if (id != null) {
      pressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        pressedIdRef.current = id;
        vibrate(15); // 길게 눌러 선택/드래그 모드 진입 — 햅틱 피드백
      }, LONG_PRESS_MS);
    }
  };

  const onTouchMove = (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    const point = e.touches[0];
    if (dragInfoRef.current) {
      e.preventDefault();
      lastPointYRef.current = point.clientY;
      setDragInfo((prev) => prev ? { ...prev, currentY: point.clientY, offsetY: point.clientY - prev.startY + scrollAccumRef.current } : null);
      return;
    }
    // 롱프레스가 걸린 순간부터(드래그 시작 직전 몇 px 포함) 브라우저 overscroll(pull-to-refresh)을
    // 차단 → "길게 누른 뒤 아래로 드래그" 시 새로고침이 끼어드는 충돌 방지. 평상시(롱프레스 전)
    // 세로 스크롤·풀투리프레시는 그대로(이 가드가 안 걸림).
    if (longPressFiredRef.current) e.preventDefault();
    const dx = point.clientX - swipeStartRef.current.x;
    const dy = point.clientY - swipeStartRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > PRESS_MOVE_TOLERANCE) cancelPress();
    if (longPressFiredRef.current && pressedIdRef.current && Math.abs(dy) > 5 && Math.abs(dy) > Math.abs(dx)) {
      const id = pressedIdRef.current;
      const idx = optsRef.current.visibleTasks.findIndex((t) => t.id === id);
      const node = findRow(id);
      // 카드 전체(헤더+펼친 하위 패널) 높이로 측정 → 펼친 할일을 끌면 다른 행이 그 높이만큼 밀려 가림 없음.
      // node(data-task-id)의 첫 자식 = shift 래퍼(헤더+펼침 패널, divider 제외).
      const innerEl = node ? node.firstElementChild : null;
      const height = innerEl ? Math.round(innerEl.getBoundingClientRect().height) : 56;
      scrollAccumRef.current = 0;
      lastPointYRef.current = point.clientY;
      setDragInfo({ id, startY: point.clientY, currentY: point.clientY, originalIndex: idx, height, offsetY: 0 });
      startAutoScroll();
      pressedIdRef.current = null;
      return;
    }
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > PRESS_MOVE_TOLERANCE) {
      e.preventDefault();
    }
  };

  const onTouchEnd = (e) => {
    cancelPress();
    if (dragInfoRef.current) {
      const point = e.changedTouches && e.changedTouches[0];
      commitDrag(point ? point.clientY : lastPointYRef.current);
      return;
    }
    // 롱프레스 후 손 뗌 → 다중선택 토글 (스와이프와 배타)
    if (longPressFiredRef.current && pressedIdRef.current) {
      optsRef.current.onToggleSelect(pressedIdRef.current);
      // longPressFiredRef는 일부러 true로 둔다 → 롱프레스 직후 합성되는 click을
      // handleTextClick이 무시(소비)하게 함. 다음 touchstart에서 false로 리셋됨.
      pressedIdRef.current = null;
      swipeActiveRef.current = false;
      return;
    }
    if (!swipeActiveRef.current) return;
    swipeActiveRef.current = false;
    if (!optsRef.current.swipeEnabled) return;
    const point = e.changedTouches && e.changedTouches[0];
    if (!point) return;
    const dx = point.clientX - swipeStartRef.current.x;
    const dy = point.clientY - swipeStartRef.current.y;
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
      optsRef.current.onShiftDate(dx < 0 ? 1 : -1);
    }
  };

  // 최신 핸들러를 ref에 담아, 한 번만 등록되는 native 리스너가 이를 호출(콜백 ref 패턴).
  const handlersRef = useRef({});
  handlersRef.current = { start: onTouchStart, move: onTouchMove, end: onTouchEnd };

  const containerRef = useCallback((el) => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    containerElRef.current = el;
    if (!el) return;
    const onStart = (e) => handlersRef.current.start(e);
    const onMove = (e) => handlersRef.current.move(e);
    const onEnd = (e) => handlersRef.current.end(e);
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    cleanupRef.current = () => {
      stopAutoScroll();
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, []);

  const dropIndex = dragInfo ? computeDropIndex(dragInfo.currentY) : -1;

  return { containerRef, dragInfo, dropIndex, settlingId, longPressFiredRef };
}
