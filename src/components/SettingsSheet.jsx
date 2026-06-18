// 설정 바텀 시트 — 현재는 로그아웃 버튼만. BottomSheet 래퍼 사용.
import { C } from '../styles/tokens';
import BottomSheet from './BottomSheet';

export default function SettingsSheet({ onClose, onSignOut }) {
  return (
    <BottomSheet onClose={onClose} padding="10px 20px 40px" handleMargin="0 auto 20px">
      <div style={{ fontSize: '14px', fontWeight: 600, color: C.ink, marginBottom: '20px' }}>설정</div>
      <button
        onClick={onSignOut}
        style={{ width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${C.borderSoft}`, background: C.surface, color: C.danger, fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}
      >
        로그아웃
      </button>
    </BottomSheet>
  );
}
