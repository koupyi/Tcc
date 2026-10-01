# FASE 7 — PLANO DE EXECUÇÃO

> Data: 2026-08-07
> Status: Aguardando aprovação

---

## 1. Objetivo

**Objetivo oficial (ROADMAP.md, FASE 7 — Frete e logística):**

> "Cliente vê opções de frete por CEP, frete incluído no total, método registrado no pedido."

**Tasks oficiais:**

| ID | Título | Prioridade | Tamanho |
|----|--------|-----------|---------|
| F7-01 | API de consulta de frete por CEP | P1 | M |
| F7-02 | Múltiplas opções (normal/express) | P2 | M |
| F7-03 | Exibir opções no checkout | P1 | M |
| F7-04 | Tracking code no shipment | P2 | P |
| F7-05 | Tela de tracking (cliente) | P2 | M |

**Resultado esperado:** O cliente escolhe entre métodos de envio (normal/expresso), acompanha entrega com código de rastreio, e o admin pode atualizar tracking.

---

## 2. Estado Atual

### Backend

| Componente | Existe | Estado | Ação |
|------------|--------|--------|------|
| ShippingService | ✅ | Retorna 1 opção por CEP | Expandir para múltiplas opções |
| POST /shipping/calculate | ✅ | Retorna { name, price, days } | Retornar Array de opções |
| Shipment model (Prisma) | ✅ | Tem trackingCode, carrier, status | Usar campos existentes |
| Order routes | ✅ | PATCH /:id/status (admin) | Adicionar PATCH shipment/tracking |
| OrderService.updateStatus | ✅ | Transição de estados | Sem alteração |

### Frontend

| Componente | Existe | Estado | Ação |
|------------|--------|--------|------|
| ShippingOptions component | ✅ | Mostra 1 opção | Expandir para lista selecionável |
| useShipping hook | ✅ | calculate(zipCode) | Adaptar para retornar array |
| CheckoutPage Step 2 | ✅ | Auto-seleciona frete | Permitir escolha entre opções |
| OrderDetailPage | ✅ | Mostra pedido sem tracking | Adicionar seção tracking |
| Tracking page | ❌ | Não existe | Criar |

### Banco

| Item | Status |
|------|--------|
| Shipment.trackingCode | ✅ Existe (nullable) |
| Shipment.carrier | ✅ Existe (nullable) |
| Shipment.status | ✅ Existe (String, default "PENDING") |
| Shipment.shippedAt | ✅ Existe |
| Shipment.deliveredAt | ✅ Existe |
| Migration | ❌ NÃO necessária |

---

## 3. Auditoria Relacionada

| Problema | Documento | Solução |
|----------|-----------|---------|
| Frontend AUDIT #18: Frete "Grátis" hardcoded | FRONTEND_AUDIT.md | Resolvido na FASE 5, agora expandir com opções |
| MVP #5: Calcular frete | MVP_SCOPE.md | Já implementado, expandir com express |
| RISKS D-003: Shipping simplificado | RISKS_AND_DECISIONS.md | Manter tabela fixa, adicionar express como 2x preço, -50% dias |

---

## 4. Escopo Backend

### Arquivos a alterar

| Arquivo | Alteração | Motivo |
|---------|-----------|--------|
| `src/services/shipping.service.ts` | Retornar array de opções (normal + express) | F7-02 |
| `src/routes/shipping.routes.ts` | Resposta agora é array | Compatibilidade |
| `src/services/order.service.ts` | Aceitar `shippingMethod` no input | Registrar método escolhido |
| `src/validators/order.validator.ts` | Adicionar `shippingMethod` ao schema | Validação |
| `src/routes/order.routes.ts` | Novo endpoint PATCH /orders/:id/tracking (admin) | F7-04 |

### Endpoints

| Método | Endpoint | Auth | Objetivo |
|--------|----------|------|----------|
| POST | /api/v1/shipping/calculate | public | Retorna opções de frete (normal + express) |
| PATCH | /api/v1/orders/:id/tracking | admin | Atualiza tracking code + carrier |
| GET | /api/v1/orders/:id | user | Já existe — incluir shipment data |

