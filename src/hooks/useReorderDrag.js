// 롱프레스 → 세로 드래그 정렬 hook. SubtaskList에서 쓰던 로직을 그대로 추출(동작 동일).
// 단일 리스트 안에서 React 터치 props로 구동되며(경쟁하는 native 리스너 없음), 그래서
// 메인 리스트의 버그 A(이중 경로)와 무관하다. 재사용·정리 목적의 추출.
//
// 사용법:
//   const drag = useReorderDrag(items, onReorder);
//   <div ref={drag.setRowRef(item.id)} {...drag.handlers(item.id, idx)} style={{opacity: drag.isDragging(item.id)?0.4:1}}>
//   drag.dropIndex 로 드롭 위치 라인 표시.
import { useState, useRef } from 'react';
import { LONG_PRESS_MS, PRESS_MOVE_TOLERANCE } from '../styles/tokens';

export function useReorderDrag(items, onReorder) {
  const [drag, setDrag] = useState(null); // { id, startY, currentY, originalIndex }
  const rowRefs = useRef({});
  const timer = useRef(null);
  const longFired = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const setRowRef = (id) => (el) => { rowRefs.current[id] = el; };

  const computeDrop = (clientY) => {
    let idx = items.length;
    for (let i = 0; i < items.length; i++) {
      const el = rowRefs.current[items[i].id];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) { idx = i; break; }
    }
    return idx;
  };

  const commit = (clientY) => {
    if (!drag) return;
    const from = drag.originalIndex;
    const to = computeDrop(clientY);
    if (from !== to && to !== from + 1 && onReorder) {
      const newIds = items.map((s) => s.id);
      const [moved] = newIds.splice(from, 1);
      newIds.splice(to > from ? to - 1 : to, 0, moved);
      onReorder(newIds, moved); // moved = 이동한 항목 id
    }
    setDrag(null);
  };

  const cancel = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };

  const start = (id, idx, e) => {
    longFired.current = false;
    const pt = e.touches ? e.touches[0] : e;
    startPos.current = { x: pt.clientX, y: pt.clientY };
    timer.current = setTimeout(() => {
      longFired.current = true;
      setDrag({ id, startY: pt.clientY, currentY: pt.clientY, originalIndex: idx });
    }, LONG_PRESS_MS);
  };

  const move = (e) => {
    const pt = e.touches ? e.touches[0] : e;
    const dx = pt.clientX - startPos.current.x;
    const dy = pt.clientY - startPos.current.y;
    if (!drag && Math.sqrt(dx * dx + dy * dy) > PRESS_MOVE_TOLERANCE) cancel();
    if (drag) { e.preventDefault(); setDrag((prev) => prev ? { ...prev, currentY: pt.clientY } : null); }
  };

  const end = (e) => {
    cancel();
    if (drag) {
      const pt = e.changedTouches ? e.changedTouches[0] : e;
      commit(pt.clientY);
    }
  };

  const dropIndex = drag ? computeDrop(drag.currentY) : -1;

  return {
    dropIndex,
    isDragging: (id) => !!drag && drag.id === id,
    setRowRef,
    handlers: (id, idx) => ({
      onTouchStart: (e) => start(id, idx, e),
      onTouchMove: move,
      onTouchEnd: end,
    }),
  };
}
