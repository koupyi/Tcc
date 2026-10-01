# PROJECT AUDIT — Inventário Completo

> Data da auditoria: 2026-08-06
> Repositório Backend: https://github.com/portellamath/dev
> Repositório Frontend: https://github.com/LynnxLinux/qwerty-build-hub

---

## 1. BACKEND — keycaps-ecommerce-backend

### Informações Gerais

| Item | Valor |
|------|-------|
| Nome do projeto | keycaps-ecommerce-backend |
| Versão | 1.0.0 |
| Linguagem | TypeScript |
| Runtime | Node.js |
| Framework | Express 4.18 |
| Gerenciador de pacotes | npm (sem lock file presente) |
| Banco de dados | PostgreSQL |
| ORM | Prisma 5.10 |
| Cache | Redis (ioredis) |
| Autenticação | JWT (access + refresh tokens rotativos) com argon2id |
| Pagamentos | Stub simulado (nenhum gateway integrado) |
| Upload de imagens | Multer + Sharp (local) |
| Frete | Não implementado |
| Filas/Jobs | Não implementado |
| Testes | Jest (configurado, nenhum teste escrito) |
| Build | tsc → dist/ |
| Deploy | Nenhuma configuração (sem Docker, sem CI/CD) |
| .env.example | Existe mas está VAZIO |

### Stack de Dependências

**Produção:**
- express, cors, helmet, compression, morgan
- @prisma/client, ioredis
- jsonwebtoken, argon2
- zod (validação)
- multer, sharp (uploads/imagens)
- pino, pino-http, pino-pretty, winston (logging)
- express-rate-limit, express-slow-down
- uuid, dotenv

**Desenvolvimento:**
- typescript, tsx (watch mode)
- jest, ts-jest
- eslint, prettier
- prisma CLI

### Scripts Disponíveis

| Script | Comando | Status |
|--------|---------|--------|
| dev | tsx watch src/server.ts | ❌ QUEBRADO (server.ts com erro de sintaxe) |
| build | tsc | ❌ NÃO COMPILA (schema desincronizado) |
| start | node dist/server.js | ❌ Sem build |
| prisma:generate | prisma generate | ❌ Schema desatualizado |
| prisma:migrate | prisma migrate dev | ❌ Schema desatualizado |
| prisma:seed | tsx prisma/seed.ts | ❌ Usa modelos antigos |
| test | jest --passWithNoTests | ⚠️ Passa (sem testes) |
| lint | eslint src --ext .ts | ❓ Não verificado |

### Ponto de Entrada

**`src/server.ts`** — STUB QUEBRADO:
```typescript
import express from "express"
impor cors from "cors"  // <-- ERRO DE SINTAXE

const app = express()
app.use(cors())
app.use(express())  // <-- ERRO: deveria ser express.json()

app.get("/", (req, res) => {
    res.send("API ecommerce funcionando")
})

app.listen(3000, () => {
    console.log("servidor rodando")
})
```

**Problemas críticos:**
1. `impor` em vez de `import` — não compila
2. `app.use(express())` — deveria ser `express.json()`
3. Nenhuma rota real conectada
4. Nenhum middleware aplicado
5. Nenhum controller registrado

### Rotas Existentes

| Rota | Arquivo | Status |
|------|---------|--------|
| POST /forgot-password | modules/auth/auth.routes.ts | ⚠️ Existe mas NÃO está importada no server.ts |
| POST /reset-password | modules/auth/auth.routes.ts | ⚠️ Existe mas NÃO está importada no server.ts |
| (nenhuma outra rota registrada) | — | ❌ |

### Controllers Existentes (NÃO conectados)

| Controller | Métodos | Status |
|------------|---------|--------|
| AuthController | register, login, refresh, logout, changePassword, me | ✅ Código bem escrito, sem rota |
| CartController | get, addItem, updateItem, removeItem, clear | ✅ Código bem escrito, sem rota |
| ProductController | list, getBySlug, getById, create, update, delete, createVariant, updateVariant, updateStock | ✅ Código bem escrito, sem rota |

### Services Existentes

