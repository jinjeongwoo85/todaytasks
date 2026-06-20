// 진행률 바 — 6px 트랙 + 세이지 채움(progress-fill: width 전환 애니메이션). 헤더·검색 섹션 공용.
import { C } from '../styles/tokens';

export default function ProgressBar({ pct, marginBottom }) {
  return (
    <div style={{ height: '6px', background: C.borderSoft, width: '100%', marginBottom }}>
      <div className="progress-fill" style={{ height: '100%', width: `${pct}%`, background: C.sage }} />
    </div>
  );
}
