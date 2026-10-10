import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const allowedHosts = env.VITE_ALLOWED_HOSTS
    ? env.VITE_ALLOWED_HOSTS.split(',')
    : [];

  return {
    plugins: [react(), {
      name: 'admin-city-title',
      transformIndexHtml(html) {
        const title = (env.VITE_APP_NAME || 'Lisboa por Outros').replace(/[&<>"']/g, (char) => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]!));
        return html.replace('Admin · Lisboa por Outros', `Admin · ${title}`);
      }
    }],
    server: {
      port: 5174,
      allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
          changeOrigin: true
        }
      }
    }
  };
});
