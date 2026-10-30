import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss(), {
    // Use Vite's bundled ONNX WASM asset instead of the library's CDN override.
    name: 'local-separation-runtime',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').includes('web-audio-separation/dist/index.js')) return;
      return code.replace(/e\.env\.wasm\.wasmPaths = `https:\/\/cdn\.jsdelivr\.net\/npm\/onnxruntime-web@\$\{n\}\/dist\/`;/,
        'e.env.wasm.wasmPaths = undefined;');
    },
  }],
  optimizeDeps: { exclude: ['web-audio-separation'] },
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' } },
  preview: { port: 4173, proxy: { '/api': 'http://127.0.0.1:3001' } },
});
