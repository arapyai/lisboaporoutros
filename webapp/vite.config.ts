import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const allowedHosts = env.VITE_ALLOWED_HOSTS
    ? env.VITE_ALLOWED_HOSTS.split(',')
    : [];

  return {
    plugins: [react(), {
      name: 'city-metadata',
      transformIndexHtml(html) {
        if (!env.VITE_APP_NAME) return html;
        const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]!));
        return html.replace('Lisbon Literary Map guides readers through Lisbon with narrated literary texts.',
          escape(env.VITE_APP_DESCRIPTION || env.VITE_APP_NAME))
          .replace(/Lisbon Literary Map/g, escape(env.VITE_APP_NAME));
      },
      configureServer(server) {
        server.middlewares.use('/manifest.webmanifest', (_req, res) => {
          res.setHeader('Content-Type', 'application/manifest+json');
          res.end(JSON.stringify(cityManifest()));
        });
      },
      writeBundle(options) {
        const output = options.dir || 'dist';
        writeFileSync(resolve(output, 'manifest.webmanifest'), JSON.stringify(cityManifest(), null, 2));
        if (env.VITE_CITY_SLUG) {
          const sw = readFileSync('public/sw.js', 'utf8').replace(
            'lisbon-literary-map-app-shell-v2', `${env.VITE_CITY_SLUG}-app-shell-v2`
          );
          writeFileSync(resolve(output, 'sw.js'), sw);
        }
      }
    }],
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            map: ['maplibre-gl'],
            react: ['react', 'react-dom']
          }
        }
      }
    },
    server: {
      port: 5173,
      allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
          changeOrigin: true
        }
      }
    }
  };

  function cityManifest() {
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
    if (env.VITE_APP_NAME) manifest.name = env.VITE_APP_NAME;
    if (env.VITE_APP_DESCRIPTION) manifest.description = env.VITE_APP_DESCRIPTION;
    return manifest;
  }
});
