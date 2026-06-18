// 로그인 전 화면 — 앱 제목 + Google 로그인 버튼.
import { C } from '../styles/tokens';

export default function LoginScreen({ onSignIn, isReady }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');`}</style>
      <div className="mono" style={{ fontSize: '26px', fontWeight: 600, color: C.ink, marginBottom: '8px', letterSpacing: '-0.02em' }}>TodayTasks</div>
      <div style={{ fontSize: '13px', color: C.mute, marginBottom: '48px' }}>오늘 할 일을 Google Tasks와 함께 관리하세요</div>
      <button
        onClick={onSignIn}
        disabled={!isReady}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '13px 28px', borderRadius: '999px',
          border: `1px solid ${C.border}`, background: '#FFFFFF',
          fontSize: '15px', color: C.ink, cursor: isReady ? 'pointer' : 'default',
          opacity: isReady ? 1 : 0.4, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
          <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
          <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
          <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
        </svg>
        Google로 로그인
      </button>
    </div>
  );
}
