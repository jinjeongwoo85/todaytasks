// 하위할일 가로 칩 롱프레스 → 실시간 재배치 드래그 hook (가로 wrap 전용).
// 잡은 칩은 손가락을 따라다니는 떠 있는 사본(floating)이 되고, 원래 자리에는 같은 크기의
// 빈자리(placeholder)가 남는다. 손가락이 움직이면 displayOrder(렌더 순서)를 실시간 재배치해
// 나머지 칩이 자리를 비켜준다(컴포넌트가 FLIP로 부드럽게 미끄러뜨림). 놓으면 그 순서로 확정.
//
// 위치 판정은 드래그 시작 시 1회 캐시한 원래 칩 좌표(startRectsRef)를 기준으로 한다
//   → 칩이 reflow돼도 판정 기준이 흔들리지 않아 oscillation(깜빡임) 없음.
//
// 컨테이너 단일 native 리스너(passive:false)로 구동:
//   - 드래그 중 preventDefault(풀투리프레시/스크롤 차단) + stopPropagation(부모 리스트 제스처 격리).
// drag.longPressFiredRef 로 롱프레스 직후 합성 click(칩 탭 토글) 억제.
import { useState, useRef, useCallback } from 'react';
import { LONG_PRESS_MS, PRESS_MOVE_TOLERANCE } from '../styles/tokens';

const sameOrder = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

export function useReorderDragHorizontal(items, onReorder) {
  // drag: null | { dragId, originalIndex, w, h, fx, fy } (fx/fy = floating 사본의 viewport 좌상단)
  const [drag, setDrag] = useState(null);
  const [displayOrder, setDisplayOrder] = useState([]); // 드래그 중 렌더 순서(id 배열)

  const optsRef = useRef({ items, onReorder });
  optsRef.current = { items, onReorder };
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const displayOrderRef = useRef(displayOrder);
  displayOrderRef.current = displayOrder;

  const longPressFiredRef = useRef(false);
  const pressTimerRef = useRef(null);
  const pressedIdRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });
  const grabRef = useRef({ dx: 0, dy: 0 }); // 손가락이 잡은 칩 내부의 오프셋
  const startRectsRef = useRef([]);          // 드래그 시작 시점 모든 칩의 좌표(판정 기준)
  const containerElRef = useRef(null);
  const cleanupRef = useRef(null);

  const cancelPress = () => {
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
  };
  const vibrate = (ms) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) { try { navigator.vibrate(ms); } catch {} }
  };

  const measureChips = () => {
    const el = containerElRef.current;
    if (!el) return [];
    const nodes = el.querySelectorAll('[data-subtask-id]');
    const out = [];
    for (let i = 0; i < nodes.length; i++) {
      const id = nodes[i].getAttribute('data-subtask-id');
      const r = nodes[i].getBoundingClientRect();
      out.push({ id, left: r.left, top: r.top, width: r.width, height: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 });
    }
    return out;
  };

  // 원래 좌표(startRectsRef) 기준 읽기순서 2D 판정으로, dragId를 끼울 위치의 displayOrder 계산.
  const computeOrder = (px, py) => {
    const { items: list } = optsRef.current;
    const di = dragRef.current;
    if (!di) return list.map((s) => s.id);
    const rest = startRectsRef.current.filter((r) => r.id !== di.dragId); // 잡은 칩 제외, 원래 순서
    const rowTol = (di.h || 28) * 0.6;
    let ins = rest.length;
    for (let i = 0; i < rest.length; i++) {
      const r = rest[i];
      const after = (py < r.cy - rowTol) || (Math.abs(py - r.cy) <= rowTol && px < r.cx);
      if (after) { ins = i; break; }
    }
    const restIds = list.map((s) => s.id).filter((id) => id !== di.dragId);
    return [...restIds.slice(0, ins), di.dragId, ...restIds.slice(ins)];
  };

  const onTouchStart = (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    if (!optsRef.current.onReorder) return;
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

  const startDrag = (id, point) => {
    const rects = measureChips();
    const mine = rects.find((r) => r.id === id);
    if (!mine) return false;
    startRectsRef.current = rects;
    grabRef.current = { dx: point.clientX - mine.left, dy: point.clientY - mine.top };
    const originalIndex = optsRef.current.items.findIndex((s) => s.id === id);
    const order = optsRef.current.items.map((s) => s.id);
    setDisplayOrder(order);
    setDrag({ dragId: id, originalIndex, w: mine.width, h: mine.height, fx: mine.left, fy: mine.top });
    return true;
  };

  const onTouchMove = (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    const point = e.touches[0];
    if (dragRef.current) {
      e.preventDefault();
      e.stopPropagation();
      const fx = point.clientX - grabRef.current.dx;
      const fy = point.clientY - grabRef.current.dy;
      setDrag((prev) => prev ? { ...prev, fx, fy } : prev);
      const next = computeOrder(point.clientX, point.clientY);
      if (!sameOrder(next, displayOrderRef.current)) setDisplayOrder(next);
      return;
    }
    const dx = point.clientX - startRef.current.x;
    const dy = point.clientY - startRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (!longPressFiredRef.current) {
      if (dist > PRESS_MOVE_TOLERANCE) cancelPress();
      return;
    }
    if (pressedIdRef.current && dist > 4) {
      e.preventDefault();
      e.stopPropagation();
      const id = pressedIdRef.current;
      pressedIdRef.current = null;
      startDrag(id, point);
    }
  };

  const endDrag = () => {
    const di = dragRef.current;
    if (di) {
      const { items: list, onReorder: cb } = optsRef.current;
      const order = displayOrderRef.current;
      const orig = list.map((s) => s.id);
      if (cb && !sameOrder(order, orig)) cb(order, di.dragId);
    }
    setDrag(null);
    setDisplayOrder([]);
    startRectsRef.current = [];
  };

  const onTouchEnd = (e) => {
    cancelPress();
    if (dragRef.current) {
      e.stopPropagation();
      endDrag();
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
    el.addEventListener('touchcancel', onEnd);
    cleanupRef.current = () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return {
    containerRef,
    drag,            // { dragId, w, h, fx, fy } | null
    displayOrder,    // 드래그 중 렌더 순서(id) — 비어있으면 평소 순서 사용
    longPressFiredRef,
  };
}
