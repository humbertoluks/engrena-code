/** Tipagem mínima de `import.meta.env` para o main Electron (Vite define em runtime). */

interface ImportMetaEnv {
  readonly VITE_DEV_SERVER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
