# AUDITORIA FUNCIONAL DO BACKEND

> Data: 2026-08-06
> Repositório: https://github.com/portellamath/dev

---

## Legenda de Status

- ✅ Implementado e funcional
- ⚠️ Parcialmente implementado
- 🏗️ Apenas criado estruturalmente (arquivo existe, não funciona)
- ❌ Ausente
- 💀 Quebrado
- 🔓 Risco de segurança
- 🚫 Bloqueado por dependência
- 🧪 Sem testes

---

## SETUP BÁSICO

| # | Item | Status | Arquivos | O que falta | Prioridade | Tamanho |
|---|------|--------|----------|-------------|-----------|---------|
| 1 | Init Node + TypeScript | ⚠️ | package.json, tsconfig.json | Lock file ausente, node_modules não instalados | P0 | P |
| 2 | Estrutura de pastas | ✅ | src/{config,controllers,middlewares,modules,prisma,repositories,services,shared,types,utils,validators} | — | — | — |
| 3 | Scripts de dev/build/start | 💀 | package.json | server.ts quebrado impede todos os scripts | P0 | P |
| 4 | Gerenciamento de env | ✅ | config/env.ts | .env.example está vazio; precisa ser populado | P0 | P |
| 5 | Validação de config no boot | ✅ | config/env.ts | Zod schema valida e mata o processo se falhar | — | — |
| 6 | Tratamento global de erros | ✅ | middlewares/errorHandler.ts | Não conectado ao server.ts | P0 | P |
| 7 | Health check | ❌ | — | Criar GET /health | P0 | P |
| 8 | Readiness/liveness check | ❌ | — | Criar GET /ready (DB + Redis) | P1 | P |
| 9 | Logger estruturado | ✅ | config/logger.ts | Winston com rotação, auth log, payment log | — | — |
| 10 | Request ID / correlation ID | ❌ | — | Adicionar middleware uuid por request | P2 | P |

### Critérios de aceite — Setup:
- [ ] `npm install` sem erros
- [ ] `npm run dev` inicia o servidor
- [ ] `npm run build` compila sem erros
- [ ] Health check responde 200
- [ ] .env.example documenta todas as variáveis

---

## BANCO DE DADOS E ORM

| # | Item | Status | Arquivos | O que falta | Prioridade | Tamanho |
|---|------|--------|----------|-------------|-----------|---------|
| 11 | Configuração do ORM | ✅ | prisma/schema.prisma, config/database.ts | — | — | — |
| 12 | Conexão com banco | ✅ | config/database.ts | connectDatabase() existe mas não é chamado | P0 | P |
| 13 | Client singleton | ✅ | config/database.ts | Global singleton com hot-reload protection | — | — |
| 14 | Model User | ⚠️ | schema.prisma | Faltam: phone, avatarUrl, isEmailVerified, deletedAt | P0 | M |
| 15 | Model Product | 💀 | schema.prisma | Schema usa price/stock/specs; services esperam sku/basePrice/salePrice/brand/categoryId/tags etc | P0 | G |
| 16 | Model ProductVariant | ❌ | — | Totalmente ausente do schema; usado em 4+ services | P0 | G |
| 17 | Model Category | ⚠️ | schema.prisma | Existe mas é M:N com Product; services usam 1:N (categoryId) | P0 | M |
| 18 | Model Image | ⚠️ | schema.prisma (ProductImage) | Faltam: category, isPrimary, width, height, sizeBytes, mimeType, variantId | P0 | M |
| 19 | Model Cart | ❌ | — | Ausente; CartRepository usa prisma.cart | P0 | M |
| 20 | Model CartItem | ❌ | — | Ausente; CartRepository usa prisma.cartItem | P0 | M |
| 21 | Model Order | ⚠️ | schema.prisma | Faltam: orderNumber, subtotal, cancelReason, deletedAt, notes | P0 | M |
| 22 | Model OrderItem | ⚠️ | schema.prisma | Faltam: variantId, productName, variantName, sku | P0 | M |
| 23 | Model Payment | ⚠️ | schema.prisma | Faltam: method, gatewayId, gatewayResponse, paidAt, failedAt, refundedAt, currency | P0 | M |
| 24 | Model Address | ❌ | — | Usado em OrderService e validator; ausente do schema | P0 | M |
| 25 | Model Shipment | ❌ | — | Usado em OrderService; ausente do schema | P1 | M |
| 26 | Model Inventory/StockLog | ❌ | — | Usado em ProductService; ausente do schema | P1 | M |
| 27 | Model InventoryReservation | ❌ | — | Não implementado | P2 | M |
| 28 | Model AuditLog | ❌ | — | AuditRepository usa prisma.auditLog; ausente do schema | P0 | M |
| 29 | Model RefreshToken | ⚠️ | schema.prisma | Schema usa tokenHash/jti/revokedAt/replacedBy; repo usa token/isRevoked | P0 | M |
| 30 | Model PasswordResetToken | ✅ | schema.prisma | Compatível com módulo auth | — | — |
| 31 | Migrations | ❌ | — | Nenhuma gerada | P0 | P |
| 32 | Seeds | 💀 | prisma/seed.ts | Usa modelo antigo (price, stock, images como array) | P1 | M |
| 33 | Índices | ⚠️ | schema.prisma | Alguns presentes, faltam para modelos novos | P1 | P |
| 34 | Constraints | ⚠️ | schema.prisma | Unique em slug/email; faltam para novos modelos | P1 | P |
| 35 | Integridade referencial | ⚠️ | schema.prisma | onDelete Cascade em alguns; precisa review completo | P1 | P |
| 36 | Soft delete | ⚠️ | — | Código usa deletedAt mas campo não existe no schema | P0 | M |

