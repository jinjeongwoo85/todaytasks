// 하위 할 일 목록 — 토글/삭제/추가 + 롱프레스 세로 드래그 정렬(useReorderDrag).
import { Plus, Check, X, CornerDownRight } from 'lucide-react';
import { C } from '../styles/tokens';
import { useReorderDrag } from '../hooks/useReorderDrag';

export default function SubtaskList({ subtasks, onToggle, onRemove, draft, onDraftChange, onAdd, compact, onReorder }) {
  const drag = useReorderDrag(subtasks, onReorder);

  return (
    <div>
      {subtasks.map((s, idx) => {
        const isDragging = drag.isDragging(s.id);
        const showLineAbove = drag.dropIndex === idx && drag.dropIndex !== -1;
        const showLineBelow = drag.dropIndex === subtasks.length && idx === subtasks.length - 1;
        return (
          <div key={s.id} ref={drag.setRowRef(s.id)}>
            {showLineAbove && <div style={{ height: '2px', background: C.sage, borderRadius: '1px', margin: '2px 0' }} />}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: compact ? '5px 0' : '6px 0', opacity: isDragging ? 0.4 : 1 }}
              {...drag.handlers(s.id, idx)}
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
              <span
                onClick={() => onToggle(s.id)}
                style={{ flex: 1, fontSize: compact ? '13px' : '14px', color: s.done ? C.mute : C.ink, textDecoration: s.done ? 'line-through' : 'none', cursor: 'pointer' }}
              >
                {s.text}
              </span>
              <button onClick={() => onRemove(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, padding: '2px' }} aria-label="하위 할 일 삭제">
                <X size={13} />
              </button>
            </div>
            {showLineBelow && <div style={{ height: '2px', background: C.sage, borderRadius: '1px', margin: '2px 0' }} />}
          </div>
        );
      })}
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
