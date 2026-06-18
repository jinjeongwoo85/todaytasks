// 할 일 행에 표시되는 날짜 칩. tone(배경/전경 색)과 label을 받아 표시, 탭하면 onOpen.
import { C } from '../styles/tokens';

export default function DateChip({ tone, label, onOpen }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onOpen(); }}
      onTouchEnd={(e) => e.stopPropagation()}
      style={{ flexShrink: 0, cursor: 'pointer', position: 'relative' }}
    >
      <span className="mono" style={{ display: 'block', fontSize: '11px', padding: '3px 8px', borderRadius: '999px', background: tone.bg, color: tone.fg, whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  );
}