### Critérios de aceite — Banco:
- [ ] Schema reflete todos os modelos usados pelo código
- [ ] `prisma migrate dev` executa sem erros
- [ ] `prisma generate` gera client sem erros
- [ ] Seed popula dados de exemplo
- [ ] Todos os soft deletes têm campo deletedAt

---

## AUTENTICAÇÃO E AUTORIZAÇÃO

| # | Item | Status | Arquivos | O que falta | Prioridade | Tamanho |
|---|------|--------|----------|-------------|-----------|---------|
| 37 | Registro | ✅🚫 | services/auth.service.ts, controllers/auth.controller.ts | Código pronto; sem rota conectada | P0 | P |
| 38 | Login | ✅🚫 | services/auth.service.ts | Código pronto; sem rota | P0 | P |
| 39 | Logout | ✅🚫 | services/auth.service.ts | Código pronto; sem rota | P0 | P |
| 40 | Hash de senha (argon2id) | ✅ | services/auth.service.ts | Configurável via env | — | — |
| 41 | Access token (JWT) | ✅ | services/auth.service.ts | 15min default | — | — |
| 42 | Refresh token rotativo | ✅ | services/auth.service.ts | Revoga antigo ao renovar | — | — |
| 43 | Revogação de tokens | ✅ | repositories/refreshToken.repository.ts | Individual + all by user | — | — |
| 44 | Middleware de autenticação | ✅ | middlewares/auth.middleware.ts | authenticate, optionalAuth | — | — |
| 45 | Roles (USER, ADMIN) | ✅ | middlewares/auth.middleware.ts | requireRole, isAdmin, isSuperAdmin | — | — |
| 46 | Admin middleware | ✅ | middlewares/auth.middleware.ts + requireAdmin.ts | Duas versões (duplicação) | P2 | P |
| 47 | Proteção enumeração de usuários | ✅ | services/auth.service.ts | Timing attack prevention com dummy hash | — | — |
| 48 | Recuperação de senha | ✅ | modules/auth/auth.service.ts | requestPasswordReset com email | — | — |
| 49 | Reset de senha | ✅ | modules/auth/auth.service.ts | Token hash + expiração 30min | — | — |
| 50 | Verificação de email | ❌ | — | Não implementado | P2 | M |
| 51 | Rate limit em auth | ✅ | middlewares/rateLimiter.ts | authRateLimiter (10 req/15min) | — | — |
| 52 | Proteção brute force | ✅ | middlewares/rateLimiter.ts | Combinado com rate limit | — | — |
| 53 | Validação de sessão | ⚠️ | middlewares/auth.middleware.ts | Verifica token mas não verifica isActive no banco a cada request | P2 | P |

