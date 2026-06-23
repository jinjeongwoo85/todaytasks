import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 폰트 로컬 번들(@fontsource) — Google 서버 의존 제거(오프라인·콜드스타트 가속).
// 쓰는 굵기(400/500/600)의 latin subset만 — 한글은 글리프가 없어 시스템 폰트로 폴백(기존과 동일).
// (subset 미지정 css는 cyrillic/greek/vietnamese까지 끌어와 번들이 커져서 latin-만 임포트)
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
