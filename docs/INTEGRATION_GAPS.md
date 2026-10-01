# AUDITORIA DE INTEGRAÇÃO — Gaps

> Data: 2026-08-06

---

## GAP-001: Backend não inicia — server.ts quebrado

### Problema
O arquivo `backend/src/server.ts` tem erro de sintaxe (`impor` em vez de `import`) e erro lógico (`app.use(express())` em vez de `express.json()`). Nenhuma rota, middleware, controller ou error handler está conectado.

### Local
`backend/backend/src/server.ts` — linhas 1-12 (arquivo inteiro)

### Impacto
**BLOQUEADOR** — Nenhuma funcionalidade do backend pode ser acessada.

### Correção
Reescrever server.ts para:
- Corrigir imports
- Aplicar middlewares (helmet, cors, compression, json, requestLogger, rateLimiter)
- Registrar rotas (auth, products, cart, orders, admin, uploads, payments)
- Aplicar error handler e notFoundHandler
- Conectar banco (connectDatabase)
- Conectar Redis (connectRedis)

### Critério de aceite
- `npm run dev` inicia sem erros
- GET http://localhost:3000/ responde 200

---

## GAP-002: Schema Prisma desatualizado

### Problema
O schema.prisma define modelos simplificados que não refletem o que os services/repositories esperam. Pelo menos 12 modelos/campos estão ausentes ou divergentes.

### Local
`backend/backend/src/prisma/schema.prisma` — arquivo inteiro

### Impacto
**BLOQUEADOR** — `prisma generate` gera types incompatíveis com o código existente. TypeScript não compila.

### Correção
Reescrever o schema para incluir:
- ProductVariant (com sku, switchType, layout, color, backlight, connectivity, weight, stockQty, isActive, deletedAt)
- Cart + CartItem
- Address
- Shipment
- StockLog
- AuditLog
- Image (expandido)
- Campos faltantes em User, Product, Order, OrderItem, Payment, RefreshToken
- Enums: PaymentMethod, AuditAction, Role.SUPER_ADMIN, OrderStatus expandido

### Critério de aceite
- `prisma generate` executa sem erros
- `prisma migrate dev` cria tabelas corretamente
- TypeScript compila sem erros de tipo Prisma

---

## GAP-003: Nenhuma rota HTTP registrada

### Problema
Os controllers AuthController, CartController, ProductController existem com métodos prontos, mas nenhum arquivo de rotas os conecta ao Express router (exceto 2 rotas de password reset no módulo auth que também não são importadas no server).

### Local
- `backend/backend/src/controllers/*.ts` — sem correspondência em routes/
- `backend/backend/src/server.ts` — não importa nenhum router

### Impacto
**BLOQUEADOR** — API é inacessível mesmo se o server.ts for corrigido.

### Correção
Criar arquivos de rotas:
- `src/routes/auth.routes.ts`
- `src/routes/product.routes.ts`
- `src/routes/cart.routes.ts`
- `src/routes/order.routes.ts`
- `src/routes/payment.routes.ts`
- `src/routes/admin.routes.ts`
- `src/routes/upload.routes.ts`
- `src/routes/index.ts` (registra todos)

### Critério de aceite
- Todas as rotas respondem com status correto
- Rotas protegidas retornam 401 sem token
- Validação Zod retorna 422 com body inválido

---

## GAP-004: Frontend não possui API client

### Problema
O frontend não faz NENHUMA chamada HTTP. Não existe fetch wrapper, axios instance, ou qualquer serviço de comunicação com backend. Todos os dados são importados de arquivos estáticos.

### Local
- Ausência total de: `src/services/`, `src/api/`, ou qualquer arquivo com `fetch`/`axios`
- `src/context/AuthContext.tsx` — linha 23: `// Demo login - in production this would hit an API`

### Impacto
**BLOQUEADOR** — Mesmo com o backend funcional, o frontend não consegue consumir dados.

### Correção
Criar:
- `src/services/api.ts` — fetch/axios instance com baseURL, interceptors, refresh token
- `src/services/auth.ts` — login, register, logout, refresh, me
- `src/services/products.ts` — list, getBySlug, filters
- `src/services/cart.ts` — get, add, update, remove, clear
- `src/services/orders.ts` — create, list, getById
- React Query hooks para cada endpoint

### Critério de aceite
- Frontend consegue fazer login e receber tokens
- Frontend lista produtos da API
- Erros da API são tratados e exibidos

