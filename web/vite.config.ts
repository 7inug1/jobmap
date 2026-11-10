import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // API_TARGET으로 배포된 API를 대신 쓸 수 있다. 개발 서버의 저장소는 배포 주소와 분리돼 있어 사용 중인 기록을 건드리지 않는다.
    proxy: Object.fromEntries(['/agents', '/api'].map((path) => [path, { target: process.env.API_TARGET ?? 'http://localhost:5173', changeOrigin: true }])),
  },
})
