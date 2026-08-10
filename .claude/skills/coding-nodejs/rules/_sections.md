# Sections

Section ID in parentheses is the filename prefix.

---

## 1. HTTP handlers (http)

**Impact:** CRITICAL  
**Description:** Guard, claim de rota, narrowing de body, CORS, status reservados e vocabulário de erro.

## 2. Errors (error)

**Impact:** HIGH  
**Description:** Catch obrigatório, sem path leak, mensagem na locale do produto.

## 3. Secrets (secret)

**Impact:** CRITICAL  
**Description:** Segredo só no vault; redação de stderr; WS sem token na query.

## 4. Filesystem (fs)

**Impact:** HIGH  
**Description:** Artefatos sob userData; escrita atômica do cofre.

## 5. Layers (layer)

**Impact:** MEDIUM  
**Description:** Domínio não importa handler; sem export órfão; efeitos destrutivos tudo-ou-nada.
