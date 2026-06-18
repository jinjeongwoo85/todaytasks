// 바텀 시트 공통 래퍼 — 기존에 4곳(달력/날짜선택/설정/복사)에 중복돼 있던 구조를 통합.
// 배경 백드롭(탭하면 onClose) + 아래에서 올라오는 시트 + 상단 드래그 핸들 바.
// 변형은 props로: zIndex, 백드롭 불투명도, maxWidth, padding, 핸들 하단 여백.
import { C, Z } from '../styles/tokens';

export default function BottomSheet({
  onClose,
  zIndex = Z.backdrop,
  backdrop = 0.38,
  maxWidth = 480,
  padding = '10px 20px 32px',
  handleMargin = '0 auto 12px',
  children,
}) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: `rgba(35,35,35,${backdrop})`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet-rise sans"
        style={{ width: '100%', maxWidth: `${maxWidth}px`, background: C.bg, borderRadius: '20px 20px 0 0', padding, boxSizing: 'border-box' }}
      >
        <div style={{ width: '36px', height: '4px', background: C.border, borderRadius: '2px', margin: handleMargin }} />
        {children}
      </div>
    </div>
  );
}