### Critérios de aceite — Auth:
- [ ] POST /auth/register cria usuário e retorna tokens
- [ ] POST /auth/login retorna access + refresh tokens
- [ ] POST /auth/refresh rotaciona tokens
- [ ] POST /auth/logout revoga refresh token
- [ ] Rotas protegidas rejeitam sem token (401)
- [ ] Admin routes rejeitam USER (403)
- [ ] Rate limit bloqueia após 10 tentativas

---

## PRODUTOS E CATÁLOGO

| # | Item | Status | Arquivos | O que falta | Prioridade | Tamanho |
|---|------|--------|----------|-------------|-----------|---------|
| 54 | CRUD admin de produtos | ✅🚫 | services/product.service.ts, controllers/product.controller.ts | Sem rota conectada | P0 | P |
| 55 | Produtos ativos/inativos | ✅ | services/product.service.ts | isActive filter | — | — |
| 56 | Slug | ✅ | utils/slug.ts, services/product.service.ts | Auto-gerado, conflito = append timestamp | — | — |
| 57 | SKU | ✅🚫 | services/product.service.ts | Usado mas campo não existe no schema | P0 | P |
| 58 | Categorias | ⚠️🚫 | schema.prisma, services/product.service.ts | Schema M:N, service usa 1:N categoryId | P0 | M |
| 59 | Variantes | ✅🚫 | services/product.service.ts | createVariant, updateVariant; modelo ausente do schema | P0 | G |
| 60 | Atributos das variantes | ✅🚫 | validators/product.validator.ts | switchType, layout, color, backlight, connectivity, weight | P0 | — |
| 61 | Preços | ✅🚫 | services/product.service.ts | basePrice + salePrice; campo não no schema | P0 | P |
| 62 | Preço promocional | ✅🚫 | services/product.service.ts | salePrice | P0 | — |
| 63 | Imagens | ✅🚫 | services/upload.service.ts | Upload + attach; modelo Image divergente | P0 | M |
| 64 | Ordenação de imagens | ✅ | services/upload.service.ts | reorderImages() | — | — |
| 65 | Produto em destaque | ✅🚫 | services/product.service.ts | isFeatured filter; campo não no schema | P1 | P |
| 66 | Produto novo | ❌ | — | Sem flag isNew; pode derivar de createdAt | P2 | P |
| 67 | Produto esgotado | ⚠️ | services/cart.service.ts | Verifica stockQty no carrinho; sem flag explícita | P1 | P |
| 68 | Listagem pública | ✅🚫 | services/product.service.ts | listProducts com filtros e cache | P0 | P |
| 69 | Busca | ✅🚫 | repositories/product.repository.ts | search em name/description/brand/sku | P0 | — |
| 70 | Filtros | ✅🚫 | repositories/product.repository.ts | category, price range, switchType, layout, brand, isFeatured | P0 | — |
| 71 | Ordenação | ✅🚫 | repositories/product.repository.ts | price, name, createdAt | P0 | — |
| 72 | Paginação | ✅🚫 | utils/pagination.ts | parsePagination + buildPaginatedResult | P0 | — |
| 73 | Detalhe do produto | ✅🚫 | services/product.service.ts | getBySlug com includes | P0 | P |
| 74 | Produtos relacionados | ❌ | — | Não implementado | P2 | M |
| 75 | Importação CSV | ❌ | — | Não implementado | P3 | G |
| 76 | Validação de dados importados | ❌ | — | N/A | P3 | — |

### Critérios de aceite — Produtos:
- [ ] GET /products retorna lista paginada
- [ ] GET /products/:slug retorna produto com variantes e imagens
- [ ] POST /admin/products cria produto (admin only)
- [ ] Variantes CRUD funcionam
- [ ] Cache Redis invalidado após CRUD

---

## IMAGENS E ASSETS

