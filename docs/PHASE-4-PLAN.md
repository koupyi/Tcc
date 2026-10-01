# FASE 4 — PLANO DE EXECUÇÃO

> Data: 2026-08-07
> Status: Aguardando aprovação

---

## 1. Objetivo

Objetivo oficial (ROADMAP.md, FASE 4):

> "Carrinho funcional com persistência e validação de estoque."

Transformar o carrinho em um sistema completo que:
- Persiste no PostgreSQL para usuários autenticados
- Funciona em localStorage para visitantes anônimos
- Faz merge dos itens ao fazer login
- Valida estoque real em todas as operações
- Protege contra race conditions com transações de banco

---

## 2. Estado Atual

### Backend

| Componente | Status | Localização |
|------------|--------|-------------|
| CartService | ✅ Funcional | `src/services/cart.service.ts` |
| CartController | ✅ Funcional | `src/controllers/cart.controller.ts` |
| CartRepository | ✅ Funcional | `src/repositories/cart.repository.ts` |
| Cart routes | ✅ Registradas | `src/routes/cart.routes.ts` |
| Validação de estoque | ⚠️ Parcial | Valida stockQty mas SEM transação |
| Concorrência | ❌ Não protegido | Sem `$transaction` ou `SELECT FOR UPDATE` |

**Endpoints existentes (todos exigem autenticação):**
- `GET /api/v1/cart` → retorna carrinho ativo do user
- `POST /api/v1/cart/items` → adiciona item (valida stock)
- `PATCH /api/v1/cart/items/:itemId` → atualiza quantidade (valida stock)
- `DELETE /api/v1/cart/items/:itemId` → remove item
- `DELETE /api/v1/cart` → limpa carrinho

### Frontend

| Componente | Status | Observação |
|------------|--------|------------|
| CartContext | ✅ Integrado com API | Usa cartApi para autenticados |
| Carrinho anônimo | ⚠️ Parcial | State local, mas sem localStorage |
| Merge após login | ❌ Não existe | Ao fazer login, carrinho anônimo se perde |
| Validação de stock no frontend | ❌ Não existe | Não bloqueia add se stock=0 antes de chamar API |
| Error handling no cart | ⚠️ Parcial | Catch genérico, sem mensagem de stock |

### Banco (Prisma)

| Modelo | Status |
|--------|--------|
| Cart | ✅ Existe (userId, isActive, expiresAt) |
| CartItem | ✅ Existe (cartId, variantId, quantity, unitPrice) |
| ProductVariant | ✅ Existe (stockQty) |
| Unique constraint | ✅ `@@unique([cartId, variantId])` |

---

## 3. Problemas Encontrados

| Problema | Origem | Solução |
|----------|--------|---------|
| Race condition no estoque | cart.service.ts não usa `$transaction` | Envolver check + upsert em transação serializable |
| Carrinho anônimo sem persistência local | CartContext usa useState sem localStorage | Implementar localStorage para visitantes |
| Merge de carrinho inexistente | CartContext limpa items ao fazer login | Enviar items locais para API após login |
| Erro de estoque não exibido ao usuário | catch genérico no CartContext | Propagar mensagem de erro do backend |
| ProductDetailPage não bloqueia add sem login | Apenas mostra toast genérico | Melhorar UX — oferecer login ou permitir anônimo |
| addItem no CartContext permite fallback local silencioso | Se API falha, adiciona localmente | Remover fallback — informar erro real |

---

## 4. Backend

### Arquivos que serão alterados

| Arquivo | Alteração | Motivo |
|---------|-----------|--------|
| `src/services/cart.service.ts` | Envolver addItem/updateItem em `$transaction` | Proteção contra race condition |
| `src/services/cart.service.ts` | Novo método `mergeCart(userId, items)` | Suportar merge de carrinho anônimo |
| `src/routes/cart.routes.ts` | Novo endpoint `POST /cart/merge` | Expor merge para frontend |
| `src/controllers/cart.controller.ts` | Novo método `merge` | Receber items anônimos |
| `src/validators/cart.validator.ts` | Novo schema `mergeCartSchema` | Validar input do merge |

### Endpoints envolvidos

| Método | Endpoint | Status | Alteração |
|--------|----------|--------|-----------|
| GET | /api/v1/cart | ✅ Existente | Nenhuma |
| POST | /api/v1/cart/items | ✅ Existente | Adicionar `$transaction` |
| PATCH | /api/v1/cart/items/:itemId | ✅ Existente | Adicionar `$transaction` |
| DELETE | /api/v1/cart/items/:itemId | ✅ Existente | Nenhuma |
| DELETE | /api/v1/cart | ✅ Existente | Nenhuma |
| POST | /api/v1/cart/merge | 🆕 Novo | Merge de items anônimos |

### Services

| Service | Responsabilidade |
|---------|-----------------|
| CartService.addItem | Validar stock + adicionar (COM transação) |
| CartService.updateItem | Validar stock + atualizar (COM transação) |
| CartService.mergeCart | Receber items anônimos, validar stock, adicionar ao carrinho |

### Banco

- **Tabelas utilizadas:** Cart, CartItem, ProductVariant, Product
- **Migration:** NENHUMA necessária (schema já correto)
- **Alteração Prisma:** NENHUMA

### Transação para proteção de concorrência

```
Antes:
  1. SELECT variant WHERE stockQty >= quantity  (leitura)
  2. UPSERT cart_item                           (escrita)
  → Race condition entre 1 e 2

Depois:
  prisma.$transaction(async (tx) => {
    1. SELECT variant FOR UPDATE (lock row)
    2. Verificar stockQty >= quantity
    3. UPSERT cart_item
  })
```