| Service | Funcionalidade | Status |
|---------|---------------|--------|
| AuthService | Register, Login, Refresh, Logout, ChangePassword | ✅ Bem implementado |
| ProductService | CRUD + Variantes + Estoque + Cache Redis | ✅ Bem implementado |
| CartService | Get, Add, Update, Remove, Clear | ✅ Bem implementado |
| OrderService | Create, GetMy, GetById, UpdateStatus, ListAll | ✅ Bem implementado |
| PaymentService | ProcessPayment (STUB), Webhook | ⚠️ Simulação sem gateway real |
| UploadService | Process images, attach to product/variant, delete, reorder | ✅ Bem implementado |
| AdminService | Dashboard stats, users, roles, audit, revenue | ✅ Bem implementado |

### Middlewares Existentes

| Middleware | Funcionalidade | Status |
|------------|---------------|--------|
| auth.middleware.ts | authenticate, requireRole, isAdmin, optionalAuth | ✅ Completo |
| errorHandler.ts | AppError, Zod, Prisma errors, 404 handler | ✅ Completo |
| rateLimiter.ts | global, auth, upload, webhook | ✅ Completo |
| upload.middleware.ts | Multer product/avatar storage + file filter | ✅ Completo |
| validate.ts | Zod validation para body/query/params | ✅ Completo |
| requestLogger.ts | Winston request logging | ✅ Completo |
| requireAuth.ts | Auth middleware ALTERNATIVO (módulo antigo) | ⚠️ Duplicado |
| requireAdmin.ts | Admin check ALTERNATIVO (módulo antigo) | ⚠️ Duplicado |
| mailer.ts | Nodemailer transporter | ⚠️ Config usa vars sem validação |
| token.ts | Crypto helpers para reset tokens | ✅ Simples |

### Prisma Schema vs. Código — DIVERGÊNCIA CRÍTICA

| Aspecto | Schema atual (prisma) | Código (services/repos) |
|---------|----------------------|------------------------|
| Product.sku | ❌ Não existe | ✅ Usado no ProductService |
| Product.basePrice | ❌ Não existe (usa `price`) | ✅ Usado |
| Product.salePrice | ❌ Não existe | ✅ Usado |
| Product.brand | ❌ Não existe | ✅ Usado |
| Product.isFeatured | ❌ Não existe | ✅ Usado |
| Product.tags | ❌ Não existe | ✅ Usado |
| Product.metaTitle/Desc | ❌ Não existe | ✅ Usado |
| Product.deletedAt | ❌ Não existe | ✅ Usado (soft delete) |
| Product.categoryId | ❌ Relação M:N | ✅ Usa relação 1:N |
| ProductVariant | ❌ NÃO EXISTE no schema | ✅ Usado extensivamente |
| Cart | ❌ NÃO EXISTE no schema | ✅ Cart + CartItem usados |
| CartItem | ❌ NÃO EXISTE no schema | ✅ Usado |
| Address | ❌ NÃO EXISTE no schema | ✅ Usado em Orders |
| Shipment | ❌ NÃO EXISTE no schema | ✅ Usado em OrderService |
| StockLog | ❌ NÃO EXISTE no schema | ✅ Usado |
| AuditLog | ❌ NÃO EXISTE no schema | ✅ Usado extensivamente |
| Image | ❌ Usa ProductImage simples | ✅ Usa modelo Image expandido |
| Payment fields | ⚠️ Parcial | ✅ Usa gatewayId, paidAt, failedAt etc |
| Order fields | ⚠️ Parcial (usa itemsValue) | ✅ Usa subtotal, orderNumber, cancelReason, shipment |
| User fields | ⚠️ Parcial | ✅ Usa phone, avatarUrl, isEmailVerified, deletedAt |
| RefreshToken | ⚠️ Usa tokenHash/jti | ✅ Usa token/isRevoked |
| Enums | PENDING/PAID/SHIPPED/DELIVERED/CANCELLED | ✅ + CONFIRMED, PROCESSING, REFUNDED |
| PaymentMethod enum | ❌ Não existe | ✅ Usado no OrderService |
| AuditAction enum | ❌ Não existe | ✅ Usado no AuditRepository |
| Role.SUPER_ADMIN | ❌ Não existe (só USER/ADMIN) | ✅ Usado no AdminService |

