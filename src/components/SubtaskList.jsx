// 하위 할 일 목록 — 완료토글 / 제목편집 / 삭제 / 추가 + 롱프레스 세로 드래그 정렬(useReorderDrag).
// 드래그: 상위 할일처럼 잡은 항목이 떠올라(offsetY) 손가락을 따라오고 다른 항목이 실시간으로 밀린다.
//   - 측정은 바깥 래퍼(data-subtask-id, 변형 X), 시각 이동은 안쪽 래퍼 transform만.
// 탭: 앞 동그라미 = 완료 토글, 글자(뒷부분) = 제목 인라인 편집(롱프레스 직후 탭은 무시).
import { useState } from 'react';
import { Plus, Check, X, CornerDownRight } from 'lucide-react';
import { C } from '../styles/tokens';
import { useReorderDrag } from '../hooks/useReorderDrag';

export default function SubtaskList({ subtasks, onToggle, onRemove, onUpdate, draft, onDraftChange, onAdd, compact, onReorder }) {
  const drag = useReorderDrag(subtasks, onReorder);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const startEdit = (s) => {
    // 롱프레스 직후 따라오는 click은 무시(드래그/선택과 탭 충돌 방지)
    if (drag.longPressFiredRef.current) { drag.longPressFiredRef.current = false; return; }
    if (!onUpdate) { onToggle(s.id); return; } // 편집 핸들러 없으면 기존처럼 토글
    setEditingId(s.id);
    setEditText(s.text);
  };

  const commitEdit = (s) => {
    const t = editText.trim();
    if (t && t !== s.text) onUpdate(s.id, t);
    setEditingId(null);
    setEditText('');
  };

  const anyDragging = !!drag.dragInfo;

  return (
    <div>
      <div ref={drag.containerRef} style={{ touchAction: 'pan-y' }}>
        {subtasks.map((s, i) => {
          const isDragging = anyDragging && drag.dragInfo.id === s.id;
          let shift = 0;
          if (anyDragging && !isDragging && drag.dropIndex >= 0) {
            const from = drag.dragInfo.originalIndex;
            const to = drag.dropIndex;
            if (from < i && i < to) shift = -drag.dragInfo.height;
            else if (to <= i && i < from) shift = drag.dragInfo.height;
          }
          const innerStyle = isDragging
            ? {
                position: 'relative', zIndex: 8,
                transform: `translateY(${drag.dragInfo.offsetY}px) scale(1.03)`,
                transition: 'none',
                boxShadow: '0 8px 22px rgba(35,35,35,0.20)',
                background: C.surface, borderRadius: '10px',
              }
            : {
                position: 'relative', zIndex: shift ? 1 : 'auto',
                transform: shift ? `translateY(${shift}px)` : 'none',
                transition: anyDragging ? 'transform 0.18s ease' : 'none',
              };
          const editing = editingId === s.id;
          return (
            <div key={s.id} data-subtask-id={s.id}>
              <div style={innerStyle}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: compact ? '5px 6px' : '6px 6px',
                    margin: '0 -6px',
                    opacity: isDragging ? 0.96 : 1,
                    WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none',
                  }}
                >
                  <button
                    onClick={() => onToggle(s.id)}
                    style={{
                      width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                      border: `1.5px solid ${s.done ? C.sage : C.mute}`,
                      background: s.done ? C.sage : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                    }}
                    aria-label={s.done ? '완료 취소' : '완료로 표시'}
                  >
                    <Check size={11} color={C.inkInv} style={{ opacity: s.done ? 1 : 0 }} />
                  </button>

                  {editing ? (
                    <input
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(s); else if (e.key === 'Escape') { setEditingId(null); setEditText(''); } }}
                      onBlur={() => commitEdit(s)}
                      onTouchStart={(e) => e.stopPropagation()}
                      style={{
                        flex: 1, border: 'none', borderBottom: `1px solid ${C.sage}`, background: 'transparent',
                        outline: 'none', fontSize: compact ? '13px' : '14px', color: C.ink,
                        padding: '1px 0', fontFamily: 'inherit', WebkitUserSelect: 'text', userSelect: 'text',
                      }}
                    />
                  ) : (
                    <span
                      onClick={() => startEdit(s)}
                      style={{ flex: 1, fontSize: compact ? '13px' : '14px', color: s.done ? C.mute : C.ink, textDecoration: s.done ? 'line-through' : 'none', cursor: 'pointer' }}
                    >
                      {s.text}
                    </span>
                  )}

                  <button onClick={() => onRemove(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, padding: '2px' }} aria-label="하위 할 일 삭제">
                    <X size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '6px' }}>
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
