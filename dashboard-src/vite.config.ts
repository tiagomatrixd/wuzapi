import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The Go server exposes ./static/ through http.FileServer, so the dashboard is
// served from /dashboard/. Build straight into static/dashboard so that
// `go build .` keeps being the only step needed to ship the binary.
export default defineConfig({
  base: '/dashboard/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../static/dashboard',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    // `npm run dev` proxies the API to a locally running wuzapi instance.
    proxy: Object.fromEntries(
      [
        '/admin',
        '/session',
        '/webhook',
        '/chat',
        '/user',
        '/group',
        '/newsletter',
      ].map((path) => [
        path,
        { target: process.env.WUZAPI_URL ?? 'http://localhost:8080', changeOrigin: true },
      ]),
    ),
  },
})
