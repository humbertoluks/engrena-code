# Sections

## 1. Sibling tests (sibling) — HIGH — every production module that requires coverage gets a co-located test in the same diff

## 2. Isolation (isolation) — CRITICAL — tests never touch the real userData/vault

## 3. Regression (regression) — HIGH — bugfix + secret redaction coverage

## 4. E2E evidence (e2e) — HIGH — UI acceptance needs smoke-results, not narrative alone

## 5. Hygiene (hygiene) — MEDIUM — no skip/only, explicit timeouts for real process tests
