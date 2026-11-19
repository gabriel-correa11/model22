import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

// base relativa: o build funciona em qualquer subpasta (Vercel, GitHub Pages, servidor local).
// Modo "unico": gera um só index.html com JS, CSS e fontes embutidos (para enviar ou publicar como página única).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'unico' ? [vue(), viteSingleFile()] : [vue()],
  build: mode === 'unico' ? { outDir: 'dist-unico', assetsInlineLimit: 100_000_000 } : {},
}))
