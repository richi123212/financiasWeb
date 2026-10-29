import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'portal-offline-shell',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const template = readFileSync(new URL('./src/service-worker.js', import.meta.url), 'utf8');
      const files = ['/index.html', '/manifest.webmanifest', '/pwa-192.png', '/pwa-512.png', ...Object.keys(bundle).filter(name => /\.(js|css)$/.test(name)).map(name => `/${name}`)];
      const hash = createHash('sha256').update(template).update(Object.values(bundle).map(file => file.type === 'chunk' ? file.code : String(file.source)).join(''));
      for (const name of ['manifest.webmanifest', 'pwa-192.png', 'pwa-512.png']) hash.update(readFileSync(new URL(`./public/${name}`, import.meta.url)));
      const version = hash.digest('hex').slice(0, 16);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(files)) });
    },
  }],
})
