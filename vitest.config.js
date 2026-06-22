import { defineConfig } from 'vitest/config'

// 순수 로직(utils) 유닛테스트 전용 설정. DOM 불필요(node 환경), vite PWA 플러그인 미사용.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
