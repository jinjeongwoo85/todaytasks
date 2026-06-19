// 원형 시계 다이얼 시각 선택 팝업.
// 오전/오후 토글 + 12시간 다이얼(12 위, 1~11) → '시' 고르면 곧바로 '분' 단계(5분 단위).
// 저장은 24시간 'HH:mm'. 숫자는 Inter 폰트(점 없는 0).
import { useState } from 'react';
import { C } from '../styles/tokens';

const TAU = Math.PI * 2;
const pad = (x) => String(x).padStart(2, '0');
const NUM_FONT = 'Inter, system-ui, sans-serif';

// 시계 위 idx번째(0=12시 방향, 시계방향) 좌표
const nodePos = (cx, cy, r, idx, n = 12) => {
  const a = (idx / n) * TAU - Math.PI / 2;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

export default function ClockTimePicker({ value, onConfirm, onClose }) {
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '');
  const h24 = valid ? parseInt(value.slice(0, 2), 10) : 9;
  const [ampm, setAmpm] = useState(h24 < 12 ? 'AM' : 'PM');
  const [dispH, setDispH] = useState(h24 % 12 === 0 ? 12 : h24 % 12); // 12시간 표시값(1~12)
  const [m, setM] = useState(valid ? (Math.round(parseInt(value.slice(3), 10) / 5) * 5) % 60 : 0);
  const [stage, setStage] = useState('hour');

  const cx = 130, cy = 130, R = 104;
  const to24 = (dh, ap) => (dh % 12) + (ap === 'PM' ? 12 : 0);

  const pickHour = (dh) => { setDispH(dh); setStage('minute'); }; // 시 고르면 곧바로 분 단계로
  const pickMin = (mm) => setM(mm);

  const handEnd = stage === 'hour' ? nodePos(cx, cy, R, dispH % 12) : nodePos(cx, cy, R, (m / 5) % 12);

  const hourNodes = [];
  for (let i = 0; i < 12; i++) {
    const [x, y] = nodePos(cx, cy, R, i);
    hourNodes.push({ x, y, label: String(i === 0 ? 12 : i), val: i === 0 ? 12 : i });
  }
  const minNodes = [];
  for (let i = 0; i < 12; i++) {
    const [x, y] = nodePos(cx, cy, R, i);
    minNodes.push({ x, y, label: pad(i * 5), val: i * 5 });
  }
  const nodes = stage === 'hour' ? hourNodes : minNodes;

  const ampmBtn = (label, val) => (
    <button
      onClick={() => setAmpm(val)}
      className="mono"
      style={{
        padding: '6px 12px', borderRadius: '999px', cursor: 'pointer', fontSize: '13px',
        border: `1px solid ${ampm === val ? C.sage : C.border}`,
        background: ampm === val ? C.sage : 'transparent',
        color: ampm === val ? C.inkInv : C.label,
      }}
    >{label}</button>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(35,35,35,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sans"
        style={{ background: C.surface, borderRadius: '18px', padding: '16px 18px 14px', width: '300px', boxSizing: 'border-box', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          {ampmBtn('오전', 'AM')}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', fontSize: '28px', fontWeight: 600, fontFamily: NUM_FONT }}>
            <span onClick={() => setStage('hour')} style={{ cursor: 'pointer', color: stage === 'hour' ? C.sage : C.ink }}>{dispH}</span>
            <span style={{ color: C.ink }}>:</span>
            <span onClick={() => setStage('minute')} style={{ cursor: 'pointer', color: stage === 'minute' ? C.sage : C.ink }}>{pad(m)}</span>
          </div>
          {ampmBtn('오후', 'PM')}
        </div>

        <svg viewBox="0 0 260 260" style={{ width: '100%', display: 'block' }}>
          <circle cx={cx} cy={cy} r={120} fill={C.raised} />
          <line x1={cx} y1={cy} x2={handEnd[0]} y2={handEnd[1]} stroke={C.sage} strokeWidth="2" />
          <circle cx={cx} cy={cy} r="3.5" fill={C.sage} />
          <circle cx={handEnd[0]} cy={handEnd[1]} r="2.5" fill={C.sage} />
          {nodes.map((nd) => {
            const sel = stage === 'hour' ? nd.val === dispH : nd.val === m;
            return (
              <g key={`${stage}-${nd.val}`} onClick={() => (stage === 'hour' ? pickHour(nd.val) : pickMin(nd.val))} style={{ cursor: 'pointer' }}>
                <circle cx={nd.x} cy={nd.y} r="16" fill={sel ? C.sage : 'transparent'} />
                <text x={nd.x} y={nd.y} textAnchor="middle" dominantBaseline="central" fontSize="14" fontFamily={NUM_FONT} fill={sel ? C.inkInv : C.ink}>{nd.label}</text>
              </g>
            );
          })}
        </svg>

        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
          <button onClick={() => onConfirm(null)} className="mono" style={{ flex: 1, padding: '10px', borderRadius: '999px', border: `1px solid ${C.border}`, background: 'transparent', color: C.label, fontSize: '13px', cursor: 'pointer' }}>종일</button>
          <button onClick={() => onConfirm(`${pad(to24(dispH, ampm))}:${pad(m)}`)} className="mono" style={{ flex: 1, padding: '10px', borderRadius: '999px', border: 'none', background: C.ink, color: C.inkInv, fontSize: '13px', cursor: 'pointer' }}>확인</button>
        </div>
      </div>
    </div>
  );
}
