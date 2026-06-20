// 하위 할 일 — 가로 칩 배치 (목록화면 전용). 줄바꿈(flex-wrap)으로 넘침 처리.
//  - 칩 본체 탭 = 완료 토글, 칩 안 ✕ = 삭제 (제목 수정은 상세 모달에서만).
//  - 롱프레스 후 드래그 = 실시간 재배치(useReorderDragHorizontal). 잡은 칩은 손가락을 따라다니는
//    floating 사본이 되고, 원래 자리엔 빈자리(placeholder)가 남으며, 나머지 칩이 즉시(스냅) 비켜준다.
//    (슬라이드 애니메이션은 의도적으로 없음 — 측정 race로 칩이 튀던 버그를 원천 차단.)
import { X } from 'lucide-react';
import { C, Z } from '../styles/tokens';
import { useReorderDragHorizontal } from '../hooks/useReorderDragHorizontal';
import SubtaskAddRow from './SubtaskAddRow';
import Checkbox from './Checkbox';

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

  return (
    <div>
      <div
        ref={drag.containerRef}
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', touchAction: 'pan-y' }}
      >
        {ordered.map((s) => {
          const isDragged = s.id === draggingId;
          // 잡은 칩도 항상 <Chip>을 렌더(요소 교체 금지) → 같은 DOM 노드가 유지되어
          // touchstart로 묶인 터치 캡처가 끊기지 않음(touchmove/touchend 계속 전달).
          // 바깥 래퍼는 칩이 fixed로 빠진 자리를 잡는 빈자리(gap) 역할.
          const wrapperStyle = isDragged
            ? { width: drag.drag.w, height: drag.drag.h, borderRadius: '999px', border: `1px dashed ${C.border}`, boxSizing: 'border-box' }
            : undefined;
          const chipStyle = isDragged
            ? {
                position: 'fixed', left: drag.drag.fx, top: drag.drag.fy, width: drag.drag.w,
                zIndex: Z.sheet, transform: 'scale(1.05)', transformOrigin: 'center',
                boxShadow: '0 8px 22px rgba(35,35,35,0.22)', boxSizing: 'border-box',
              }
            : undefined;
          return (
            <div key={s.id} data-subtask-id={s.id} style={wrapperStyle}>
              <Chip s={s} onClick={() => handleChipClick(s)} onRemove={() => onRemove(s.id)} dragging={isDragged} style={chipStyle} />
            </div>
          );
        })}
      </div>

      <SubtaskAddRow draft={draft} onDraftChange={onDraftChange} onAdd={onAdd} />
    </div>
  );
}

// 칩 본체 — 동그라미(완료 표시) + 텍스트 + ✕. dragging이면 ✕ 숨김 + style(floating) 머지.
function Chip({ s, onClick, onRemove, dragging, style }) {
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
        ...style,
      }}
    >
      <Checkbox done={s.done} size={16} checkSize={10} />
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
