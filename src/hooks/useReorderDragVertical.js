// 하위할일 롱프레스 → 세로 드래그 정렬 hook (세로 전용 — 단일축 clientY 중점 비교).
// 가로 칩 배치(목록화면)는 useReorderDragHorizontal 별도 훅 사용.
// 상위 할일 드래그(useTaskListGestures)와 같은 느낌: 드래그 항목이 손가락을 따라 떠오르고(offsetY)
// 다른 항목이 실시간으로 밀린다. 컨테이너 단일 native 리스너(passive:false)로 구동해
//   - 드래그 중 e.preventDefault()로 브라우저 풀투리프레시/스크롤 차단
//   - stopPropagation으로 부모(메인 리스트) 제스처와 격리
// 측정은 변형 안 되는 바깥 래퍼(data-subtask-id)로만 → 시각 이동이 판정에 영향 없음.
//
// 사용법:
//   const drag = useReorderDragVertical(items, onReorder);
//   <div ref={drag.containerRef} style={{ touchAction: 'pan-y' }}>
//     {items.map((s,i)=>(
//       <div data-subtask-id={s.id}>          // 측정 래퍼(변형 X)
//         <div style={transform...}>...행...</div>  // 시각 래퍼(들어올림/밀림)
//   drag.longPressFiredRef 로 롱프레스 직후 합성 click(글자 탭 등) 억제.
import { useState, useRef, useCallback } from 'react';
import { LONG_PRESS_MS, PRESS_MOVE_TOLERANCE } from '../styles/tokens';

export function useReorderDragVertical(items, onReorder) {
  const [dragInfo, setDragInfo] = useState(null); // { id, originalIndex, height, startY, currentY, offsetY }

  const optsRef = useRef({ items, onReorder });
  optsRef.current = { items, onReorder };
  const dragInfoRef = useRef(dragInfo);
  dragInfoRef.current = dragInfo;

  const longPressFiredRef = useRef(false);
  const pressTimerRef = useRef(null);
  const pressedIdRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });
  const containerElRef = useRef(null);
  const cleanupRef = useRef(null);

  const cancelPress = () => {
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
  };
  const vibrate = (ms) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) { try { navigator.vibrate(ms); } catch {} }
  };

  const findRow = (id) => {
    const el = containerElRef.current;
    if (!el) return null;
    const nodes = el.querySelectorAll('[data-subtask-id]');
    for (let i = 0; i < nodes.length; i++) if (nodes[i].getAttribute('data-subtask-id') === id) return nodes[i];
    return null;
  };

  // 바깥 래퍼(변형 안 됨) 실측으로 드롭 인덱스 계산.
  const computeDropIndex = (clientY) => {
    const el = containerElRef.current;
    if (!el) return 0;
    const nodes = el.querySelectorAll('[data-subtask-id]');
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
    const { items: vis, onReorder: cb } = optsRef.current;
    const fromIdx = di.originalIndex;
    const toIdx = computeDropIndex(clientY);
    if (cb && fromIdx !== toIdx && toIdx !== fromIdx + 1) {
      const newIds = vis.map((s) => s.id);
      const [moved] = newIds.splice(fromIdx, 1);
      newIds.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, moved);
      cb(newIds, moved); // moved = 이동한 하위할일 id
    }
    setDragInfo(null);
  };

  const onTouchStart = (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    if (!optsRef.current.onReorder) return; // 모달 등 정렬 비활성 시 드래그 안 함
    const point = e.touches[0];
    const rowEl = e.target.closest ? e.target.closest('[data-subtask-id]') : null;
    const id = rowEl ? rowEl.getAttribute('data-subtask-id') : null;
    startRef.current = { x: point.clientX, y: point.clientY };
    longPressFiredRef.current = false;
    pressedIdRef.current = null;
    if (id != null) {
      e.stopPropagation();
      pressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        pressedIdRef.current = id;
        vibrate(15);
      }, LONG_PRESS_MS);
    }
  };

  const onTouchMove = (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    const point = e.touches[0];
    if (dragInfoRef.current) {
      e.preventDefault();
      e.stopPropagation();
      setDragInfo((prev) => prev ? { ...prev, currentY: point.clientY, offsetY: point.clientY - prev.startY } : null);
      return;
    }
    const dx = point.clientX - startRef.current.x;
    const dy = point.clientY - startRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > PRESS_MOVE_TOLERANCE) cancelPress();
    // 롱프레스가 걸린 뒤 세로로 움직이기 시작하면 드래그 시작
    if (longPressFiredRef.current && pressedIdRef.current && Math.abs(dy) > 5 && Math.abs(dy) > Math.abs(dx)) {
      const id = pressedIdRef.current;
      const idx = optsRef.current.items.findIndex((s) => s.id === id);
      const node = findRow(id);
      const height = node ? Math.round(node.getBoundingClientRect().height) : 36;
      e.preventDefault();
      e.stopPropagation();
      setDragInfo({ id, originalIndex: idx, height, startY: point.clientY, currentY: point.clientY, offsetY: 0 });
      pressedIdRef.current = null;
    }
  };

  const onTouchEnd = (e) => {
    cancelPress();
    if (dragInfoRef.current) {
      const point = e.changedTouches && e.changedTouches[0];
      commitDrag(point ? point.clientY : 0);
      e.stopPropagation();
    }
    // longPressFiredRef는 일부러 두어 직후 합성 click(글자 탭)을 SubtaskList가 무시하게 함.
    // 다음 touchstart에서 false로 리셋됨.
  };

  const handlersRef = useRef({});
  handlersRef.current = { start: onTouchStart, move: onTouchMove, end: onTouchEnd };

  const containerRef = useCallback((el) => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    containerElRef.current = el;
    if (!el) return;
    const onStart = (ev) => handlersRef.current.start(ev);
    const onMove = (ev) => handlersRef.current.move(ev);
    const onEnd = (ev) => handlersRef.current.end(ev);
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

  return {
    containerRef,
    dragInfo,
    dropIndex,
    longPressFiredRef,
    isDragging: (id) => !!dragInfo && dragInfo.id === id,
  };
}
