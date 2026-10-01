# API & FRONTEND — Matriz de Compatibilidade

> Data: 2026-08-06

---

## Arquitetura Detectada

| Repositório | Papel | Tecnologia |
|-------------|-------|-----------|
| portellamath/dev | Backend / API REST | Express + TypeScript + Prisma + PostgreSQL |
| LynnxLinux/qwerty-build-hub | Frontend / Web App (SPA) | React + Vite + TypeScript + Tailwind |

**Painel Administrativo:** Não existe como aplicação separada. O backend tem services de admin (`AdminService`) mas nenhum frontend admin.

---

## Parâmetros de Integração

| Parâmetro | Backend (pretendido) | Frontend (atual) | Status |
|-----------|---------------------|-----------------|--------|
| URL da API | `http://localhost:3000/api/v1` | ❌ Nenhuma URL configurada | 🔴 INCOMPATÍVEL |
| Porta dev backend | 3000 | — | — |
| Porta dev frontend | — | 8080 | — |
| CORS origins | env.ALLOWED_ORIGINS (default: localhost:3000) | Precisa de localhost:8080 | 🔴 INCOMPATÍVEL |
| Prefixo das rotas | `/api/v1` (via env.API_VERSION) | ❌ Nenhum uso | 🔴 |
| Formato de respostas | `{ success, message, data, meta }` | ❌ Não consome API | 🔴 |
| Formato de erros | `{ success: false, message, code, errors }` | ❌ Não trata erros de API | 🔴 |
| Auth header | `Authorization: Bearer <token>` | ❌ Não envia | 🔴 |
| Token storage | — (frontend decide) | ❌ Nenhum (demo stub) | 🔴 |
| Refresh token | Via body POST /auth/refresh | ❌ Não implementado | 🔴 |
| Upload | multipart/form-data via multer | ❌ Não implementado | 🔴 |
| Paginação backend | `{ meta: { total, page, limit, totalPages, hasNext, hasPrev } }` | ❌ Dados estáticos | 🔴 |
| Filtros backend | query params: search, categoryId, minPrice, maxPrice, sortBy, sortOrder | Frontend filtra localmente os dados estáticos | 🟡 INCOMPATÍVEL |
| Tipos TS compartilhados | Não existe pacote shared | Não existe pacote shared | 🔴 |
| Formato de IDs | UUIDs (User, Product, Payment) + CUIDs (Order, RefreshToken) | IDs estáticos como "sw-1", "kc-1" | 🔴 INCOMPATÍVEL |
| Datas | ISO 8601 (Prisma DateTime) | date-fns (preparado) | 🟡 Compatível quando integrado |
| Valores monetários | Decimal(10,2) no banco, Number no service | number com .toFixed(2) | 🟡 Compatível |
| Status de pedidos | PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED | ❌ Não existe no frontend | 🔴 |
| Status de pagamentos | PENDING, PAID, FAILED, CANCELLED, REFUNDED | ❌ Não existe no frontend | 🔴 |
| Estoque | stockQty em ProductVariant | ❌ Não verifica estoque | 🔴 |

---

## Matriz de Compatibilidade por Área Funcional