---

## GAP-005: Modelos de dados incompatíveis

### Problema
Frontend usa `Product { id: "sw-1", price: number, category: "Switches", brand: "Gateron", image: importedAsset }`.
Backend usa `Product { id: UUID, basePrice: Decimal, categoryId: UUID, variants: ProductVariant[] }`.

### Local
- `frontend/src/data/products.ts` — interface Product
- `backend/backend/src/validators/product.validator.ts` — CreateProductInput
- `backend/backend/src/repositories/product.repository.ts` — findMany response

### Impacto
**Alto** — O frontend precisa ser refatorado para consumir a estrutura do backend.

### Correção
- Criar pacote de tipos compartilhados ou type adapter no frontend
- Mapear: `product.basePrice` → exibição como `price`
- Mapear: `product.images[0].url` → exibição como `image`
- Mapear: `product.category.name` → exibição como `category`
- Variantes: cada variante tem seu preço, a listagem mostra basePrice do produto

### Critério de aceite
- ProductsPage renderiza dados vindos da API
- Tipos TypeScript não divergem entre frontend e backend

---

## GAP-006: Carrinho incompatível

### Problema
Frontend CartItem: `{ id: string, name: string, price: number, quantity: number, image: string }`
Backend CartItem: `{ id: string, variantId: UUID, quantity: number, unitPrice: number }`

### Local
- `frontend/src/context/CartContext.tsx` — interface CartItem
- `backend/backend/src/services/cart.service.ts` — addItem input: `{ variantId, quantity }`

### Impacto
**Alto** — O carrinho do frontend não pode ser enviado ao backend sem transformação.

### Correção
Refatorar CartContext para:
1. Modo anônimo: localStorage com variantId (não string id)
2. Modo autenticado: sincronizar com API (GET/POST /cart)
3. Merge: ao fazer login, enviar itens locais para API

### Critério de aceite
- Adicionar item ao carrinho chama POST /cart/items com variantId
- Cart exibe dados do backend (nome, imagem, preço atualizados)

---

## GAP-007: Auth sem integração real

### Problema
AuthContext.login() faz `setUser({id:"1", email, name: email.split("@")[0]})` — não chama nenhuma API, não armazena tokens, não tem refresh flow.

### Local
- `frontend/src/context/AuthContext.tsx` — linhas 23-26

### Impacto
**BLOQUEADOR** — Nenhuma rota protegida funciona, carrinho autenticado impossível.

### Correção
- Chamar POST /auth/login → receber { accessToken, refreshToken, user }
- Armazenar tokens (httpOnly cookie ou localStorage+memory)
- Configurar interceptor para Bearer header
- Implementar refresh automático no 401
- Atualizar user state com dados reais

### Critério de aceite
- Login/register retorna tokens do backend
- Rotas protegidas enviam Authorization header
- Token expirado é renovado automaticamente
- Logout revoga tokens no backend

---

## GAP-008: CORS não configurado para frontend

### Problema
Backend env.ALLOWED_ORIGINS default é `http://localhost:3000`. Frontend roda em `http://localhost:8080`. Mesmo com o backend funcional, CORS bloquearia as requests.

### Local
- `backend/backend/src/config/env.ts` — linha: `ALLOWED_ORIGINS: z.string().default('http://localhost:3000')`

### Impacto
**Alto** — Todas as requests do frontend seriam bloqueadas.

### Correção
- Alterar default para `http://localhost:8080` ou aceitar ambas
- Aplicar cors middleware com origin: env.ALLOWED_ORIGINS.split(',')
- Configurar credentials: true para cookies (se usado)

### Critério de aceite
- Frontend em :8080 consegue chamar backend em :3000 sem erro CORS

---

## GAP-009: Variáveis de ambiente não documentadas

### Problema
Backend .env.example está VAZIO. Frontend não tem .env.example. Nenhum desenvolvedor sabe quais variáveis configurar.

### Local
- `backend/backend/.env.example` — arquivo vazio (0 bytes)
- `frontend/` — sem .env ou .env.example

### Impacto
**Alto** — Impossível fazer setup local sem ler todo o código.

### Correção
- Popular backend .env.example com todas as variáveis do config/env.ts
- Criar frontend .env.example com VITE_API_URL
- Documentar em docs/ENVIRONMENT_VARIABLES.md