### Regras de negócio

- POST /shipping/calculate retorna: `[ { id: "normal", name, price, days }, { id: "express", name, price, days } ]`
- Express = 2x preço do normal, ~50% menos dias (min 1 dia)
- createOrder aceita `shippingMethod: "normal" | "express"` — backend recalcula com base no CEP do endereço
- Admin pode setar tracking code + carrier a qualquer momento

---

## 5. Banco

**Nenhuma migration necessária.**

Todos os campos já existem no modelo Shipment:
- `trackingCode` (String?)
- `carrier` (String?)
- `status` (String)
- `shippedAt` (DateTime?)
- `deliveredAt` (DateTime?)

---

## 6. Escopo Frontend

### Arquivos a alterar

| Arquivo | Alteração |
|---------|-----------|
| `src/api/shipping.ts` | Resposta agora é array de opções |
| `src/hooks/useShipping.ts` | Retornar array + seleção |
| `src/components/orders/ShippingOptions.tsx` | Lista selecionável (radio) |
| `src/pages/CheckoutPage.tsx` | Permitir escolha de método |
| `src/pages/OrderDetailPage.tsx` | Mostrar tracking info |

### Arquivos a criar

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/pages/TrackingPage.tsx` | Página de rastreio /orders/:id/tracking |
| `src/components/orders/TrackingInfo.tsx` | Componente de tracking |

### Fluxos

**Checkout com opções:**
```
Endereço selecionado
        ↓
POST /shipping/calculate { zipCode }
        ↓
[{ id:"normal", name:"Normal", price:15, days:4 }, { id:"express", name:"Expresso", price:30, days:2 }]
        ↓
Usuário seleciona método
        ↓
POST /orders { addressId, paymentMethod, shippingMethod:"express" }
        ↓
Backend recalcula frete com método escolhido
```

**Tracking:**
```
Admin atualiza pedido
        ↓
PATCH /orders/:id/tracking { trackingCode, carrier }
        ↓
Shipment atualizado
        ↓
Cliente abre /orders/:id
        ↓
Vê tracking code + carrier + status
```

---

## 7. Testes

### Backend
- POST /shipping/calculate → retorna array com 2 opções
- POST /orders com shippingMethod:"express" → shippingCost > normal
- PATCH /orders/:id/tracking → atualiza trackingCode e carrier
- GET /orders/:id → inclui shipment com tracking

### Frontend
- ShippingOptions renderiza 2 opções (radio)
- CheckoutPage permite seleção
- OrderDetailPage mostra tracking quando disponível

### E2E
1. Login
2. Add to cart
3. Checkout → selecionar endereço
4. Ver 2 opções de frete
5. Selecionar express
6. Confirmar pedido (total inclui frete expresso)
7. Simular admin add tracking
8. Ver tracking no detalhe do pedido

---

## 8. Critérios de Aceite

```
[ ] POST /shipping/calculate retorna múltiplas opções
[ ] Opção normal e express disponíveis
[ ] Frontend exibe lista selecionável
[ ] Checkout permite escolha de método
[ ] Pedido registra método escolhido
[ ] Frete correto incluído no total
[ ] Admin pode atualizar tracking code
[ ] Admin pode atualizar carrier
[ ] Cliente vê tracking no detalhe do pedido
[ ] Testes passando
[ ] Build OK
[ ] Sem regressões
```

---

## 9. Riscos

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Alteração na resposta do /shipping/calculate pode quebrar checkout existente | Média | Manter compatibilidade — frontend adapta |
| Express com 1 dia para regiões distantes pode não fazer sentido | Baixa | min 1 dia, aceitar como aproximação |
| Admin tracking sem interface admin | Baixa | Endpoint funciona via API, UI admin é FASE 9 |

---

## 10. Estimativa

| Aspecto | Complexidade |
|---------|-------------|
| Backend (expand shipping + tracking endpoint) | Baixa |
| Frontend (radio selection + tracking display) | Baixa-Média |
| Testes | Baixa |
| **Total** | **~8-10 arquivos alterados/criados** |

---

*Plano gerado em 2026-08-07. Aguardando aprovação para implementar.*
