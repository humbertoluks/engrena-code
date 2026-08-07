import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        entry: 'src/main/index.ts',
        // typescript (Compiler API, F19 codegraph) usa __filename estilo CJS em
        // sys.ts; bundlar no main ESM quebra com "__filename is not defined".
        // External força require() real via Node, preservando o contexto CJS.
        vite: {
          build: {
            rollupOptions: {
              external: ['typescript']
            }
          }
        }
      },
      {
        // Preload precisa de nome próprio (main também emite index.js) e de saída
        // CommonJS, porque o script usa require('electron') no contexto de preload.
        vite: {
          build: {
            lib: {
              entry: 'src/preload/index.ts',
              formats: ['cjs'],
              fileName: () => 'preload.cjs'
            }
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173
  }
})