### Critério de aceite
- Novo desenvolvedor consegue rodar ambos os projetos apenas com .env.example

---

## GAP-010: Lock file ausente no backend

### Problema
Backend não possui package-lock.json ou qualquer lock file. Builds não são reproduzíveis.

### Local
- `backend/backend/` — apenas package.json, sem lock file

### Impacto
**Médio** — Versões de dependências podem variar entre instalações.

### Correção
- Executar `npm install` para gerar package-lock.json
- Commitar o lock file

### Critério de aceite
- package-lock.json existe e está commitado

---

## GAP-011: Seed usa modelo antigo

### Problema
O seed.ts referencia campos que não existem (`images` como array de strings, `price` ao invés de `basePrice`, `stock` ao invés de stockQty em variante, `categories: { connect }` com M:N).

### Local
- `backend/backend/src/prisma/seed.ts` — linhas 40-95

### Impacto
**Médio** — Impossível popular banco de exemplo.

### Correção
Reescrever seed para usar o schema atualizado: criar categorias, produtos com SKU/basePrice, variantes com stockQty, imagens.

### Critério de aceite
- `npx prisma db seed` executa sem erros
- Banco tem dados de exemplo navegáveis

---

## GAP-012: Duas implementações de auth middleware conflitantes

### Problema
Existem dois sistemas de auth: `middlewares/auth.middleware.ts` (usa env validado, tipos completos) e `middlewares/requireAuth.ts` + `shared/jwt.ts` (usa process.env direto, tipos simples). O módulo `modules/auth/` usa o segundo sistema.

### Local
- `backend/backend/src/middlewares/auth.middleware.ts`
- `backend/backend/src/middlewares/requireAuth.ts`
- `backend/backend/src/shared/jwt.ts`

### Impacto
**Médio** — Confusão sobre qual usar; potencial inconsistência.

### Correção
Unificar: usar apenas `auth.middleware.ts` (mais completo). Migrar `modules/auth/auth.routes.ts` para usar `authenticate` middleware.

### Critério de aceite
- Apenas um sistema de auth middleware
- Todos os endpoints usam o mesmo middleware

---

## GAP-013: Frontend sem página de detalhe do produto

### Problema
Não existe rota `/products/:slug` ou `/products/:id`. O card de produto não possui link para detalhe. O backend tem `getProductBySlug` pronto.

### Local
- `frontend/src/App.tsx` — rotas definidas sem product detail
- `frontend/src/pages/ProductsPage.tsx` — cards sem Link

### Impacto
**Alto** — Sem página de detalhe, o usuário não consegue ver variantes, imagens, especificações, ou selecionar opções antes de comprar.

### Correção
Criar `/products/:slug` com:
- Galeria de imagens
- Informações do produto
- Seletor de variante
- Preço (base + promo)
- Disponibilidade de estoque
- Botão adicionar ao carrinho

### Critério de aceite
- Clicar no card abre página de detalhe
- Variantes podem ser selecionadas
- Produto pode ser adicionado ao carrinho da página de detalhe

---

## RESUMO DOS GAPS

| ID | Severidade | Área | Esforço |
|----|-----------|------|---------|
| GAP-001 | 🔴 BLOQUEADOR | Backend | P |
| GAP-002 | 🔴 BLOQUEADOR | Backend | G |
| GAP-003 | 🔴 BLOQUEADOR | Backend | M |
| GAP-004 | 🔴 BLOQUEADOR | Frontend | M |
| GAP-005 | 🟠 ALTO | Ambos | M |
| GAP-006 | 🟠 ALTO | Frontend | M |
| GAP-007 | 🔴 BLOQUEADOR | Frontend | M |
| GAP-008 | 🟠 ALTO | Backend | P |
| GAP-009 | 🟠 ALTO | Ambos | P |
| GAP-010 | 🟡 MÉDIO | Backend | P |
| GAP-011 | 🟡 MÉDIO | Backend | M |
| GAP-012 | 🟡 MÉDIO | Backend | P |
| GAP-013 | 🟠 ALTO | Frontend | M |

**Total:** 5 bloqueadores, 5 altos, 3 médios.
**Ordem de resolução:** GAP-001 → GAP-002 → GAP-003 → GAP-009 → GAP-008 → GAP-010 → GAP-012 → GAP-004 → GAP-007 → GAP-005 → GAP-006 → GAP-011 → GAP-013
