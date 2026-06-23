// 터치 제스처 공통 코어(얇은 코어) — 3개 드래그/제스처 훅이 공유하던 보일러플레이트를 모음:
//   - 컨테이너 단일 native 리스너 등록/해제(passive:false) + cleanup + callback-ref 패턴
//   - 롱프레스 타이머(LONG_PRESS_MS) / longPressFiredRef / pressedIdRef / startRef
//   - vibrate / cancelPress / id 해석(closest)
// 드래그 *본체*(세로 offset / 가로 floating-clone / 메인 autoscroll·스와이프)는 각 훅이 보유한다.
// 소비자는 core.handlersRef.current = { start, move, end } 를 매 렌더 지정하고,
// core가 노출한 ref/헬퍼를 onTouch* 본체에서 사용한다(동작은 기존과 동일하게 보존).
import { useRef, useCallback } from 'react';
import { LONG_PRESS_MS } from '../styles/tokens';

// opts: { idAttr, excludeSelector?, listenTouchCancel?, onCleanup? }
//   idAttr           = 측정/식별용 data 속성명 ('data-task-id' | 'data-subtask-id')
//   excludeSelector  = 이 속성 영역에서 시작한 터치는 무시(메인의 'data-list-subtasks')
//   listenTouchCancel= touchcancel도 end로 처리(가로 칩)
//   onCleanup        = 리스너 해제 시 추가 정리(메인의 autoscroll 중단) — ref로 보관해 containerRef 안정
export function usePressDragCore({ idAttr, excludeSelector = null, listenTouchCancel = false, onCleanup = null }) {
  const longPressFiredRef = useRef(false); // 롱프레스 직후 합성 click 억제용(소비자가 노출)
  const pressedIdRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });
  const pressTimerRef = useRef(null);
  const containerElRef = useRef(null);
  const cleanupRef = useRef(null);
  const handlersRef = useRef({}); // { start, move, end } — 소비자가 매 렌더 지정(최신 핸들러)

  const onCleanupRef = useRef(onCleanup);
  onCleanupRef.current = onCleanup;

  const cancelPress = () => {
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
  };
  const vibrate = (ms) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) { try { navigator.vibrate(ms); } catch {} }
  };

  const sel = `[${idAttr}]`;
  // 눌린 요소의 id 해석. excludeSelector 영역 내부면 null(메인: 하위할일 영역 제외).
  const resolveId = (e) => {
    const target = e.target;
    if (!target || !target.closest) return null;
    if (excludeSelector && target.closest(`[${excludeSelector}]`)) return null;
    const el = target.closest(sel);
    return el ? el.getAttribute(idAttr) : null;
  };

  // 롱프레스 타이머 시작 — 만료 시 표준 진입(플래그 set + 햅틱). 3개 훅 공통.
  const startLongPress = (id) => {
    pressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      pressedIdRef.current = id;
      vibrate(15);
    }, LONG_PRESS_MS);
  };

  // 단 한 번만 등록되는 native 리스너가 handlersRef의 최신 핸들러를 호출(stale 방지).
  const containerRef = useCallback((el) => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    containerElRef.current = el;
    if (!el) return;
    const onStart = (ev) => handlersRef.current.start && handlersRef.current.start(ev);
    const onMove = (ev) => handlersRef.current.move && handlersRef.current.move(ev);
    const onEnd = (ev) => handlersRef.current.end && handlersRef.current.end(ev);
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    if (listenTouchCancel) el.addEventListener('touchcancel', onEnd);
    cleanupRef.current = () => {
      if (onCleanupRef.current) onCleanupRef.current();
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      if (listenTouchCancel) el.removeEventListener('touchcancel', onEnd);
    };
  }, [idAttr, excludeSelector, listenTouchCancel]);

  return {
    containerRef, handlersRef, containerElRef,
    longPressFiredRef, pressedIdRef, startRef,
    cancelPress, vibrate, resolveId, startLongPress,
  };
}
