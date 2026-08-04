import { defineConfig } from 'vitest/config'
import { tmpdir } from 'os'
import { join } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      // vault-service/store importam `electron` no topo; fora do Electron, `app.getPath`
      // não existe. Este override (mesmo padrão de src/services/vault/store.ts) evita
      // o import quebrar quando testes tocam módulos que dependem do vault.
      ENGRENACODE_USER_DATA: join(tmpdir(), `engrenacode-test-${process.pid}`),
    },
  },
})