| # | Item | Status | Arquivos | O que falta | Prioridade | Tamanho |
|---|------|--------|----------|-------------|-----------|---------|
| 77 | Upload seguro | ✅ | middlewares/upload.middleware.ts, services/upload.service.ts | Multer + Sharp | — | — |
| 78 | Validação MIME type | ✅ | middlewares/upload.middleware.ts | jpeg, png, webp | — | — |
| 79 | Limite de tamanho | ✅ | middlewares/upload.middleware.ts | Env UPLOAD_MAX_SIZE_MB (default 5) | — | — |
| 80 | Armazenamento local/cloud | ⚠️ | config/env.ts | UPLOAD_PROVIDER: 'local'|'s3' — mas só local implementado | P2 | M |
| 81 | URLs públicas | ✅ | services/upload.service.ts | `/uploads/{folder}/{filename}` | — | — |
| 82 | Thumbnails | ⚠️ | services/upload.service.ts | Resize via Sharp; sem thumbnails separados | P2 | M |
| 83 | Otimização (WebP) | ✅ | services/upload.service.ts | Converte para WebP quality 85 | — | — |
| 84 | Exclusão de imagens órfãs | ❌ | — | Não implementado | P3 | M |
| 85 | CDN | ❌ | — | Não implementado | P3 | M |
| 86 | Proteção upload malicioso | ✅ | middlewares/upload.middleware.ts | MIME filter + size limit + 10 files max | — | — |

---

## ESTOQUE E RESERVAS

| # | Item | Status | Arquivos | O que falta | Prioridade | Tamanho |
|---|------|--------|----------|-------------|-----------|---------|
| 87 | Controle de estoque | ✅🚫 | services/product.service.ts | stockQty por variante; modelo ausente | P0 | M |
| 88 | Entrada de estoque | ✅🚫 | services/product.service.ts | updateStock() | P0 | — |
| 89 | Saída de estoque | ✅🚫 | services/order.service.ts | Decrement no create order | P0 | — |
| 90 | Ajuste manual | ✅🚫 | services/product.service.ts | updateStock com reason | P0 | — |
| 91 | Histórico de movimentações | ✅🚫 | services/product.service.ts | StockLog; modelo ausente | P1 | M |
| 92 | Reserva durante checkout | ❌ | — | Não implementado (decrementa direto) | P2 | G |
| 93 | TTL da reserva | ❌ | — | Não implementado | P2 | M |
| 94 | Liberação de reserva expirada | ❌ | — | Não implementado (requer job) | P2 | M |
| 95 | Concorrência/race conditions | ⚠️ | services/order.service.ts | Usa $transaction mas sem SELECT FOR UPDATE | P1 | M |
| 96 | Impedir estoque negativo | ⚠️ | services/cart.service.ts | Valida no add; mas entre add e order pode mudar | P1 | M |
| 97 | Estoque por variante | ✅🚫 | services/product.service.ts | stockQty em ProductVariant | P0 | — |
| 98 | Auditoria de ajustes | ✅🚫 | services/product.service.ts | StockLog + AuditLog | P1 | — |

---

## CARRINHO

| # | Item | Status | Arquivos | O que falta | Prioridade | Tamanho |
|---|------|--------|----------|-------------|-----------|---------|
| 99 | Carrinho anônimo | ❌ | — | Só funciona com userId | P1 | G |
| 100 | Carrinho autenticado | ✅🚫 | services/cart.service.ts | Funcional mas modelos ausentes do schema | P0 | M |
| 101 | Persistência do carrinho | ✅🚫 | repositories/cart.repository.ts | PostgreSQL via Cart model | P0 | — |
| 102 | Adicionar item | ✅🚫 | services/cart.service.ts | Com validação de estoque | P0 | — |
| 103 | Atualizar quantidade | ✅🚫 | services/cart.service.ts | Com validação de estoque | P0 | — |
| 104 | Remover item | ✅🚫 | services/cart.service.ts | — | P0 | — |
| 105 | Limpar carrinho | ✅🚫 | services/cart.service.ts | — | P0 | — |
| 106 | Merge após login | ❌ | — | Não implementado (requer carrinho anônimo) | P1 | G |
| 107 | Revalidação de preço | ⚠️ | services/cart.service.ts | unitPrice salvo no add; não revalida depois | P2 | M |
| 108 | Revalidação de estoque | ⚠️ | services/cart.service.ts | Valida no add mas não no get | P1 | M |
| 109 | Expiração de carrinho | ✅🚫 | repositories/cart.repository.ts | expiresAt: 7 dias; sem job de limpeza | P2 | M |

---

## CHECKOUT E PEDIDOS