### Configuração

| Item | Status |
|------|--------|
| env.ts | ✅ Validação Zod completa com defaults |
| database.ts | ✅ Singleton Prisma com log queries |
| redis.ts | ✅ Completo com cache helpers |
| logger.ts | ✅ Winston com rotação de arquivos |

### Migrations

❌ **Nenhuma migration gerada** — o schema nunca foi executado contra um banco real.

### Seed

⚠️ **Existe mas usa modelo antigo** — referencia `price`, `stock`, `images` como array de strings (que não existe no schema). Não é compatível com o código dos services.

### Testes

❌ **Zero testes escritos** — Jest configurado mas `--passWithNoTests`.

### Documentação

❌ **README.md é template do GitHub** — não documenta o projeto.

---

## 2. FRONTEND — Qwerty Build Hub

### Informações Gerais

| Item | Valor |
|------|-------|
| Nome do projeto | vite_react_shadcn_ts |
| Versão | 0.0.0 |
| Linguagem | TypeScript |
| Framework | React 18.3 + Vite 5 |
| UI Kit | shadcn/ui + Tailwind CSS |
| Gerenciador de pacotes | bun (bun.lockb + bun.lock presentes), npm (package-lock.json) |
| Banco de dados | Nenhum (dados estáticos) |
| Estado global | React Context (Cart + Auth) |
| API Client | ❌ NÃO EXISTE |
| Autenticação | Stub demo (sem API calls) |
| Pagamentos | ❌ Não existe |
| Upload de imagens | ❌ Não existe |
| Frete | ❌ Não existe |
| Testes | Vitest + @testing-library/react + Playwright (1 test placeholder) |
| Build | Vite → dist/ |
| Deploy | Vercel (vercel.json com SPA rewrite) |
| Server port | 8080 (dev) |

### Stack de Dependências

**Produção:**
- react, react-dom, react-router-dom
- @tanstack/react-query
- ~30 componentes @radix-ui (shadcn/ui base)
- framer-motion
- react-hook-form + @hookform/resolvers
- zod
- lucide-react
- recharts
- date-fns
- sonner, vaul
- tailwind-merge, clsx, class-variance-authority
- embla-carousel-react, react-resizable-panels
- next-themes

**Desenvolvimento:**
- vite, @vitejs/plugin-react-swc
- typescript
- tailwindcss, postcss, autoprefixer
- eslint, typescript-eslint
- vitest, jsdom, @testing-library/jest-dom, @testing-library/react
- @playwright/test
- lovable-tagger

### Scripts Disponíveis

| Script | Comando | Status |
|--------|---------|--------|
| dev | vite | ✅ Funciona |
| build | vite build | ✅ Funciona |
| preview | vite preview | ✅ Funciona |
| lint | eslint . | ✅ Funciona |
| test | vitest run | ⚠️ Passa (1 test placeholder) |
| test:watch | vitest | ✅ Funciona |

### Rotas (React Router)

| Rota | Página | Funcionalidade |
|------|--------|---------------|
| / | HomePage | Hero, featured builds, popular products, reasons, CTA |
| /builder | BuilderPage | Montador de teclado interativo com validação de compatibilidade |
| /products | ProductsPage | Grid com filtros por categoria/marca + ordenação |
| /cart | CartPage | Lista de itens, quantidades, resumo, "Finalizar compra" (não funciona) |
| /login | LoginPage | Login + Register com validação Zod |
| /dashboard | DashboardPage | Painel do usuário com stats e builds salvas (mock) |
| /community | CommunityPage | Galeria de builds da comunidade |
| /about | AboutPage | Sobre o projeto |
| * | NotFound | 404 |

### Componentes Principais

**Layout:**
- Navbar — responsivo com menu mobile, badge do carrinho, login/logout
- Footer — informações do projeto

