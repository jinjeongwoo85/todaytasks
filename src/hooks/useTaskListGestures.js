// 메인 할 일 리스트의 터치 제스처 — 단일 native 리스너 경로(usePressDragCore)로 통합.
//
// 한 터치 스트림에서 세 동작을 배타적으로 처리한다:
//   - 가로 스와이프(SWIPE_THRESHOLD 이상) → 선택 날짜 ±1일 (좌→우 -1 / 우→좌 +1)
//   - 롱프레스 후 손 뗌 → 다중선택 토글
//   - 롱프레스 후 세로 드래그 → 라이브 정렬(떠오름 + 다른 행 실시간 밀림 + 가장자리 autoscroll)
//
// 생명주기/롱프레스 감지/id해석(하위할일 영역 data-list-subtasks 제외)·vibrate는 코어가 담당.
// autoscroll·overscroll 가드·스와이프·다중선택·드롭 안착(settle)은 메인 고유 로직이라 여기 잔류.
//
// 핵심 안정성: 드롭 위치 판정은 "변형되지 않는 바깥 래퍼(data-task-id)"의 실측 위치로만 한다
// (computeDropIndex). 밀려나는 효과는 래퍼 안쪽 transform으로만 주므로 측정이 흔들리지 않는다.
//
// 불변 조건(보존): 좌→우 -1일 / 우→좌 +1일, 롱프레스 450ms, 10px 이동 시 press 취소.
//
// opts: { visibleTasks, swipeEnabled, onToggleSelect, onShiftDate, onReorder }
// 반환: { containerRef, dragInfo, dropIndex, settlingId, longPressFiredRef }
//   dragInfo = { id, startY, currentY, originalIndex, height, offsetY }
import { useState, useRef } from 'react';
import { PRESS_MOVE_TOLERANCE, SWIPE_THRESHOLD } from '../styles/tokens';
import { usePressDragCore } from './usePressDragCore';
import { computeDropIndex, reorderIds } from '../utils/dragGeometry';

const EDGE = 75;        // 화면 위/아래 이 안에 들어오면 자동 스크롤
const AUTOSCROLL_MAX = 12;

export function useTaskListGestures(opts) {
  const [dragInfo, setDragInfo] = useState(null);
  const [settlingId, setSettlingId] = useState(null);

  // 최신 opts/dragInfo를 ref로 노출 → 한 번 등록되는 native 리스너가 항상 최신 값을 읽음(stale 방지)
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const dragInfoRef = useRef(dragInfo);
  dragInfoRef.current = dragInfo;

  const swipeActiveRef = useRef(false);

  // 드래그 보조 상태(autoscroll)
  const rafRef = useRef(0);
  const lastPointYRef = useRef(0);
  const scrollAccumRef = useRef(0); // 드래그 중 자동스크롤로 이동한 누적량(떠있는 카드 보정)
  const settleTimerRef = useRef(null);

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

  // 컨테이너가 사라질 때 진행 중인 autoscroll도 멈춤(코어 cleanup에서 호출).
  const core = usePressDragCore({
    idAttr: 'data-task-id',
    excludeSelector: 'data-list-subtasks', // 하위할일 영역(자체 드래그 보유) 터치는 부모 누름으로 보지 않음
    onCleanup: stopAutoScroll,
  });

  const findRow = (id) => {
    const el = core.containerElRef.current;
    if (!el) return null;
    const nodes = el.querySelectorAll('[data-task-id]');
    for (let i = 0; i < nodes.length; i++) if (nodes[i].getAttribute('data-task-id') === id) return nodes[i];
    return null;
  };

  // 바깥 래퍼(절대 transform 안 됨)의 실측 위치로 드롭 인덱스 계산 → 측정이 흔들리지 않음.
  const dropIndexAt = (clientY) => {
    const el = core.containerElRef.current;
    if (!el) return 0;
    const nodes = el.querySelectorAll('[data-task-id]');
    const rects = [];
    for (let i = 0; i < nodes.length; i++) rects.push(nodes[i].getBoundingClientRect());
    return computeDropIndex(rects, clientY);
  };

  const commitDrag = (clientY) => {
    stopAutoScroll();
    const di = dragInfoRef.current;
    if (!di) return;
    const vis = optsRef.current.visibleTasks;
    const fromIdx = di.originalIndex;
    const toIdx = dropIndexAt(clientY);
    if (fromIdx !== toIdx && toIdx !== fromIdx + 1) {
      optsRef.current.onReorder(reorderIds(vis.map((t) => t.id), fromIdx, toIdx), di.id); // di.id = 이동한 할일 id
    }
    setDragInfo(null);
    // 드롭 후 짧은 안착 애니메이션(.settle): 위치는 즉시 확정되고 scale/그림자만 가라앉음.
    setSettlingId(di.id);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => setSettlingId(null), 220);
  };

  const onStart = (e) => {
    if (!e.touches || e.touches.length !== 1) { swipeActiveRef.current = false; return; }
    const point = e.touches[0];
    const id = core.resolveId(e);
    core.startRef.current = { x: point.clientX, y: point.clientY };
    swipeActiveRef.current = true;
    core.longPressFiredRef.current = false;
    core.pressedIdRef.current = null;
    if (id != null) core.startLongPress(id);
  };

  const onMove = (e) => {
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
    if (core.longPressFiredRef.current) e.preventDefault();
    const dx = point.clientX - core.startRef.current.x;
    const dy = point.clientY - core.startRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > PRESS_MOVE_TOLERANCE) core.cancelPress();
    if (core.longPressFiredRef.current && core.pressedIdRef.current && Math.abs(dy) > 5 && Math.abs(dy) > Math.abs(dx)) {
      const id = core.pressedIdRef.current;
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
      core.pressedIdRef.current = null;
      return;
    }
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > PRESS_MOVE_TOLERANCE) {
      e.preventDefault();
    }
  };

  const onEnd = (e) => {
    core.cancelPress();
    if (dragInfoRef.current) {
      const point = e.changedTouches && e.changedTouches[0];
      commitDrag(point ? point.clientY : lastPointYRef.current);
      return;
    }
    // 롱프레스 후 손 뗌 → 다중선택 토글 (스와이프와 배타)
    if (core.longPressFiredRef.current && core.pressedIdRef.current) {
      optsRef.current.onToggleSelect(core.pressedIdRef.current);
      // longPressFiredRef는 일부러 true로 둔다 → 롱프레스 직후 합성되는 click을
      // handleTextClick이 무시(소비)하게 함. 다음 touchstart에서 false로 리셋됨.
      core.pressedIdRef.current = null;
      swipeActiveRef.current = false;
      return;
    }
    if (!swipeActiveRef.current) return;
    swipeActiveRef.current = false;
    if (!optsRef.current.swipeEnabled) return;
    const point = e.changedTouches && e.changedTouches[0];
    if (!point) return;
    const dx = point.clientX - core.startRef.current.x;
    const dy = point.clientY - core.startRef.current.y;
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
      optsRef.current.onShiftDate(dx < 0 ? 1 : -1);
    }
  };

  core.handlersRef.current = { start: onStart, move: onMove, end: onEnd };

  const dropIndex = dragInfo ? dropIndexAt(dragInfo.currentY) : -1;

  return { containerRef: core.containerRef, dragInfo, dropIndex, settlingId, longPressFiredRef: core.longPressFiredRef };
}
