import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'exclude-dev-worker',
      apply: 'build',
      // public assets are copied before writeBundle. Keep the dev worker out of dist.
      async writeBundle() {
        const { rm } = await import('node:fs/promises');
        await rm(
          fileURLToPath(
            new URL('./dist/mockServiceWorker.js', import.meta.url),
          ),
          { force: true },
        );
      },
    },
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
