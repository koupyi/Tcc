# FASE 5 — PLANO DE EXECUÇÃO

> Data: 2026-08-07
> Status: Aguardando aprovação

---

## Objetivo

Objetivo oficial (ROADMAP.md, FASE 5):

> "Cliente finaliza compra e acompanha pedido."

Transformar o carrinho existente em um fluxo completo de compra com:
- Gestão de endereços (CRUD)
- Checkout multi-step (endereço → frete → resumo → confirmar)
- Cálculo de frete (tabela fixa por região)
- Criação de pedido com snapshot de dados
- Proteção contra duplo clique
- Página de sucesso
- Área "Meus Pedidos"
- API admin para gerenciar pedidos

---

## Estado Atual

### Backend — O que JÁ existe

| Componente | Status | Detalhes |
|------------|--------|----------|
| OrderService | ✅ Completo | createOrder, getMyOrders, getOrderById, updateStatus, listAllOrders |
| Order Routes | ✅ Registradas | POST /, GET /my, GET /:id, GET / (admin), PATCH /:id/status (admin) |
| Order Validator | ✅ | createOrderSchema (addressId + paymentMethod + notes) |
| Order Repository | ✅ | findMany, findById, updateStatus |
| Address Validator | ✅ | createAddressSchema, updateAddressSchema (CEP, rua, etc) |
| Address Model (Prisma) | ✅ | userId, label, street, number, zipCode, city, state, isDefault, etc |
| Payment Service | ⚠️ Stub | processWithGateway retorna PAID (sem gateway real) |
| Order Status Machine | ✅ | PENDING→CONFIRMED→PROCESSING→SHIPPED→DELIVERED (com CANCELLED) |
| Snapshot de dados | ✅ | OrderItem guarda productName, variantName, sku, unitPrice, total |
| Decremento de estoque | ✅ | Em $transaction no createOrder |
| Audit log | ✅ | ORDER_STATUS_CHANGE registrado |

### Backend — O que FALTA

| Componente | Status | Ação |
|------------|--------|------|
| Address Routes/Controller | ❌ NÃO EXISTE | Criar CRUD de endereços |
| Cálculo de frete | ❌ Hardcoded 0 | Implementar tabela fixa por CEP |
| Idempotência | ❌ | Adicionar proteção contra pedido duplicado |

### Frontend — O que FALTA

| Componente | Status |
|------------|--------|
| CheckoutPage | ❌ Não existe |
| AddressForm | ❌ Não existe |
| OrderSuccessPage | ❌ Não existe |
| OrdersPage (Meus Pedidos) | ❌ Não existe |
| OrderDetailPage | ❌ Não existe |
| Orders API client | ❌ Não existe |
| Address API client | ❌ Não existe |

---

## Auditoria Relacionada

| Problema | Documento | Solução |
|----------|-----------|---------|
| Frontend AUDIT #19: Checkout — botão sem ação | FRONTEND_AUDIT.md | Criar fluxo de checkout completo |
| Frontend AUDIT #24: Histórico de pedidos não existe | FRONTEND_AUDIT.md | Criar /orders |
| Frontend AUDIT #25: Detalhe do pedido não existe | FRONTEND_AUDIT.md | Criar /orders/:id |
| Frontend AUDIT #18: Frete "Grátis" hardcoded | FRONTEND_AUDIT.md | Implementar cálculo |
| GAP-006: Checkout completo inexistente | INTEGRATION_GAPS.md | Fluxo multi-step |
| MVP #4: Informar endereço de entrega | MVP_SCOPE.md | Form de endereço |
| MVP #5: Calcular frete | MVP_SCOPE.md | Tabela fixa |
| Frete: shippingCost = 0 TODO no backend | order.service.ts | Tabela fixa por CEP |

---

## Backend