| Área | Backend atual | Frontend atual | Compatível? | Correção necessária |
|------|--------------|---------------|-------------|---------------------|
| **Auth — Login** | ✅ Service completo: email+senha → tokens JWT | ⚠️ Stub demo: `setUser({id:"1"})` sem HTTP | 🔴 NÃO | Criar API client, conectar AuthContext ao backend |
| **Auth — Register** | ✅ Service: name, email, password, phone → user+tokens | ⚠️ Stub demo sem HTTP | 🔴 NÃO | Idem |
| **Auth — Logout** | ✅ Revoga refresh token | ⚠️ `setUser(null)` local | 🔴 NÃO | Chamar API de logout, limpar tokens |
| **Auth — Refresh** | ✅ Rotação de refresh tokens | ❌ Não existe | 🔴 NÃO | Implementar interceptor de refresh |
| **Auth — Password Reset** | ✅ Módulo completo com email | ❌ Não existe tela | 🔴 NÃO | Criar páginas forgot/reset |
| **Usuários** | ✅ CRUD + roles + soft delete | ⚠️ Dashboard mostra mock user | 🔴 NÃO | Conectar ao /me endpoint |
| **Produtos — Listagem** | ✅ Service com paginação, filtros, cache | ⚠️ Dados estáticos em products.ts | 🔴 NÃO | Substituir dados estáticos por API calls |
| **Produtos — Detalhe** | ✅ getBySlug com variantes, imagens, categoria | ❌ Não existe página de detalhe individual | 🔴 NÃO | Criar página /products/:slug |
| **Variantes** | ✅ CRUD completo com SKU, preço, atributos | ⚠️ builderProducts.ts tem conceito similar mas estático | 🟡 PARCIAL | Mapear builder products para variantes do backend |
| **Categorias** | ✅ Model com hierarquia (parent/children) | ⚠️ Hardcoded como strings: "Switches", "Keycaps" etc. | 🔴 NÃO | Carregar categorias da API |
| **Imagens** | ✅ Upload + processamento Sharp + reorder | ⚠️ Imagens estáticas importadas via webpack | 🔴 NÃO | Usar URLs da API para imagens |
| **Carrinho** | ✅ Server-side: Cart + CartItems com validação de estoque | ⚠️ Client-side: useState[], sem persistência | 🔴 NÃO | Substituir CartContext por API calls |
| **Carrinho — Estrutura** | Item tem: variantId, quantity, unitPrice | Item tem: id, name, price, quantity, image | 🔴 INCOMPATÍVEL | Reformatar CartItem para usar variantId |
| **Checkout** | ✅ OrderService: addressId + paymentMethod → pedido | ❌ Botão "Finalizar compra" não faz nada | 🔴 NÃO | Criar fluxo de checkout completo |
| **Pedidos** | ✅ CRUD com status transitions, snapshot | ❌ Não existe no frontend | 🔴 NÃO | Criar /orders e /orders/:id |
| **Pagamentos** | ⚠️ Stub simulado (processWithGateway retorna PAID) | ❌ Não existe | 🔴 NÃO | Integrar gateway real + UI de pagamento |
| **Frete** | ❌ TODO no OrderService (shippingCost = 0) | ⚠️ Mostra "Grátis" no carrinho | 🟡 PARCIAL | Implementar cálculo de frete |
| **Endereços** | ✅ Validator com CEP, schema de Address | ❌ Não existe form de endereço | 🔴 NÃO | Criar form + API de endereços |
| **Estoque** | ✅ stockQty por variante + StockLog + reserva | ❌ Frontend não verifica/mostra estoque | 🔴 NÃO | Mostrar disponibilidade, bloquear se esgotado |
| **Admin** | ✅ AdminService com dashboard, users, audit, revenue | ❌ Não existe frontend admin | 🔴 NÃO | Criar área /admin |
| **E-mails** | ⚠️ Nodemailer configurado, usado no password reset | ❌ N/A no frontend | 🟡 — | Backend-only, funcional quando SMTP configurado |
| **Webhooks** | ⚠️ PaymentService.handleWebhook (sem validação de assinatura) | ❌ N/A no frontend | 🟡 — | Backend-only |
| **Erros** | ✅ Padronizado { success, message, code, errors } | ❌ Nenhum tratamento de erros de API | 🔴 NÃO | Criar error handling no API client |
| **Paginação** | ✅ { meta: { total, page, limit, totalPages, hasNext, hasPrev } } | ❌ Dados estáticos sem paginação | 🔴 NÃO | Implementar paginação no frontend |
| **Busca** | ✅ Filter search por name/description/brand/sku | ⚠️ Filtro local em array estático | 🔴 NÃO | Conectar ao search param da API |
| **Filtros** | ✅ categoryId, minPrice, maxPrice, switchType, layout, brand, isFeatured | ⚠️ Filtro local por category e brand | 🟡 PARCIAL | Reformatar para query params da API |

---

## Incompatibilidades Estruturais

### 1. Modelo de Dados de Produto

**Backend espera (services):**
```typescript
Product {
  id: UUID
  name, slug, description
  brand, sku
  basePrice: Decimal
  salePrice?: Decimal
  categoryId: UUID (1:1 com Category)
  isFeatured: boolean
  tags: string[]
  metaTitle, metaDesc
  variants: ProductVariant[]
  images: Image[]
}
```

**Frontend usa (data/products.ts):**
```typescript
Product {
  id: "sw-1"  // string curta
  name, price: number, rating: number
  category: "Switches" // string, não ID
  brand: "Gateron" // string inline
  image: importedAsset // webpack import
  description: string
}
```

**Gap:** Modelos completamente diferentes. O frontend precisará de um adapter ou ser reescrito para consumir a estrutura do backend.

### 2. Builder vs. Catálogo

O frontend tem dois sistemas de produto:
1. `products.ts` — catálogo simples para a loja
2. `builderProducts.ts` — componentes para o builder interativo com compatibilidade

O backend só tem um conceito de Product + Variant. Será necessário decidir:
- Builder products são variantes? Produtos separados com tags? Uma categoria especial?
- A lógica de compatibilidade (`compatibilidade.ts`) roda no frontend ou precisa de validação no backend também?

### 3. Carrinho

**Backend:** Carrinho server-side vinculado a userId, com CartItems referenciando variantId.
**Frontend:** Carrinho client-side com items `{id, name, price, quantity, image}`.

O merge é impossível sem reestruturação.

---

## Recomendações de Alinhamento

1. **Prioridade 1:** Corrigir o Prisma schema para refletir os modelos que os services esperam
2. **Prioridade 2:** Criar rotas e conectar controllers no backend
3. **Prioridade 3:** Criar API client no frontend (axios ou fetch wrapper)
4. **Prioridade 4:** Refazer AuthContext para usar API real
5. **Prioridade 5:** Refazer CartContext para usar API real (ou dual: anônimo local + autenticado via API)
6. **Prioridade 6:** Substituir dados estáticos por chamadas à API
7. **Prioridade 7:** Criar páginas faltantes (detalhe do produto, checkout, pedidos, admin)

---

## Decisões Arquiteturais Pendentes

| Decisão | Opções | Recomendação |
|---------|--------|-------------|
| Carrinho anônimo | a) LocalStorage only b) Session backend c) Dual (local + merge no login) | **c) Dual** — permite UX sem login + sincronização |
| Builder como produto | a) Categoria especial b) Flag no produto c) Modelo separado | **a) Categoria** + atributos de compatibilidade na variante |
| Tipos compartilhados | a) Copy-paste b) Pacote npm c) Monorepo shared | **c) Monorepo** com packages/shared-types |
| Imagens | a) Upload local b) S3/CloudFlare c) CDN Vercel | **b) S3** para produção, **a) local** para dev |
| Gateway de pagamento | a) Stripe b) Mercado Pago c) Ambos | **b) Mercado Pago** (env indica Brasil) com adapter pattern |
