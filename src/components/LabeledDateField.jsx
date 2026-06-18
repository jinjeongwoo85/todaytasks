// 모달의 시작/종료 날짜 필드. 라벨 + 날짜 칩(탭하면 onOpen, X로 onClear).
import { X } from 'lucide-react';
import { C } from '../styles/tokens';
import { toneStyle, formatDate } from '../utils/date';

export default function LabeledDateField({ label, iso, onOpen, onClear }) {
  const tone = toneStyle(iso);
  return (
    <div style={{ flex: 1 }}>
      <div className="mono" style={{ fontSize: '10px', color: C.label, marginBottom: '4px' }}>{label}</div>
      <div
        className="mono"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onOpen(); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '13px', padding: '8px', borderRadius: '8px', boxSizing: 'border-box', cursor: 'pointer',
          background: tone.bg, color: iso ? tone.fg : C.mute, border: `1px solid ${iso ? tone.border : C.border}`,
        }}
      >
        <span>{iso ? formatDate(iso) : '설정 안함'}</span>
        {iso && (
          <X size={12} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClear(); }} />
        )}
      </div>
    </div>
  );
}
