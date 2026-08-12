# Sections

## 1. Isolation (isolation)

**Impact:** CRITICAL — BrowserWindow security flags and renderer isolation.

## 2. Preload (preload)

**Impact:** CRITICAL — Named contextBridge API, CommonJS, no business logic.

## 3. IPC (ipc)

**Impact:** HIGH — Channel pairing, native-only capabilities, numeric bounds.

## 4. Process (process)

**Impact:** HIGH — PTY env allowlist, ELECTRON_RUN_AS_NODE for script spawn.

## 5. Build (build)

**Impact:** HIGH — Dev URL from env, production loadFile, preload CJS build, no unused renderer Node polyfill, vendor code-splitting.