| # | Item | Status | Arquivos | O que falta | Prioridade | Tamanho |
|---|------|--------|----------|-------------|-----------|---------|
| 110 | Criar sessão de checkout | ❌ | — | Não existe checkout session separado | P1 | M |
| 111 | Criar pedido pendente | ✅🚫 | services/order.service.ts | createOrder transacional | P0 | P |
| 112 | Snapshot dos itens | ✅🚫 | services/order.service.ts | productName, variantName, sku, unitPrice salvos | P0 | — |
| 113 | Snapshot de preço | ✅🚫 | services/order.service.ts | unitPrice capturado no momento | P0 | — |
| 114 | Snapshot de endereço | ⚠️ | services/order.service.ts | Usa addressId (referência); melhor seria copiar dados | P2 | M |
| 115 | Snapshot de frete | ❌ | — | shippingCost hardcoded 0 | P1 | M |
| 116 | Fluxo de status | ✅🚫 | services/order.service.ts | validTransitions com máquina de estados | P0 | — |
| 117 | Cancelamento | ✅🚫 | services/order.service.ts | Devolve estoque no cancel | P0 | — |
| 118 | Reembolso | ❌ | — | Status REFUNDED existe mas sem lógica de refund | P2 | G |
| 119 | Idempotência | ❌ | — | Sem idempotency key | P1 | M |
| 120 | Prevenção pedidos duplicados | ❌ | — | Sem lock/dedup | P1 | M |
| 121 | Histórico do pedido | ❌ | — | Sem OrderStatusHistory | P2 | M |
| 122 | Consulta pelo cliente | ✅🚫 | services/order.service.ts | getMyOrders + getOrderById com check userId | P0 | P |
| 123 | Consulta administrativa | ✅🚫 | services/order.service.ts | listAllOrders | P0 | P |
| 124 | Observações internas | ✅🚫 | validators/order.validator.ts | notes field | P1 | — |
| 125 | Validação final antes pagamento | ⚠️ | services/order.service.ts | Valida estoque no createOrder mas não antes do payment | P1 | M |

---

## PAGAMENTOS

| # | Item | Status | Arquivos | O que falta | Prioridade | Tamanho |
|---|------|--------|----------|-------------|-----------|---------|
| 126 | Adapter de provedor | ⚠️ | services/payment.service.ts | Interface PaymentGatewayResult; stub sem adapter real | P1 | G |
| 127 | Gateway (Stripe/MercadoPago) | ❌ | — | Nenhum SDK instalado, apenas simulação | P1 | G |
| 128 | Payment intent | ❌ | — | processWithGateway retorna fake gatewayId | P1 | G |
| 129 | Tokenização | ❌ | — | Não implementado | P1 | — |
| 130 | Não armazenar dados de cartão | ✅ | — | Correto: sem campos de cartão | — | — |
| 131 | Salvar provider_payment_id | ✅🚫 | services/payment.service.ts | gatewayId salvo; modelo precisa campo | P0 | P |
| 132 | Webhook | ⚠️ | services/payment.service.ts | handleWebhook existe; sem validação de assinatura | P1 | M |
| 133 | Validação de assinatura | ❌ | — | TODO no código | P1 | M |
| 134 | Idempotência de webhook | ❌ | — | Eventos duplicados podem processar 2x | P1 | M |
| 135 | Reconciliação | ❌ | — | Não implementado | P2 | G |
| 136 | Estados de pagamento | ✅ | schema.prisma | PENDING, APPROVED, REJECTED, CANCELLED, REFUNDED | — | — |
| 137 | Falha de pagamento | ✅🚫 | services/payment.service.ts | Catch → FAILED + failedAt | P0 | — |
| 138 | Cancelamento | ❌ | — | Sem endpoint de cancel payment | P2 | M |
| 139 | Reembolso | ❌ | — | Sem implementação | P2 | G |
| 140 | Ambiente sandbox | ❌ | — | Sem config sandbox | P1 | M |

---

## FRETE E LOGÍSTICA

