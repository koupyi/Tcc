# FASE 0 / ETAPA 4 — RELATÓRIO FINAL

> Data: 2026-08-12
> Executor: Kiro AI
> Status: **✅ CONCLUÍDA**

---

## 1. Status final

```
FASE 0 / ETAPA 4
Status: CONCLUÍDA
```

---

## 2. Objetivo

Garantir consistência entre carrinho, estoque e criação de pedidos com controle de concorrência.

---

## 3. Diagnóstico inicial

| Componente | Estado antes | Problema |
|-----------|-------------|----------|
| cart.service.ts addItem | ✅ Validava estoque dentro de $transaction | Erro genérico BAD_REQUEST |
| cart.service.ts updateItem | ✅ Validava estoque dentro de $transaction | Erro genérico BAD_REQUEST |
| order.service.ts createOrder | ❌ Validava estoque FORA da transação | Race condition |
| order.service.ts decrement | ❌ `{decrement: qty}` sem check >= 0 | Estoque podia ficar negativo |
| SELECT FOR UPDATE | ❌ Inexistente | Sem locking |
| AppError | ❌ Sem código INSUFFICIENT_STOCK | Erros indistinguíveis no frontend |
| Rate limiter em testes | ❌ Bloqueava registros no NODE_ENV=test | Testes falhavam intermitentemente |

---

## 4. Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/services/order.service.ts` | Reescrito createOrder: validação+lock+decrement DENTRO da transação |
| `src/services/cart.service.ts` | Trocado `AppError.badRequest` → `AppError.insufficientStock` |
| `src/utils/AppError.ts` | Adicionado `insufficientStock()` (HTTP 409, code INSUFFICIENT_STOCK) |
| `src/middlewares/rateLimiter.ts` | Skip rate limit em NODE_ENV=test |
| `src/__tests__/stock-concurrency.test.ts` | **CRIADO** — 15 testes de estoque e concorrência |

---

## 5. Alterações realizadas

### order.service.ts — createOrder

**Antes:**
1. Validação de estoque em loop FORA da transação
2. `$transaction` apenas criava order + decrement

**Depois:**
1. Pré-validações leves (carrinho vazio, endereço, pedido duplicado)
2. `$transaction` contém:
   - `SELECT FOR UPDATE` via raw query (lock da variante)
   - Validação de estoque com stock locked
   - Criação do pedido
   - Decrement condicional (`WHERE stockQty >= quantity`)
   - Safety net (se updateResult === 0, rollback)
   - StockLog
   - Desativação do carrinho

### cart.service.ts

- `addItem`: erro de estoque agora retorna HTTP 409 com `code: 'INSUFFICIENT_STOCK'`
- `updateItem`: idem

### AppError

- Novo método estático `insufficientStock(message, available?)`
- Retorna HTTP 409, code `INSUFFICIENT_STOCK`

---

## 6. Estratégia de controle de concorrência

```
PostgreSQL SELECT FOR UPDATE + Conditional UPDATE
```

**Fluxo:**
1. Transação inicia
2. `SELECT ... FROM product_variants WHERE id = :variantId FOR UPDATE` — obtém lock exclusivo na linha
3. Valida `stockQty >= quantity`
4. `UPDATE product_variants SET stockQty = stockQty - :qty WHERE id = :id AND stockQty >= :qty`
5. Se `updateResult === 0` → erro (safety net, não deve acontecer com FOR UPDATE)
6. Transação commit

**Resultado:** Requisições concorrentes são serializadas no nível do banco. A segunda requisição espera a primeira terminar, depois vê o stock atualizado.

---

## 7. Estratégia transacional

```
prisma.$transaction(async (tx) => {
  // 1. Lock variant rows (SELECT FOR UPDATE)
  // 2. Validate stock
  // 3. Create order + items + payment + shipment
  // 4. Decrement stock (conditional)
  // 5. Log stock changes
  // 6. Deactivate cart
})
```

Se qualquer passo falha → rollback automático. Nenhuma alteração persiste.

---

## 8. Como o estoque é protegido contra valores negativos

Duas camadas de proteção:

1. **Validação explícita:** `variant.stockQty < item.quantity` → rejeita
2. **UPDATE condicional:** `WHERE stockQty >= :quantity` — se o update afeta 0 linhas, a transação é abortada

O decrement **nunca** ocorre sem a condição `stockQty >= quantity`.

---

## 9. Como variantes são tratadas

- **Fonte da verdade:** `ProductVariant.stockQty`
- O estoque pertence à **variante**, não ao produto
- O carrinho adiciona por `variantId`
- O pedido decrementa estoque da `ProductVariant`
- Nenhum campo de estoque existe no modelo `Product`

---

## 10. Testes adicionados

