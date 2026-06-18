import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages 배포 시 이 값을 본인의 저장소 이름으로 변경하세요.
// 예: GitHub 저장소 이름이 "my-tasks"이면 '/my-tasks/' 로 수정
const REPO_BASE = '/todaytasks/'

export default defineConfig({
  base: REPO_BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
  ],
})
