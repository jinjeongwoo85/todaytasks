// 하위 할 일 추가 입력 행 — SubtaskList(모달)·SubtaskChips(목록 가로칩) 공용.
// CornerDownRight + 입력칸("하위 할 일 추가") + Plus 버튼. Enter 또는 + 탭으로 onAdd.
import { Plus, CornerDownRight } from 'lucide-react';
import { C } from '../styles/tokens';

export default function SubtaskAddRow({ draft, onDraftChange, onAdd, paddingTop = '8px' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop }}>
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
  );
}