| # | Teste | Verifica |
|---|-------|----------|
| 1 | Adicionar com estoque suficiente | PASS |
| 2 | Adicionar acima do estoque | ERRO 409 |
| 3 | Soma carrinho + novo excede estoque | ERRO 409 |
| 4 | Update para quantidade válida | PASS |
| 5 | Update acima do estoque | ERRO 409 |
| 6 | Variante com estoque 0 | ERRO 409 |
| 7 | Quantidade 0 | ERRO 422 (Zod) |
| 8 | Quantidade negativa | ERRO 422 (Zod) |
| 9 | Estoque alterado → checkout rejeitado | ERRO 409 |
| 10 | Order decrementa estoque (10→8) | PASS |
| 11 | Falha não decrementa (rollback) | PASS |
| 12 | Concorrência (stock=1, 2 compras) | 1 success + 1 fail |
| 13 | Estoque nunca negativo | PASS |
| 14 | Formato padrão de erro | PASS |
| 15 | Contract para frontend | PASS |

---

## 11. Resultado dos testes

```
Backend total:   58/58 PASS
  - integration.test.ts:    27/27
  - catalog-e2e.test.ts:    16/16
  - stock-concurrency.test.ts: 15/15

Frontend:        15/15 PASS
```

---

## 12. Resultado do teste concorrente

```
Estoque inicial:     1
Compras simultâneas: 2 (Promise.all)
Sucesso:             1 (HTTP 201)
Falha:               1 (HTTP 409)
Estoque final:       0
Estoque negativo:    NÃO (NUNCA)
```

---

## 13. Resultado da regressão

| Área | Status |
|------|--------|
| Health | ✅ PASS |
| Auth (register, login, me, 401, logout) | ✅ PASS |
| Products (list, pagination, search, sort, slug, 404) | ✅ PASS |
| Categories (list, slug, filter) | ✅ PASS |
| Cart (get, add, upsert, update, remove, persist) | ✅ PASS |
| E2E catalog (listing, detail, DB validation) | ✅ PASS |
| E2E search | ✅ PASS |
| E2E pagination | ✅ PASS |
| E2E categories | ✅ PASS |
| E2E variants/stock | ✅ PASS |
| E2E security | ✅ PASS |

**Zero regressões.**

---

## 14. Build

```
Frontend build: ✅ PASS (built in 9.59s)
```

---

## 15. Typecheck

```
Backend tsc --noEmit:  ✅ 0 errors
Frontend tsc --noEmit: ✅ 0 errors
```

---

## 16. Prisma

```
prisma validate: ✅ "schema is valid"
prisma generate: ✅ Generated Prisma Client
```

---

## 17. Migrations

Nenhuma migration criada. O schema não foi alterado. A estratégia de concorrência usa `$queryRaw` e `$executeRaw` sobre as tabelas existentes.

---

## 18. Seed

```
npx prisma db seed: ✅ "Seed finalizado!"
```

---

## 19. Problemas encontrados

| # | Problema | Resolução |
|---|---------|-----------|
| 1 | order.service.ts validava estoque fora da transação | Movido para dentro com SELECT FOR UPDATE |
| 2 | Decrement sem guardrail podia gerar estoque negativo | Adicionado WHERE condicional |
| 3 | Erros de estoque usavam code genérico BAD_REQUEST | Criado INSUFFICIENT_STOCK (409) |
| 4 | authRateLimiter bloqueava testes | Adicionado skip em NODE_ENV=test |

---

## 20. Problemas que permanecem

| # | Problema | Impacto | Fase sugerida |
|---|---------|---------|---------------|
| 1 | Redis não disponível (cache degraded) | Baixo (graceful degradation funciona) | FASE 12 |
| 2 | Sem constraint CHECK no banco (stockQty >= 0) | Mitigado por app-level | FASE 10 |
| 3 | Cart merge em login pode ter stock issues se anon cart tem qty > stock | Baixo (merge usa addItem que valida) | N/A (resolvido) |

---

## 21. Funcionalidades deliberadamente deixadas para fases futuras

- **Reserva de estoque com TTL** (P2 — Pós-MVP)
- **Constraint de banco CHECK (stockQty >= 0)** — requer nova migration
- **Webhooks de estoque baixo** (P2)
- **Carrinho anônimo com merge — estoque** — já funciona via `mergeCart` que usa `addItem`

---

## 22. Próxima etapa recomendada

Conforme `docs/ROADMAP.md`:

### FASE 5 — Checkout e Pedidos

**Objetivo:** Cliente finaliza compra e acompanha pedido.

Tasks:
- F5-01: Form de endereço (CRUD)
- F5-02: Tela de checkout multi-step
- F5-03: Cálculo de frete (tabela fixa)
- F5-04: Resumo com snapshot de itens/preço/frete
- F5-05: Criar pedido via API
- F5-06: Proteção duplo clique/idempotência
- F5-07: Página de sucesso
- F5-08: Área "Meus Pedidos"
- F5-09: Admin: listagem de pedidos + update status

**Nota:** O createOrder já está funcional e testado (esta etapa). A Fase 5 pode focar na UX de checkout no frontend e no fluxo completo end-to-end.

---

*Relatório gerado automaticamente durante execução da Fase 0 / Etapa 4.*
