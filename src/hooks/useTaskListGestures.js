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
// 불변 조건(보존): 좌→우 -1일 / 우→좌 +1일, 롱프레스 450ms, 10px 이동 시 press 취소.
//
// opts: {
//   visibleTasks,   // 현재 보이는(정렬된) 할일 배열 — 드래그 원본 인덱스/재정렬 계산용
//   swipeEnabled,   // 스와이프 허용 여부(예: 날짜뷰 + 시트/선택모드 아님)
//   onToggleSelect, // (id) => void   롱프레스 후 손 뗄 때 다중선택 토글
//   onShiftDate,    // (days) => void 가로 스와이프로 ±1일
//   onReorder,      // (newOrderIds) => void 드래그 정렬 확정
// }
// 반환: { containerRef(callback ref), dragInfo, dropIndex, longPressFiredRef }
import { useState, useRef, useCallback } from 'react';
import { LONG_PRESS_MS, PRESS_MOVE_TOLERANCE, SWIPE_THRESHOLD } from '../styles/tokens';

export function useTaskListGestures(opts) {
  const [dragInfo, setDragInfo] = useState(null);

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

  const cancelPress = () => {
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
  };

  // 컨테이너 안의 data-task-id 노드들을 DOM(=화면) 순서로 측정해 드롭 위치 인덱스 계산.
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

  const commitDrag = (clientY) => {
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
      optsRef.current.onReorder(newOrder);
    }
    setDragInfo(null);
  };

  const onTouchStart = (e) => {
    if (!e.touches || e.touches.length !== 1) { swipeActiveRef.current = false; return; }
    const point = e.touches[0];
    const rowEl = e.target.closest ? e.target.closest('[data-task-id]') : null;
    const id = rowEl ? rowEl.getAttribute('data-task-id') : null;
    swipeStartRef.current = { x: point.clientX, y: point.clientY };
    swipeActiveRef.current = true;
    longPressFiredRef.current = false;
    pressedIdRef.current = null;
    if (id != null) {
      pressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        pressedIdRef.current = id;
      }, LONG_PRESS_MS);
    }
  };

  const onTouchMove = (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    const point = e.touches[0];
    if (dragInfoRef.current) {
      e.preventDefault();
      setDragInfo((prev) => prev ? { ...prev, currentY: point.clientY } : null);
      return;
    }
    const dx = point.clientX - swipeStartRef.current.x;
    const dy = point.clientY - swipeStartRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > PRESS_MOVE_TOLERANCE) cancelPress();
    if (longPressFiredRef.current && pressedIdRef.current && Math.abs(dy) > 5 && Math.abs(dy) > Math.abs(dx)) {
      const idx = optsRef.current.visibleTasks.findIndex((t) => t.id === pressedIdRef.current);
      setDragInfo({ id: pressedIdRef.current, startY: point.clientY, currentY: point.clientY, originalIndex: idx });
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
      if (point) commitDrag(point.clientY);
      return;
    }
    // 롱프레스 후 손 뗌 → 다중선택 토글 (스와이프와 배타)
    if (longPressFiredRef.current && pressedIdRef.current) {
      optsRef.current.onToggleSelect(pressedIdRef.current);
      // longPressFiredRef는 일부러 true로 둔다 → 롱프레스 직후 합성되는 click을
      // handleTextClick이 무시(소비)하게 함. 다음 touchstart에서 false로 리셋됨.
      // (이걸 여기서 false로 만들면 뒤따르는 click이 선택을 다시 토글해 해제됨)
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
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, []);

  const dropIndex = dragInfo ? computeDropIndex(dragInfo.currentY) : -1;

  return { containerRef, dragInfo, dropIndex, longPressFiredRef };
}
