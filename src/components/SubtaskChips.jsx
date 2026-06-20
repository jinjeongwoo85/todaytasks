// 하위 할 일 — 가로 칩 배치 (목록화면 전용). 줄바꿈(flex-wrap)으로 넘침 처리.
//  - 칩 본체 탭 = 완료 토글, 칩 안 ✕ = 삭제 (제목 수정은 상세 모달에서만).
//  - 롱프레스 후 드래그 = 가로 2D 순서 변경(useReorderDragHorizontal). 잡은 칩이 떠오르고
//    드롭 위치에 세로 삽입 막대를 표시한다.
//  - 측정 래퍼(data-subtask-id, 변형 X) / 시각 래퍼(transform) 2겹 — 세로 버전과 동일 패턴.
import { Plus, Check, X, CornerDownRight } from 'lucide-react';
import { C } from '../styles/tokens';
import { useReorderDragHorizontal } from '../hooks/useReorderDragHorizontal';

export default function SubtaskChips({ subtasks, onToggle, onRemove, draft, onDraftChange, onAdd, onReorder }) {
  const drag = useReorderDragHorizontal(subtasks, onReorder);

  const handleChipClick = (s) => {
    // 롱프레스 직후 따라오는 click은 무시(드래그와 탭 충돌 방지)
    if (drag.longPressFiredRef.current) { drag.longPressFiredRef.current = false; return; }
    onToggle(s.id);
  };

  // 드롭 막대 표시 여부 — 제자리(no-op) 위치엔 숨김.
  const dropActive = !!drag.dragInfo && drag.dropIndex >= 0;
  const from = drag.dragInfo ? drag.dragInfo.originalIndex : -1;
  const noop = dropActive && (drag.dropIndex === from || drag.dropIndex === from + 1);
  const barAt = (i) => dropActive && !noop && drag.dropIndex === i;

  const Bar = () => (
    <div style={{ alignSelf: 'center', width: '3px', height: '22px', borderRadius: '2px', background: C.sage, margin: '0 1px' }} />
  );

  return (
    <div>
      <div
        ref={drag.containerRef}
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', touchAction: 'pan-y' }}
      >
        {subtasks.map((s, i) => {
          const isDragging = drag.isDragging(s.id);
          const innerStyle = isDragging
            ? {
                position: 'relative', zIndex: 8,
                transform: `translate(${drag.dragInfo.offsetX}px, ${drag.dragInfo.offsetY}px) scale(1.05)`,
                transition: 'none',
                boxShadow: '0 8px 22px rgba(35,35,35,0.20)',
                borderRadius: '999px',
              }
            : { position: 'relative' };
          return (
            <div key={s.id} style={{ display: 'contents' }}>
              {barAt(i) && <Bar />}
              <div data-subtask-id={s.id}>
                <div style={innerStyle}>
                  <div
                    onClick={() => handleChipClick(s)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '4px 7px 4px 6px', borderRadius: '999px',
                      border: `1px solid ${s.done ? C.todayBg : C.border}`,
                      background: s.done ? C.todayBg : C.surface,
                      cursor: 'pointer',
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
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemove(s.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, padding: 0, display: 'flex', alignItems: 'center' }}
                      aria-label="하위 할 일 삭제"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {barAt(subtasks.length) && <Bar />}
      </div>

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
