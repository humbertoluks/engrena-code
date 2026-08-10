import { defineConfig } from 'vitest/config'
import { tmpdir } from 'os'
import { join } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      // Code vault shim (@engrena/vault + ENGRENACODE_USER_DATA) importa `electron`
      // no topo; fora do Electron, `app.getPath` não deve ser chamado. Este override
      // evita o fallback quando testes tocam módulos que dependem do vault.
      ENGRENACODE_USER_DATA: join(tmpdir(), `engrenacode-test-${process.pid}`),
    },
  },
})
