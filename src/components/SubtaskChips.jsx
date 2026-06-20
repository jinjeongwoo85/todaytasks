// 하위 할 일 — 가로 칩 배치 (목록화면 전용). 줄바꿈(flex-wrap)으로 넘침 처리.
//  - 칩 본체 탭 = 완료 토글, 칩 안 ✕ = 삭제 (제목 수정은 상세 모달에서만).
//  - 롱프레스 후 드래그 = 실시간 재배치(useReorderDragHorizontal). 잡은 칩은 손가락을 따라다니는
//    floating 사본이 되고, 원래 자리엔 빈자리(placeholder)가 남으며, 나머지 칩이 FLIP로 비켜준다.
import { useRef, useLayoutEffect } from 'react';
import { Plus, Check, X, CornerDownRight } from 'lucide-react';
import { C, Z } from '../styles/tokens';
import { useReorderDragHorizontal } from '../hooks/useReorderDragHorizontal';

export default function SubtaskChips({ subtasks, onToggle, onRemove, draft, onDraftChange, onAdd, onReorder }) {
  const drag = useReorderDragHorizontal(subtasks, onReorder);

  const handleChipClick = (s) => {
    // 롱프레스 직후 따라오는 click은 무시(드래그와 탭 충돌 방지)
    if (drag.longPressFiredRef.current) { drag.longPressFiredRef.current = false; return; }
    onToggle(s.id);
  };

  // 드래그 중엔 displayOrder 순서로, 평소엔 subtasks 순서로 렌더
  const byId = {};
  for (const s of subtasks) byId[s.id] = s;
  const ordered = (drag.displayOrder.length > 0 ? drag.displayOrder.map((id) => byId[id]).filter(Boolean) : subtasks);

  const draggingId = drag.drag ? drag.drag.dragId : null;
  const draggingSub = draggingId ? byId[draggingId] : null;

  // FLIP — displayOrder 변경 시 칩이 새 자리로 부드럽게 미끄러지도록.
  const nodesRef = useRef(new Map()); // id -> DOM 노드(측정 래퍼)
  const prevRectsRef = useRef(new Map());
  useLayoutEffect(() => {
    if (!draggingId) { prevRectsRef.current = new Map(); return; }
    const last = new Map();
    nodesRef.current.forEach((node, id) => {
      if (node) last.set(id, node.getBoundingClientRect());
    });
    last.forEach((lr, id) => {
      if (id === draggingId) return; // 잡은 칩(placeholder)은 스냅
      const fr = prevRectsRef.current.get(id);
      if (!fr) return;
      const dx = fr.left - lr.left;
      const dy = fr.top - lr.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      const node = nodesRef.current.get(id);
      if (!node) return;
      node.style.transition = 'none';
      node.style.transform = `translate(${dx}px, ${dy}px)`;
      // 다음 프레임에 0으로 → 새 자리로 슬라이드
      requestAnimationFrame(() => {
        node.style.transition = 'transform 0.18s ease';
        node.style.transform = '';
      });
    });
    prevRectsRef.current = last;
  });

  return (
    <div>
      <div
        ref={drag.containerRef}
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', touchAction: 'pan-y' }}
      >
        {ordered.map((s) => {
          const isDragged = s.id === draggingId;
          return (
            <div
              key={s.id}
              data-subtask-id={s.id}
              ref={(el) => { if (el) nodesRef.current.set(s.id, el); else nodesRef.current.delete(s.id); }}
            >
              {isDragged ? (
                // 빈자리(placeholder) — floating 사본이 떠 있는 동안 자리만 차지
                <div style={{ width: drag.drag.w, height: drag.drag.h, borderRadius: '999px', border: `1px dashed ${C.border}`, background: 'transparent', boxSizing: 'border-box' }} />
              ) : (
                <Chip s={s} onClick={() => handleChipClick(s)} onRemove={() => onRemove(s.id)} />
              )}
            </div>
          );
        })}
      </div>

      {/* 손가락을 따라다니는 floating 사본 */}
      {draggingSub && (
        <div
          style={{
            position: 'fixed', left: drag.drag.fx, top: drag.drag.fy, width: drag.drag.w,
            zIndex: Z.sheet, pointerEvents: 'none',
            transform: 'scale(1.05)', transformOrigin: 'center',
            boxShadow: '0 8px 22px rgba(35,35,35,0.22)', borderRadius: '999px',
          }}
        >
          <Chip s={draggingSub} dragging />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '8px' }}>
        <CornerDownRight size={14} color={C.faint} />
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }}
          placeholder="하위 할 일 추가"
          style={{ flex: 1, border: 'none', borderBottom: `1px dotted ${C.border}`, background: 'transparent', outline: 'none', fontSize: '13px', color: C.ink, padding: '2px 0', fontFamily: 'inherit' }}
        />
        <button onClick={onAdd} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.sage, padding: '2px' }} aria-label="하위 할 일 추가">
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}

// 칩 본체 — 동그라미(완료 표시) + 텍스트 + ✕. dragging이면 ✕ 숨김.
function Chip({ s, onClick, onRemove, dragging }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '4px 7px 4px 6px', borderRadius: '999px',
        border: `1px solid ${s.done ? C.todayBg : C.border}`,
        background: s.done ? C.todayBg : C.surface,
        cursor: dragging ? 'grabbing' : 'pointer',
        WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none',
      }}
    >
      <span
        style={{
          width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
          border: `1.5px solid ${s.done ? C.sage : C.mute}`,
          background: s.done ? C.sage : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Check size={10} color={C.inkInv} style={{ opacity: s.done ? 1 : 0 }} />
      </span>
      <span style={{ fontSize: '13px', color: s.done ? C.mute : C.ink, textDecoration: s.done ? 'line-through' : 'none', whiteSpace: 'nowrap' }}>
        {s.text}
      </span>
      {!dragging && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, padding: 0, display: 'flex', alignItems: 'center' }}
          aria-label="하위 할 일 삭제"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
