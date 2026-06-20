// 하위할일 가로 칩 롱프레스 → 2D 드래그 정렬 hook (가로 wrap 전용).
// 세로 버전(useReorderDragVertical)과 같은 패턴이되, 줄바꿈(flex-wrap)되는 칩을 다루므로
// 단일축이 아니라 2D로 동작한다:
//   - 잡은 칩이 손가락을 x·y 모두 따라 떠오름(offsetX/offsetY)
//   - 드롭 위치는 칩들의 실측 사각형을 읽기순서(좌→우, 윗줄→아랫줄)로 훑어 계산
// 컨테이너 단일 native 리스너(passive:false)로 구동:
//   - 드래그 중 e.preventDefault()로 풀투리프레시/스크롤 차단
//   - stopPropagation으로 부모(메인 리스트) 제스처와 격리
// 측정 기준은 변형 안 되는 바깥 래퍼(data-subtask-id) → 시각 이동이 판정에 영향 없음.
//
// 사용법:
//   const drag = useReorderDragHorizontal(items, onReorder);
//   <div ref={drag.containerRef} style={{ display:'flex', flexWrap:'wrap', touchAction:'pan-y' }}>
//     {items.map((s)=>(
//       <div data-subtask-id={s.id}>             // 측정 래퍼(변형 X)
//         <div style={transform...}>...칩...</div> // 시각 래퍼(들어올림)
//   drag.longPressFiredRef 로 롱프레스 직후 합성 click(칩 탭 토글) 억제.
import { useState, useRef, useCallback } from 'react';
import { LONG_PRESS_MS, PRESS_MOVE_TOLERANCE } from '../styles/tokens';

export function useReorderDragHorizontal(items, onReorder) {
  const [dragInfo, setDragInfo] = useState(null); // { id, originalIndex, startX, startY, offsetX, offsetY, currentX, currentY }

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

  // 읽기순서(좌→우, 윗줄→아랫줄) 2D 히트테스트로 드롭 인덱스 계산.
  // 포인터보다 "뒤"에 오는 첫 칩 = 아래 줄에 있거나, 같은 줄에서 포인터 오른쪽인 첫 칩.
  const computeDropIndex = (px, py) => {
    const el = containerElRef.current;
    if (!el) return 0;
    const nodes = el.querySelectorAll('[data-subtask-id]');
    for (let i = 0; i < nodes.length; i++) {
      const rect = nodes[i].getBoundingClientRect();
      const afterPointer = py < rect.bottom && px < rect.left + rect.width / 2;
      if (afterPointer) return i;
    }
    return nodes.length;
  };

  const commitDrag = (px, py) => {
    const di = dragInfoRef.current;
    if (!di) { setDragInfo(null); return; }
    const { items: vis, onReorder: cb } = optsRef.current;
    const fromIdx = di.originalIndex;
    const toIdx = computeDropIndex(px, py);
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
    if (!optsRef.current.onReorder) return; // 정렬 비활성 시 드래그 안 함
    const point = e.touches[0];
    const chipEl = e.target.closest ? e.target.closest('[data-subtask-id]') : null;
    const id = chipEl ? chipEl.getAttribute('data-subtask-id') : null;
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
      setDragInfo((prev) => prev
        ? { ...prev, currentX: point.clientX, currentY: point.clientY, offsetX: point.clientX - prev.startX, offsetY: point.clientY - prev.startY }
        : null);
      return;
    }
    const dx = point.clientX - startRef.current.x;
    const dy = point.clientY - startRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // 롱프레스 전 손가락이 움직이면(스크롤 의도) 롱프레스 취소
    if (!longPressFiredRef.current) {
      if (dist > PRESS_MOVE_TOLERANCE) cancelPress();
      return;
    }
    // 롱프레스 발동 후: 방향 무관 약간만 움직여도 드래그 시작
    if (pressedIdRef.current && dist > 5) {
      const id = pressedIdRef.current;
      const idx = optsRef.current.items.findIndex((s) => s.id === id);
      e.preventDefault();
      e.stopPropagation();
      setDragInfo({ id, originalIndex: idx, startX: point.clientX, startY: point.clientY, currentX: point.clientX, currentY: point.clientY, offsetX: 0, offsetY: 0 });
      pressedIdRef.current = null;
    }
  };

  const onTouchEnd = (e) => {
    cancelPress();
    if (dragInfoRef.current) {
      const point = e.changedTouches && e.changedTouches[0];
      commitDrag(point ? point.clientX : 0, point ? point.clientY : 0);
      e.stopPropagation();
    }
    // longPressFiredRef는 일부러 두어 직후 합성 click(칩 탭)을 SubtaskChips가 무시하게 함.
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

  const dropIndex = dragInfo ? computeDropIndex(dragInfo.currentX, dragInfo.currentY) : -1;

  return {
    containerRef,
    dragInfo,
    dropIndex,
    longPressFiredRef,
    isDragging: (id) => !!dragInfo && dragInfo.id === id,
  };
}
