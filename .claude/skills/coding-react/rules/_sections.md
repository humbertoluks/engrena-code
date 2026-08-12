# Sections

Section ID in parentheses is the filename prefix used to group rules.

---

## 1. Boundary (boundary)

**Impact:** CRITICAL  
**Description:** Isolamento do renderer e fronteira com o host. Sem Node, sem fetch solto, sem segredo no storage do browser.

## 2. Bundle (bundle)

**Impact:** HIGH  
**Description:** Telas autenticadas e painéis pesados nascem `React.lazy`; highlighter Shiki é fine-grained; CSS de biblioteca viaja com o módulo lazy.

## 3. Logic extraction (logic)

**Impact:** HIGH  
**Description:** Regra de negócio testável fora do JSX; validação compartilhada com o servidor; spec de UI antes de implementar.

## 4. Error visibility (error)

**Impact:** HIGH  
**Description:** Falha de rede ou de API nunca some em catch vazio; feedback visível ao usuário.

## 5. State freshness (state)

**Impact:** MEDIUM  
**Description:** Dados derivados de vínculos N:N não ficam stale após mutação em modal.

## 6. Style and theme (style)

**Impact:** MEDIUM  
**Description:** Tema persistido, CSS em layer correta, sizing explícito no design system, marca do produto atual.
