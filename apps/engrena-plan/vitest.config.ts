import { defineConfig } from 'vitest/config'
import { tmpdir } from 'os'
import { join } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      // Plan vault/db shims importam `electron` no topo; fora do Electron,
      // `app.getPath` não deve ser chamado. Override evita o fallback.
      ENGRENAPLAN_USER_DATA: join(tmpdir(), `engrenaplan-test-${process.pid}`),
    },
  },
})