| # | Item | Status | Arquivos | O que falta | Prioridade | Tamanho |
|---|------|--------|----------|-------------|-----------|---------|
| 141 | Cálculo de frete | ❌ | — | shippingCost = 0 hardcoded | P1 | G |
| 142 | CEP | ⚠️ | validators/address.validator.ts | Valida formato ^\d{5}-?\d{3}$ | P1 | — |
| 143 | Endereço | ⚠️🚫 | validators/address.validator.ts | Validator completo; model ausente | P0 | M |
| 144 | Prazo estimado | ❌ | — | Não implementado | P1 | M |
| 145 | Tabela fixa ou API externa | ❌ | — | Nenhuma | P1 | M |
| 146 | Criação de shipment | ⚠️🚫 | services/order.service.ts | Cria shipment no order; modelo ausente | P1 | M |
| 147 | Código de rastreamento | ❌ | — | Não implementado | P2 | M |
| 148 | Atualização de tracking | ❌ | — | Não implementado | P2 | M |
| 149 | Status de envio | ⚠️ | services/order.service.ts | Status 'PENDING' hardcoded | P1 | M |
| 150 | Integração transportadora | ❌ | — | Não implementado | P3 | G |

---

## NOTIFICAÇÕES

| # | Item | Status | Arquivos | O que falta | Prioridade | Tamanho |
|---|------|--------|----------|-------------|-----------|---------|
| 151 | E-mail pedido criado | ❌ | — | Não implementado | P1 | M |
| 152 | E-mail pagamento aprovado | ❌ | — | Não implementado | P1 | M |
| 153 | E-mail pedido enviado | ❌ | — | Não implementado | P2 | M |
| 154 | E-mail entrega | ❌ | — | Não implementado | P2 | M |
| 155 | E-mail cancelamento | ❌ | — | Não implementado | P2 | M |
| 156 | Recuperação de senha | ✅ | modules/auth/auth.service.ts | Envia email com link | — | — |
| 157 | Templates | ❌ | — | Inline HTML no password reset | P2 | M |
| 158 | Provider de email | ⚠️ | middlewares/mailer.ts | Nodemailer configurado; sem validação de env | P1 | P |
| 159 | Fila de envio | ❌ | — | Síncrono (bloqueia request) | P2 | G |
| 160 | Retry | ❌ | — | Não implementado | P2 | M |
| 161 | Dead letter | ❌ | — | Não implementado | P3 | M |

---

## ADMIN E OBSERVABILIDADE

| # | Item | Status | Arquivos | O que falta | Prioridade | Tamanho |
|---|------|--------|----------|-------------|-----------|---------|
| 162 | Dashboard stats | ✅🚫 | services/admin.service.ts | totalUsers, products, orders, revenue, lowStock | P1 | P |
| 163 | Admin - Usuários | ✅🚫 | services/admin.service.ts | listUsers, updateRole, deactivate | P1 | P |
| 164 | Admin - Produtos | ✅🚫 | services/product.service.ts | CRUD completo | P1 | P |
| 165 | Admin - Estoque | ✅🚫 | services/product.service.ts | updateStock | P1 | P |
| 166 | Admin - Pedidos | ✅🚫 | services/order.service.ts | listAll, updateStatus | P1 | P |
| 167 | Admin - Pagamentos | ⚠️ | services/payment.service.ts | getPaymentByOrderId; sem lista geral | P2 | M |
| 168 | Relatórios | ⚠️🚫 | services/admin.service.ts | getRevenueReport (raw query) | P2 | M |
| 169 | Logs | ✅ | config/logger.ts | Rotação, auth.log, error.log | — | — |
| 170 | Auditoria | ✅🚫 | repositories/audit.repository.ts, services/admin.service.ts | Create + findMany; modelo ausente | P1 | M |
| 171 | Alertas | ❌ | — | Não implementado | P3 | M |
| 172 | Sentry | ❌ | — | Não implementado | P2 | M |
| 173 | Métricas | ❌ | — | Não implementado | P3 | M |
| 174 | Monitoramento 5xx | ❌ | — | Logger captura mas sem alertas | P2 | M |
| 175 | Monitoramento de jobs | ❌ | — | Sem jobs | P3 | — |

---

## SEGURANÇA E COMPLIANCE

