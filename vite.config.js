import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages 배포 시 이 값을 본인의 저장소 이름으로 변경하세요.
// 예: GitHub 저장소 이름이 "my-tasks"이면 '/my-tasks/' 로 수정
const REPO_BASE = '/todaytasks/'

// 네이티브(Capacitor) 빌드 분기: BUILD_TARGET=native 면 상대경로 base + 서비스워커 비활성.
// WebView는 file:// 로 자산을 로드하므로 base는 './' 여야 하고, SW는 불필요·충돌 소지가 있어 끈다.
const isNative = process.env.BUILD_TARGET === 'native'
const base = isNative ? './' : REPO_BASE

export default defineConfig({
  base,
  plugins: [
    react(),
    // 네이티브 빌드에선 PWA(서비스워커) 비활성
    ...(isNative ? [] : [
      VitePWA({
        registerType: 'autoUpdate',
        // 로컬 번들 폰트(woff2)도 오프라인 precache — 기본 glob엔 woff2가 빠져 있어 명시.
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },
        manifest: {
          name: 'TodayTasks',
          short_name: 'Tasks',
          description: '오늘 할 일 관리',
          theme_color: '#232323',
          background_color: '#F6F4ED',
          display: 'standalone',
          start_url: REPO_BASE,
          scope: REPO_BASE,
          icons: [
            { src: `${REPO_BASE}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
            { src: `${REPO_BASE}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
            { src: `${REPO_BASE}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ]),
  ],
})
