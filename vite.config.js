// vite.config.js
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const shouldMinify = env.VITE_MINIFY === 'true'
  const minSuffix = shouldMinify ? '.min' : ''

  return {
    base: '/dist/', 
    publicDir: false,
    plugins: [
      react()
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@seed': resolve(__dirname, 'db/seed'),
      },
    },
    build: {
      emptyOutDir: false,
      outDir: 'public/dist',
      minify: shouldMinify,
      rollupOptions: {
        // Una mini-app por rol (visitante, usuario, técnico y supervisor). Cada layout carga css/app.css, css/<rol>.css y js/<rol>.js
        input: {
          'visitante': resolve(__dirname, 'src/entries/visitante.jsx'),
          'usuario': resolve(__dirname, 'src/entries/usuario.jsx'),
          'tecnico': resolve(__dirname, 'src/entries/tecnico.jsx'),
          'supervisor': resolve(__dirname, 'src/entries/supervisor.jsx'),
        },
        output: {
          // - js/app.js + css/app.css: lo común a todas las mini-apps (librerías, Bootstrap, src/entries/app.css, context,
          //   services, helpers y widgets).
          // - js/atencion.js: detalle e historial del ticket (HU-5), que usan el técnico y el supervisor.
          // - js/<rol>.js + css/<rol>.css: las páginas, los parciales y el CSS propio de cada rol (src/pages/<rol>/<rol>.css).
          manualChunks: (id) => {
            const ruta = id.replace(/\\/g, '/');
            if (/\/src\/pages\/tecnico\/(DetalleTicket|HistorialCambios)\.jsx$/.test(ruta)) return 'atencion';
            if (/\/src\/(entries\/\w+\.jsx|pages\/|partials\/)/.test(ruta)) return undefined;
            return 'app';
          },
          entryFileNames: `js/[name]${minSuffix}.js`,
          chunkFileNames: `js/[name]${minSuffix}.js`,
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return `css/[name]${minSuffix}[extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
        },
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': 'http://localhost:4000',
        '/healthz': 'http://localhost:4000'
      }
    }
  }
})