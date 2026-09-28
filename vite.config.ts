import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: [
        { find: /^dayjs$/, replacement: path.resolve(__dirname, 'node_modules/dayjs/esm/index.js') },
        { find: /^dayjs\/plugin\/([^/.]+?)(?:\.js)?$/, replacement: path.resolve(__dirname, 'node_modules/dayjs/esm/plugin/$1/index.js') },
        { find: '@', replacement: path.resolve(__dirname, './src') },
      ],
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      minify: true,
    },
    optimizeDeps: {
      include: ['mermaid', '@braintree/sanitize-url'],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