---

## 5. Frontend

### Arquivos envolvidos

| Arquivo | Alteração |
|---------|-----------|
| `src/context/CartContext.tsx` | Adicionar localStorage para anônimos + merge no login + error handling |
| `src/api/cart.ts` | Adicionar método `merge()` |
| `src/pages/ProductDetailPage.tsx` | Permitir add to cart para anônimos (localStorage) |
| `src/pages/CartPage.tsx` | Exibir mensagens de erro de estoque |

### Fluxo novo

**Antes:**

```
Usuário autenticado → CartContext → API → PostgreSQL
Usuário anônimo → CartContext → useState (perde ao refresh)
Login → CartContext limpa items
```

**Depois:**

```
Usuário autenticado → CartContext → API → PostgreSQL
Usuário anônimo → CartContext → localStorage (persiste refresh)
Login → CartContext lê localStorage → POST /cart/merge → API → PostgreSQL → limpa localStorage
```

### Carrinho anônimo (localStorage)

```typescript
const ANON_CART_KEY = "anon_cart";

interface AnonCartItem {
  variantId: string;
  quantity: number;
  name: string;
  price: number;
  image: string;
}

// Salvar: localStorage.setItem(ANON_CART_KEY, JSON.stringify(items))
// Ler: JSON.parse(localStorage.getItem(ANON_CART_KEY) || "[]")
// Limpar: localStorage.removeItem(ANON_CART_KEY)
```

### Merge no login

Quando `isAuthenticated` muda para `true`:
1. Ler items do localStorage
2. Se existem items → `POST /cart/merge`
3. Backend valida estoque de cada item
4. Backend adiciona/soma no carrinho do user
5. Frontend limpa localStorage
6. Frontend atualiza state com resposta do backend

---

## 6. Estratégia de Implementação

### Ordem de execução:

1. **Backend — Transações** → Proteger addItem/updateItem com `$transaction`
2. **Backend — Merge endpoint** → Criar `POST /cart/merge`
3. **Frontend — localStorage** → Persistir carrinho anônimo
4. **Frontend — CartContext merge** → Enviar items ao login
5. **Frontend — Error handling** → Exibir mensagens de estoque
6. **Frontend — ProductDetailPage** → Permitir add sem login
7. **Testes** → Backend + Frontend + E2E
8. **Validação final** → tsc, build, testes, E2E

---

## 7. Testes

### Backend

| Teste | Validação |
|-------|-----------|
| POST /cart/items com stock suficiente | ✅ 200, item adicionado |
| POST /cart/items com stock insuficiente | ❌ 400, mensagem de estoque |
| PATCH /cart/items/:id com stock insuficiente | ❌ 400, mensagem |
| POST /cart/merge com items válidos | ✅ 200, items adicionados |
| POST /cart/merge com item sem estoque | ⚠️ Parcial (itens válidos adicionados, inválidos ignorados ou reportados) |
| Concorrência: dois requests simultâneos | Apenas um consegue com stock=1 |

### Frontend

| Teste | Validação |
|-------|-----------|
| CartContext: adiciona item anônimo em localStorage | ✅ |
| CartContext: persiste após refresh (anônimo) | ✅ |
| CartContext: merge ao fazer login | ✅ |
| CartContext: erro de stock exibido | ✅ |
| ProductDetailPage: add to cart sem login | ✅ salva em localStorage |

### E2E

```
1. Abrir produto (sem login)
2. Adicionar ao carrinho → localStorage
3. Refresh → carrinho continua
4. Login
5. Merge executado
6. GET /cart → items do anônimo presentes
7. Adicionar mais 1 item
8. Atualizar quantidade
9. Tentar quantidade > estoque → erro
10. Remover item
11. Logout + login → carrinho persiste
```

---

## 8. Critérios de Aceite

```
[ ] CartContext usa API real para autenticados
[ ] Carrinho persistido no PostgreSQL
[ ] Carrinho anônimo funciona com localStorage
[ ] Carrinho anônimo sobrevive refresh
[ ] Merge após login funciona
[ ] Merge não duplica itens (soma quantidades)
[ ] Estoque validado no addItem
[ ] Estoque validado no updateItem
[ ] Não permite estoque negativo
[ ] Race condition protegida ($transaction)
[ ] Erro de estoque exibido ao usuário
[ ] Produto esgotado desabilita add
[ ] Testes backend passando
[ ] Testes frontend passando
[ ] E2E passando
[ ] tsc --noEmit → 0 erros
[ ] Build → OK
[ ] Documentação criada
```

---

## 9. Riscos

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Prisma não suporta `SELECT FOR UPDATE` diretamente | Baixa | Usar `$transaction` com isolamento serializable ou `$queryRaw` |
| localStorage indisponível | Muito baixa | Try/catch com fallback para state |
| Merge com muitos itens demora | Baixa | Limit de 20 items no carrinho |
| Conflito de dados entre localStorage e API | Média | Backend é source of truth; localStorage é apenas buffer temporário |

---

## 10. Estimativa

| Aspecto | Complexidade |
|---------|-------------|
| Backend (transações + merge) | Média |
| Frontend (localStorage + merge + errors) | Média |
| Testes | Média |
| **Total** | **~15 arquivos impactados** |

---

*Plano gerado em 2026-08-07. Aguardando aprovação para implementar.*
