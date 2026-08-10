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
        // node-pty (F26) resolve seus .node nativos com um require dinâmico
        // relativo ao próprio pacote (lib/utils.js); bundlado, esse require perde
        // o __dirname real de node_modules/node-pty e nunca acha os prebuilds.
        // External força require() real via Node para ambos, preservando o
        // contexto CJS/caminho original.
        vite: {
          build: {
            rollupOptions: {
              external: ['typescript', 'node-pty']
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
