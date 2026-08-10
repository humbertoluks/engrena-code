---
title: Persist theme preference in versioned localStorage
impact: MEDIUM
impactDescription: theme reset on reload and hexes scattered in components
tags: style, theme, localStorage
---

## Persist theme preference in versioned localStorage

Persista a preferência de tema (`light` | `dark` | `system`) em `localStorage` com chave estável do produto. Hexes e tokens de cor ficam só em CSS (`:root` / `.dark`), nunca hardcoded em componente.

**Incorrect:**

```tsx
const [dark, setDark] = useState(false) // lost on reload
<button style={{ color: '#3b82f6' }}>Salvar</button>
```

**Correct:**

```typescript
const KEY = 'app:theme'
export function loadTheme(): 'light' | 'dark' | 'system' {
  return (localStorage.getItem(KEY) as 'light' | 'dark' | 'system') ?? 'system'
}
export function saveTheme(v: 'light' | 'dark' | 'system') {
  localStorage.setItem(KEY, v)
}
```

```css
:root { --accent: #…; }
.dark { --accent: #…; }
```