**Builder (Montador de Teclado):**
- BuilderPage — estado do build, validação em tempo real
- KeyboardPreview — visualização 3D/preview do teclado
- LayoutSelector — seleção de layout (60%, 65%, 75%, TKL, Full)
- CategoryCard — card de categoria de componente
- ProductCard — card de produto para seleção
- ProductModal — modal de detalhes
- ColorPicker — seleção de cor do case

**UI (shadcn/ui):**
- 49 componentes Radix/shadcn prontos

### Dados (ESTÁTICOS - sem API)

| Arquivo | Conteúdo |
|---------|----------|
| data/products.ts | 12 produtos com id, name, price, rating, category, brand, image, description |
| data/builderProducts.ts | 25 componentes para builder (switches, keycaps, PCBs, cases) |
| data/community.ts | Builds da comunidade |

### Contextos

| Contexto | Funcionalidade | Status |
|----------|---------------|--------|
| CartContext | addItem, removeItem, updateQuantity, clearCart, totals | ⚠️ Apenas useState (sem persistência, sem API) |
| AuthContext | login, register, logout | ⚠️ STUB DEMO (sem chamadas HTTP) |

### Utilitários

| Arquivo | Funcionalidade |
|---------|---------------|
| utils/compatibilidade.ts | Validação de compatibilidade de componentes do builder |
| lib/utils.ts | cn() helper (clsx + tailwind-merge) |
| hooks/use-mobile.tsx | Media query hook |
| hooks/use-toast.ts | Toast hook |

### Testes

| Tipo | Quantidade | Status |
|------|-----------|--------|
| Unit | 1 placeholder | ⚠️ `expect(true).toBe(true)` |
| Integration | 0 | ❌ |
| E2E | 0 | ❌ (Playwright instalado mas sem tests) |

### Deploy

- Vercel (vercel.json com SPA rewrite)
- Build command: `vite build`
- Output: `dist/`

---

## 3. DIAGNÓSTICO RESUMIDO

### Backend

| Aspecto | Avaliação |
|---------|-----------|
| Qualidade do código | ⭐⭐⭐⭐ — Services/controllers bem escritos |
| Funcionalidade | ⭐ — Nada funciona (server.ts quebrado, schema divergente) |
| Completude | ⭐⭐ — Lógica de negócio ~70% presente mas não conectada |
| Segurança | ⭐⭐⭐ — Boas práticas no código (argon2, rate limit, etc) |
| Testabilidade | ⭐ — Zero testes |
| Deploy readiness | ⭐ — Impossível fazer deploy |

### Frontend

| Aspecto | Avaliação |
|---------|-----------|
| Qualidade do código | ⭐⭐⭐⭐ — Bem componentizado, TypeScript correto |
| Funcionalidade | ⭐⭐⭐ — UI funciona mas sem backend (dados mock) |
| Completude da UI | ⭐⭐⭐ — Páginas principais existem, faltam checkout/pedidos |
| Integração | ⭐ — Zero integração com backend |
| Testes | ⭐ — 1 placeholder |
| Deploy readiness | ⭐⭐⭐⭐ — Pode ser deployado na Vercel como está |

### Integração

| Aspecto | Status |
|---------|--------|
| API client no frontend | ❌ Não existe |
| CORS configurado | ⚠️ Código existe no backend mas server.ts está quebrado |
| Rotas da API | ❌ Nenhuma rota registrada |
| Tipos compartilhados | ❌ Nenhum |
| Contrato da API | ❌ Nenhum |
| Auth flow end-to-end | ❌ Não conectado |
| Dados dinâmicos | ❌ Frontend usa dados estáticos |

---

## 4. BLOQUEADORES P0

1. **Backend não inicia** — server.ts com erro de sintaxe (`impor`)
2. **Prisma schema desatualizado** — não reflete os modelos usados pelo código
3. **Nenhuma rota conectada** — controllers existem mas não são acessíveis
4. **Frontend não conecta ao backend** — nenhum API client
5. **Nenhum banco de dados configurável** — .env.example está vazio
6. **Sem lock file no backend** — dependências não são reproduzíveis
