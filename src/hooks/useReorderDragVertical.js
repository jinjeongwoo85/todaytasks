// 하위할일 롱프레스 → 세로 드래그 정렬 hook (세로 전용 — 단일축 clientY 중점 비교).
// 가로 칩 배치(목록화면)는 useReorderDragHorizontal 별도 훅 사용.
// 상위 할일 드래그(useTaskListGestures)와 같은 느낌: 드래그 항목이 손가락을 따라 떠오르고(offsetY)
// 다른 항목이 실시간으로 밀린다.
//
// 생명주기/롱프레스 감지/리스너는 usePressDragCore가 담당(stopPropagation으로 부모 리스트와 격리,
// 드래그 중 preventDefault로 풀투리프레시/스크롤 차단은 아래 본체에서). 측정은 변형 안 되는 바깥
// 래퍼(data-subtask-id)로만 → 시각 이동이 판정에 영향 없음. drag.longPressFiredRef 로 롱프레스 직후
// 합성 click(글자 탭 등) 억제. onReorder=null이면 정렬 비활성(모달 등).
import { useState, useRef } from 'react';
import { PRESS_MOVE_TOLERANCE } from '../styles/tokens';
import { usePressDragCore } from './usePressDragCore';
import { computeDropIndex, reorderIds } from '../utils/dragGeometry';

export function useReorderDragVertical(items, onReorder) {
  const [dragInfo, setDragInfo] = useState(null); // { id, originalIndex, height, startY, currentY, offsetY }

  const optsRef = useRef({ items, onReorder });
  optsRef.current = { items, onReorder };
  const dragInfoRef = useRef(dragInfo);
  dragInfoRef.current = dragInfo;

  const core = usePressDragCore({ idAttr: 'data-subtask-id' });

  const findRow = (id) => {
    const el = core.containerElRef.current;
    if (!el) return null;
    const nodes = el.querySelectorAll('[data-subtask-id]');
    for (let i = 0; i < nodes.length; i++) if (nodes[i].getAttribute('data-subtask-id') === id) return nodes[i];
    return null;
  };

  // 바깥 래퍼(변형 안 됨) 실측으로 드롭 인덱스 계산.
  const dropIndexAt = (clientY) => {
    const el = core.containerElRef.current;
    if (!el) return 0;
    const nodes = el.querySelectorAll('[data-subtask-id]');
    const rects = [];
    for (let i = 0; i < nodes.length; i++) rects.push(nodes[i].getBoundingClientRect());
    return computeDropIndex(rects, clientY);
  };

  const commitDrag = (clientY) => {
    const di = dragInfoRef.current;
    if (!di) return;
    const { items: vis, onReorder: cb } = optsRef.current;
    const fromIdx = di.originalIndex;
    const toIdx = dropIndexAt(clientY);
    if (cb && fromIdx !== toIdx && toIdx !== fromIdx + 1) {
      cb(reorderIds(vis.map((s) => s.id), fromIdx, toIdx), di.id); // di.id = 이동한 하위할일 id
    }
    setDragInfo(null);
  };

  const onStart = (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    if (!optsRef.current.onReorder) return; // 정렬 비활성 시 드래그 안 함
    const point = e.touches[0];
    const id = core.resolveId(e);
    core.startRef.current = { x: point.clientX, y: point.clientY };
    core.longPressFiredRef.current = false;
    core.pressedIdRef.current = null;
    if (id != null) {
      e.stopPropagation();
      core.startLongPress(id);
    }
  };

  const onMove = (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    const point = e.touches[0];
    if (dragInfoRef.current) {
      e.preventDefault();
      e.stopPropagation();
      setDragInfo((prev) => prev ? { ...prev, currentY: point.clientY, offsetY: point.clientY - prev.startY } : null);
      return;
    }
    const dx = point.clientX - core.startRef.current.x;
    const dy = point.clientY - core.startRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > PRESS_MOVE_TOLERANCE) core.cancelPress();
    // 롱프레스가 걸린 뒤 세로로 움직이기 시작하면 드래그 시작
    if (core.longPressFiredRef.current && core.pressedIdRef.current && Math.abs(dy) > 5 && Math.abs(dy) > Math.abs(dx)) {
      const id = core.pressedIdRef.current;
      const idx = optsRef.current.items.findIndex((s) => s.id === id);
      const node = findRow(id);
      const height = node ? Math.round(node.getBoundingClientRect().height) : 36;
      e.preventDefault();
      e.stopPropagation();
      setDragInfo({ id, originalIndex: idx, height, startY: point.clientY, currentY: point.clientY, offsetY: 0 });
      core.pressedIdRef.current = null;
    }
  };

  const onEnd = (e) => {
    core.cancelPress();
    if (dragInfoRef.current) {
      const point = e.changedTouches && e.changedTouches[0];
      commitDrag(point ? point.clientY : 0);
      e.stopPropagation();
    }
    // longPressFiredRef는 일부러 두어 직후 합성 click(글자 탭)을 SubtaskList가 무시하게 함.
    // 다음 touchstart에서 false로 리셋됨.
  };

  core.handlersRef.current = { start: onStart, move: onMove, end: onEnd };

  const dropIndex = dragInfo ? dropIndexAt(dragInfo.currentY) : -1;

  return {
    containerRef: core.containerRef,
    dragInfo,
    dropIndex,
    longPressFiredRef: core.longPressFiredRef,
    isDragging: (id) => !!dragInfo && dragInfo.id === id,
  };
}
