// 하위 할 일 목록 — 토글/삭제/추가 + 롱프레스 세로 드래그 정렬.
// 드래그 로직은 4단계에서 useReorderDrag 훅으로 추출 예정. 여기선 이동 + 토큰화만.
import { useState, useRef } from 'react';
import { Plus, Check, X, CornerDownRight } from 'lucide-react';
import { C, LONG_PRESS_MS, PRESS_MOVE_TOLERANCE } from '../styles/tokens';

export default function SubtaskList({ subtasks, onToggle, onRemove, draft, onDraftChange, onAdd, compact, onReorder }) {
  const [subDrag, setSubDrag] = useState(null);
  const rowRefs = useRef({});

  const startSubDrag = (id, clientY, idx) => {
    setSubDrag({ id, startY: clientY, currentY: clientY, originalIndex: idx });
  };
  const updateSubDrag = (clientY) => {
    setSubDrag((prev) => prev ? { ...prev, currentY: clientY } : null);
  };
  const computeSubDrop = (clientY) => {
    let idx = subtasks.length;
    for (let i = 0; i < subtasks.length; i++) {
      const el = rowRefs.current[subtasks[i].id];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) { idx = i; break; }
    }
    return idx;
  };
  const commitSubDrag = (clientY) => {
    if (!subDrag) return;
    const from = subDrag.originalIndex;
    const to = computeSubDrop(clientY);
    if (from !== to && to !== from + 1 && onReorder) {
      const newIds = subtasks.map((s) => s.id);
      const [moved] = newIds.splice(from, 1);
      newIds.splice(to > from ? to - 1 : to, 0, moved);
      onReorder(newIds);
    }
    setSubDrag(null);
  };

  const subPressTimer = useRef(null);
  const subLongFired = useRef(false);
  const subPressPos = useRef({ x: 0, y: 0 });

  const startSubPress = (id, idx, e) => {
    subLongFired.current = false;
    const pt = e.touches ? e.touches[0] : e;
    subPressPos.current = { x: pt.clientX, y: pt.clientY };
    subPressTimer.current = setTimeout(() => {
      subLongFired.current = true;
      startSubDrag(id, pt.clientY, idx);
    }, LONG_PRESS_MS);
  };
  const cancelSubPress = () => {
    if (subPressTimer.current) { clearTimeout(subPressTimer.current); subPressTimer.current = null; }
  };
  const moveSubPress = (e) => {
    const pt = e.touches ? e.touches[0] : e;
    const dx = pt.clientX - subPressPos.current.x;
    const dy = pt.clientY - subPressPos.current.y;
    if (!subDrag && Math.sqrt(dx * dx + dy * dy) > PRESS_MOVE_TOLERANCE) cancelSubPress();
    if (subDrag) { e.preventDefault(); updateSubDrag(pt.clientY); }
  };
  const endSubPress = (e) => {
    cancelSubPress();
    if (subDrag) {
      const pt = e.changedTouches ? e.changedTouches[0] : e;
      commitSubDrag(pt.clientY);
    }
  };

  const dropIndex = subDrag ? computeSubDrop(subDrag.currentY) : -1;

  return (
    <div>
      {subtasks.map((s, idx) => {
        const isDragging = subDrag && subDrag.id === s.id;
        const showLineAbove = subDrag && dropIndex === idx;
        const showLineBelow = subDrag && dropIndex === subtasks.length && idx === subtasks.length - 1;
        return (
          <div key={s.id} ref={(el) => { rowRefs.current[s.id] = el; }}>
            {showLineAbove && <div style={{ height: '2px', background: C.sage, borderRadius: '1px', margin: '2px 0' }} />}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: compact ? '5px 0' : '6px 0', opacity: isDragging ? 0.4 : 1 }}
              onTouchStart={(e) => startSubPress(s.id, idx, e)}
              onTouchMove={moveSubPress}
              onTouchEnd={endSubPress}
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