### Arquivos a CRIAR

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/controllers/address.controller.ts` | CRUD de endereços |
| `src/services/address.service.ts` | Lógica de endereços |
| `src/routes/address.routes.ts` | Rotas REST de endereços |
| `src/services/shipping.service.ts` | Cálculo de frete por CEP |

### Arquivos a ALTERAR

| Arquivo | Alteração |
|---------|-----------|
| `src/services/order.service.ts` | Integrar ShippingService para cálculo de frete |
| `src/routes/index.ts` | Registrar address routes |
| `src/validators/order.validator.ts` | Adicionar shippingMethod ao createOrderSchema |

### Endpoints a criar

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | /api/v1/addresses | user | Listar endereços do user |
| POST | /api/v1/addresses | user | Criar endereço |
| PATCH | /api/v1/addresses/:id | user | Atualizar endereço |
| DELETE | /api/v1/addresses/:id | user | Remover (soft delete) endereço |
| POST | /api/v1/shipping/calculate | public | Calcular frete por CEP |

### Endpoints existentes (já funcionais)

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | /api/v1/orders | user | Criar pedido |
| GET | /api/v1/orders/my | user | Meus pedidos |
| GET | /api/v1/orders/:id | user | Detalhe do pedido |
| GET | /api/v1/orders | admin | Todos os pedidos |
| PATCH | /api/v1/orders/:id/status | admin | Atualizar status |

### Prisma / Banco

- **Nenhuma migration necessária** — modelo Address já existe no schema
- Tabelas utilizadas: Address, Order, OrderItem, Payment, Shipment, Cart, CartItem, ProductVariant

### Cálculo de frete (tabela fixa)

```typescript
// ShippingService — tabela por região baseada nos primeiros 2 dígitos do CEP
const SHIPPING_TABLE: Record<string, { name: string; price: number; days: number }> = {
  // SP Capital
  "01-09": { name: "SP Capital", price: 10.00, days: 2 },
  // SP Interior + RJ + MG + ES
  "10-39": { name: "Sudeste", price: 15.00, days: 4 },
  // Sul (PR, SC, RS)
  "80-99": { name: "Sul", price: 18.00, days: 5 },
  // Centro-Oeste + Norte + Nordeste
  "default": { name: "Demais regiões", price: 25.00, days: 7 },
};
```

### Idempotência

Estratégia: verificar se usuário já tem pedido PENDING recente (< 5 min) com os mesmos items antes de criar outro. Simples e eficaz sem necessidade de idempotency key header.

---

## Frontend

### Páginas a criar

| Página | Rota | Descrição |
|--------|------|-----------|
| `CheckoutPage.tsx` | /checkout | Fluxo multi-step |
| `OrderSuccessPage.tsx` | /orders/:id/success | Confirmação |
| `OrdersPage.tsx` | /orders | Lista de pedidos |
| `OrderDetailPage.tsx` | /orders/:id | Detalhe do pedido |

### Componentes a criar

| Componente | Descrição |
|------------|-----------|
| `AddressForm.tsx` | Form de endereço (Zod validation) |
| `AddressList.tsx` | Lista de endereços do user com seleção |
| `CheckoutStepper.tsx` | Indicador de etapas |
| `ShippingOptions.tsx` | Opções de frete calculadas |
| `OrderSummary.tsx` | Resumo final (items + frete + total) |
| `OrderCard.tsx` | Card de pedido na listagem |
| `OrderStatusBadge.tsx` | Badge de status com cor |

### API clients a criar

| Arquivo | Métodos |
|---------|---------|
| `src/api/addresses.ts` | list, create, update, delete |
| `src/api/orders.ts` | create, listMy, getById |
| `src/api/shipping.ts` | calculate(zipCode) |

### Hooks a criar

| Hook | Responsabilidade |
|------|-----------------|
| `useAddresses` | CRUD de endereços |
| `useOrders` | Lista de pedidos |
| `useOrder` | Detalhe por ID |
| `useShipping` | Cálculo de frete |

### Fluxo de checkout

```
CartPage → "Finalizar compra"
    ↓
/checkout (Step 1: Endereço)
    - Listar endereços existentes
    - Ou criar novo
    - Selecionar um
    ↓
Step 2: Frete
    - POST /shipping/calculate com CEP do endereço
    - Mostrar opções (normal/express se aplicável)
    - Selecionar método
    ↓
Step 3: Resumo
    - Itens do carrinho
    - Endereço selecionado
    - Frete calculado
    - Total final
    ↓
Step 4: Confirmar
    - Botão "Confirmar Pedido" (disabled durante loading)
    - POST /orders com { addressId, paymentMethod: PIX, notes? }
    ↓
/orders/:id/success
    - Número do pedido
    - Status: PENDING
    - Total
    - "Ver meus pedidos"
```

---

## Testes

### Backend

| Teste | Validação |
|-------|-----------|
| POST /addresses → cria endereço | 201, endereço no banco |
| GET /addresses → lista endereços | Array com items do user |
| DELETE /addresses/:id → soft delete | 200, deletedAt preenchido |
| POST /shipping/calculate → retorna frete | { price, days, name } |
| POST /orders com carrinho e endereço → cria pedido | 201, order com items |
| POST /orders com carrinho vazio → erro | 400 "Carrinho vazio" |
| POST /orders com endereço inválido → erro | 404 |
| POST /orders decrementa estoque | stockQty diminui |
| GET /orders/my → lista pedidos do user | Paginado |
| GET /orders/:id → detalhe | 200 com items |

### Frontend

| Teste | Validação |
|-------|-----------|
| AddressForm valida CEP | Rejeita formato inválido |
| CheckoutPage renderiza steps | Mostra 4 etapas |
| OrdersPage lista pedidos | Cards com status |

### E2E

```
1. Login
2. Adicionar produto ao carrinho
3. Ir para checkout
4. Criar endereço
5. Calcular frete
6. Revisar resumo
7. Confirmar pedido
8. Verificar página de sucesso
9. Verificar pedido em /orders
10. Verificar estoque decrementou
11. Verificar carrinho limpo
```

---

## Riscos

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Duplo clique cria 2 pedidos | Média | Verificar pedido recente + disabled button |
| Endereço deletado durante checkout | Baixa | Validar novamente no createOrder |
| Estoque esgotado entre cart e checkout | Média | Já validado no createOrder |
| Frete muda entre cálculo e confirmação | Baixa | Recalcular no backend ao criar pedido |

---

## Critérios de Aceite

```
[ ] Address CRUD funcional (API + frontend)
[ ] Checkout multi-step funcional
[ ] Cálculo de frete funcional (tabela fixa)
[ ] Pedido criado com snapshot
[ ] Estoque decrementado ao criar pedido
[ ] Carrinho limpo após pedido
[ ] Proteção duplo clique
[ ] Página de sucesso
[ ] Área "Meus Pedidos" funcional
[ ] Detalhe do pedido funcional
[ ] Admin pode alterar status
[ ] Sem mocks
[ ] Sem dados fake
[ ] tsc → 0 erros
[ ] Build → OK
[ ] Testes passando
[ ] E2E completo
```

---

## Estimativa

| Aspecto | Complexidade |
|---------|-------------|
| Backend address CRUD | Baixa (model já existe) |
| Backend shipping | Baixa (tabela fixa) |
| Backend order (já existe) | Nenhuma alteração grande |
| Frontend checkout | Alta (multi-step, forms, validação) |
| Frontend orders | Média (listagem + detalhe) |
| Testes | Média |
| **Total** | **~20-25 arquivos novos/alterados** |

---

*Plano gerado em 2026-08-07. Aguardando aprovação para implementar.*
