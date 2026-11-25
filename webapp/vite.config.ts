import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cartografiaIcons, cityTheme } from './src/config/theme';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const slug = env.VITE_CITY_SLUG?.trim() || 'lisboa';
  const theme = cityTheme(slug);
  const isCartografia = theme.id === 'cartografia-poetica';
  const allowedHosts = env.VITE_ALLOWED_HOSTS
    ? env.VITE_ALLOWED_HOSTS.split(',')
    : [];

  return {
    plugins: [react(), {
      name: 'city-metadata',
      transformIndexHtml(html) {
        html = html.replace('<html lang="pt">', `<html lang="pt" data-theme="${theme.id}">`)
          .replace('content="#163832"', `content="${theme.color}"`)
          .replace('href="/branding/favicon.png"', `href="${theme.favicon}"`);
        if (!env.VITE_APP_NAME) return html;
        const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]!));
        return html.replace('Lisboa por Outros: descubra a cidade através de autores, percursos e textos literários para ler e ouvir.',
          escape(env.VITE_APP_DESCRIPTION || env.VITE_APP_NAME))
          .replace(/Lisboa por Outros/g, escape(env.VITE_APP_NAME));
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
        const sw = readFileSync('public/sw.js', 'utf8');
        const assets = ['/manifest.webmanifest', ...(isCartografia
          ? cartografiaIcons.map((icon) => icon.src)
          : [theme.logo])];
        const cacheName = env.VITE_CITY_SLUG ? `${slug}-app-shell-v2` : 'lisbon-literary-map-app-shell-v2';
        const configuredSw = sw.replace(/const CACHE_NAME = [^;]+;/, `const CACHE_NAME = ${JSON.stringify(cacheName)};`)
          .replace(/const APP_SHELL = [^;]+;/, `const APP_SHELL = ${JSON.stringify(assets)};`);
        writeFileSync(resolve(output, 'sw.js'), configuredSw);
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
    if (isCartografia) {
      manifest.name = 'Lisboa por Outros';
      manifest.short_name = 'Lisboa por Outros';
      manifest.background_color = theme.color;
      manifest.theme_color = theme.color;
      manifest.icons = cartografiaIcons;
    }
    if (env.VITE_APP_NAME) manifest.name = env.VITE_APP_NAME;
    if (env.VITE_APP_DESCRIPTION) manifest.description = env.VITE_APP_DESCRIPTION;
    return manifest;
  }
});
