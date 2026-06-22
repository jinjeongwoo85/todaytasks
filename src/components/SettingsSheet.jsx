// 설정 바텀 시트 — 동기화 / 찾기 / 로그아웃. BottomSheet 래퍼 사용.
import { Search, RefreshCw } from 'lucide-react';
import { C } from '../styles/tokens';
import BottomSheet from './BottomSheet';

export default function SettingsSheet({ onClose, onOpenSearch, onSync, syncing, onSignOut }) {
  const itemStyle = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${C.borderSoft}`, background: C.surface, color: C.ink, fontSize: '14px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' };
  return (
    <BottomSheet onClose={onClose} padding="10px 20px 40px" handleMargin="0 auto 20px">
      <style>{`@keyframes tt-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: '14px', fontWeight: 600, color: C.ink, marginBottom: '20px' }}>설정</div>
      {onSync && (
        <button onClick={() => onSync()} disabled={syncing} style={{ ...itemStyle, cursor: syncing ? 'default' : 'pointer' }}>
          <RefreshCw size={16} color={C.sage} style={syncing ? { animation: 'tt-spin 0.8s linear infinite' } : undefined} />
          {syncing ? '동기화 중…' : '지금 동기화'}
        </button>
      )}
      <button onClick={onOpenSearch} style={itemStyle}>
        <Search size={16} color={C.sage} /> 찾기
      </button>
      <button
        onClick={onSignOut}
        style={{ width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${C.borderSoft}`, background: C.surface, color: C.danger, fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}
      >
        로그아웃
      </button>
    </BottomSheet>
  );
}