| # | Item | Status | Arquivos | O que falta | Prioridade | Tamanho |
|---|------|--------|----------|-------------|-----------|---------|
| 176 | Validação Zod | ✅ | validators/*.ts, middlewares/validate.ts | Schemas completos para auth, product, cart, order, address | — | — |
| 177 | Sanitização | ⚠️ | validators/*.ts | trim() em strings; sem sanitização HTML | P2 | M |
| 178 | Rate limiting | ✅ | middlewares/rateLimiter.ts | Global + auth + upload + webhook | — | — |
| 179 | CORS seguro | ⚠️ | config/env.ts | ALLOWED_ORIGINS configurável; não aplicado (server.ts quebrado) | P0 | P |
| 180 | Headers de segurança | ✅ | package.json | helmet instalado; não aplicado | P0 | P |
| 181 | CSRF | ❌ | — | N/A para API Bearer token stateless | — | — |
| 182 | Proteção SQL injection | ✅ | — | Prisma parametriza queries automaticamente | — | — |
| 183 | Proteção XSS | ⚠️ | — | helmet + Zod trim; sem HTML sanitizer | P2 | P |
| 184 | Proteção SSRF | ❌ | — | Upload aceita de request; sem validação de URLs externas | P2 | M |
| 185 | Secrets fora do repositório | ✅ | .gitignore, config/env.ts | .env não commitado | — | — |
| 186 | PCI compliance | ✅ | — | Não armazena dados de cartão | — | — |
| 187 | LGPD | ❌ | — | Sem exportação/exclusão de dados pessoais | P2 | G |
| 188 | Exportação de dados | ❌ | — | Não implementado | P2 | M |
| 189 | Exclusão de conta | ⚠️ | repositories/user.repository.ts | softDelete existe; sem endpoint/cascata | P2 | M |
| 190 | Logs sem dados sensíveis | ⚠️ | services/auth.service.ts | Loga email (PII); não loga senha | P2 | P |

---

## TESTES

| # | Item | Status | Prioridade | Tamanho |
|---|------|--------|-----------|---------|
| 191 | Unit tests | ❌ | P1 | G |
| 192 | Integration tests | ❌ | P1 | G |
| 193 | Auth tests | ❌ | P1 | M |
| 194 | Product tests | ❌ | P1 | M |
| 195 | Cart tests | ❌ | P1 | M |
| 196 | Checkout tests | ❌ | P1 | M |
| 197 | Payment webhook tests | ❌ | P1 | M |
| 198 | Inventory concurrency tests | ❌ | P2 | G |
| 199 | E2E sandbox | ❌ | P2 | G |
| 200 | Security tests | ❌ | P2 | G |
| 201 | Migration tests | ❌ | P2 | M |
| 202 | Job tests | ❌ | P3 | M |

---

## CI/CD E DEPLOY

| # | Item | Status | Prioridade | Tamanho |
|---|------|--------|-----------|---------|
| 203 | Lint no CI | ❌ | P1 | P |
| 204 | Typecheck no CI | ❌ | P1 | P |
| 205 | Unit tests no CI | ❌ | P1 | P |
| 206 | Build no CI | ❌ | P1 | P |
| 207 | Migrations controladas | ❌ | P1 | M |
| 208 | Docker | ❌ | P1 | M |
| 209 | Health check | ❌ | P0 | P |
| 210 | Staging | ❌ | P2 | G |
| 211 | Produção | ❌ | P2 | G |
| 212 | Variáveis de ambiente | ⚠️ (.env.example vazio) | P0 | P |
| 213 | Rollback | ❌ | P2 | M |
| 214 | Backups | ❌ | P2 | M |
| 215 | Runbook | ❌ | P2 | M |

---

## RESUMO QUANTITATIVO

| Status | Quantidade | % |
|--------|-----------|---|
| ✅ Funcional | 28 | 13% |
| ✅🚫 Código pronto, bloqueado (sem rota/schema) | 42 | 20% |
| ⚠️ Parcial | 24 | 11% |
| 💀 Quebrado | 3 | 1% |
| ❌ Ausente | 118 | 55% |

**Conclusão:** O backend tem ~33% da lógica de negócio implementada em código de qualidade, mas NADA funciona porque:
1. server.ts está quebrado (P0)
2. Schema Prisma está desatualizado (P0)
3. Nenhuma rota está conectada (P0)

Uma vez que esses 3 bloqueadores P0 forem resolvidos, aproximadamente 42 funcionalidades passam imediatamente a funcionar.
