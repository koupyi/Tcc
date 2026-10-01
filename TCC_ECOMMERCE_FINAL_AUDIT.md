# TCC E-COMMERCE FINAL AUDIT — Qwerty Build Hub

> E-commerce de teclados mecânicos personalizados/customizados
> Auditoria técnica, funcional, visual e acadêmica
> Data: 2026-09-09
> Projeto canônico auditado: `/home/matheus-portella/tcc/qwerty-build-hub` (repo GitHub: `LynnxLinux/qwerty-build-hub`)
> Observação: os diretórios `backend/`, `frontend/` e `dev/` na raiz do workspace são **cópias antigas** (split) e foram ignorados. Toda a auditoria refere-se a `qwerty-build-hub/`.

---

## 1. VEREDITO

```
READY_WITH_GAPS
```

O sistema inicia, o fluxo de compra completo funciona ponta a ponta, a personalização de teclado funciona ponta a ponta e é persistida no pedido (como itens de linha com snapshot de preço), e **não há vulnerabilidades críticas nem bloqueadores P0**. As lacunas que faltam são de acabamento e de demonstração — principalmente a **ausência das telas administrativas de gestão** (o backend tem tudo, o frontend só tem o dashboard), uma **página `/dashboard` com dados falsos**, o **CI quebrado**, e a **documentação acadêmica formal ausente**. Nada disso impede a apresentação, mas o item admin precisa ser resolvido para demonstrar com credibilidade que "a loja pode ser operada".

---

## 2. NOTA ESTIMADA DE PRONTIDÃO

```
Overall: 82/100

Frontend:               8/10
Backend:                9.5/10
Database:               9.5/10
Authentication:         9/10
Products:               8/10
Customization:          9/10
Cart:                   9/10
Checkout:               8.5/10
Admin:                  5/10
Academic/Presentation:  6/10
```

**Justificativa da nota**

- **Backend (9.5)** e **Database (9.5)**: arquitetura de nível profissional. Prisma + PostgreSQL, dinheiro em `Decimal(10,2)`, snapshots de preço no `OrderItem`, snapshot de endereço no `Shipment`, idempotência de pagamento, `SELECT FOR UPDATE` no estoque, máquina de estados de pedido, LGPD (export + anonimização). 250 testes de backend.
- **Customization (9)**: builder de 8 etapas com preço em tempo real, filtro de compatibilidade real, invalidação em cascata e revalidação server-side. Perde 1 ponto porque o "agrupamento" do build não é persistido como entidade no pedido (aparece como itens separados).
- **Authentication (9)**: argon2id, JWT verificado no servidor, rotação de refresh token, RBAC, login em tempo constante. Perde 1 ponto por ter dois sistemas de auth coexistindo (um pouco de código morto).
- **Admin (5)**: **o backend admin é completo e testado, mas o frontend admin é só o dashboard** — não há telas de gestão de produtos/pedidos/estoque/status. Maior lacuna funcional.
- **Academic/Presentation (6)**: excelente trilha de engenharia (docs de fases), mas falta o documento acadêmico formal (problema, objetivos, RF/RNF, DER, casos de uso) e o README subvende/mente sobre testes e CI.

---

## 3. RESUMO EXECUTIVO

O que está bom: a espinha dorsal do e-commerce é sólida e defensável. O cliente consegue navegar no catálogo, personalizar um teclado no builder (montando com componentes reais — case, PCB, plate, switch, keycaps e extras), ver o preço mudar em tempo real, adicionar ao carrinho (como visitante ou logado), fazer checkout com endereço e frete, criar o pedido e receber um PIX (sandbox), e ver o pedido no histórico com os componentes detalhados. A segurança é forte: preço é impossível de manipular (o servidor sempre recalcula a partir do banco), não há IDOR (cada endpoint checa dono/role), senhas usam argon2id, e não há segredos comitados. Testes reais: 250 no backend (249 passam; 1 é flake de timing) e 126 no frontend (todos passam). Build e typecheck passam nos dois lados.

O que está incompleto: o **painel administrativo no frontend é só um dashboard de contadores** — os cards "Produtos/Pedidos/Categorias/Usuários" levam de volta ao próprio dashboard porque as telas de gestão não existem (embora o backend tenha todos os endpoints prontos e testados). Existe uma página `/dashboard` órfã com dados **falsos hardcoded** que pode envergonhar na banca se aberta. O CI do GitHub está quebrado (caminho `backend/backend` errado). O README subvende os testes e afirma "CI/CD PASS" indevidamente. Falta a documentação acadêmica formal do TCC.

Maior risco: abrir um card do admin durante a demonstração e cair no dashboard de novo (parece quebrado), ou abrir `/dashboard` e mostrar dados falsos.

Quanto falta: nenhum P0. Com ~2 a 4 dias de trabalho focado (telas admin mínimas + remover página falsa + consertar CI + escrever o capítulo acadêmico), o projeto passa para `READY_FOR_PRESENTATION`.

---

## 4. ARQUITETURA ENCONTRADA

```
Frontend:    React 18 + Vite 5 + TypeScript + Tailwind CSS + shadcn/ui (Radix)
             React Router v6, Context API (Auth, Cart, Favorites), TanStack Query
             Vitest + Testing Library (Playwright instalado, sem specs E2E)
Backend:     Node.js + TypeScript + Express 4 + Prisma 5
             Redis + BullMQ (jobs/notificações), Zod (validação),
             Helmet, CORS, compression, rate limiting, Pino/Winston (logs)
Database:    PostgreSQL 16 (via Prisma ORM)
ORM:         Prisma 5 (schema em src/prisma/schema.prisma, 5 migrations)
Auth:        JWT (access 15m + refresh 7d, rotação), Argon2id, RBAC (USER/ADMIN/SUPER_ADMIN)
Storage:     Upload local (multer + sharp); provider S3 previsto por env (não usado no MVP)
Payments:    Mercado Pago PIX — SANDBOX por padrão (SandboxPixProvider);
             MercadoPagoProvider ativado só se MERCADOPAGO_ACCESS_TOKEN definido
Deployment:  Docker Compose (postgres 55432, redis 56379, backend 3000, worker,
             frontend/nginx 8080, profile "migration"). Frontend com vercel.json.
             CI em .github/workflows/ci.yml (atualmente QUEBRADO — ver P2)
```

Modelo de personalização (importante): um "teclado personalizado" é montado no **Builder** como uma composição de componentes **reais do catálogo** (categorias: `case`, `pcb`, `plate`, `switch`, `keycap` obrigatórios; `extra` opcional). Cada componente é um `ProductVariant` real com preço e estoque reais. Existe também a entidade `CommunityBuild` (builds prontas da comunidade, também compostas de produtos reais, com "Montar igual" que pré-preenche o builder).

---

## 5. FUNCIONALIDADES

| Funcionalidade | Status | Evidência | Problemas |
|---|---|---|---|
| Cadastro / Login / Logout | PASS | `auth.service.ts`, `auth.routes.ts`, `LoginPage.tsx`, testes `integration`/`security-lgpd` | — |
| Refresh token / sessão | PASS | `AuthContext.tsx` (bootstrap + refresh), `refreshTokens()` | — |
| Catálogo (lista + busca + filtro + paginação) | PASS | `ProductsPage.tsx`, `product.service.ts`, teste `catalog-e2e` | 5 teclados-base usam imagem placeholder |
| Detalhe de produto + variantes | PASS | `ProductDetailPage.tsx`, `VariantSelector.tsx`, `ProductGallery.tsx` | — |
| Personalização (Builder) | PASS | `BuilderPage.tsx`, `builder.service.ts`, 9 testes de BuilderPage + `builder.test.ts` | Agrupamento não persistido como entidade no pedido |
| Compatibilidade de componentes | PASS | `builderCompatibility.ts` (front+back), testes de compat | Duplicado front/back (intencional) |
| Community builds ("Montar igual") | PASS | `CommunityBuild*`, `communityBuild.service.ts`, teste `community-build` | — |
| Carrinho (visitante localStorage) | PASS | `CartContext.tsx` (anon_cart) | — |
| Carrinho (logado, servidor, transacional) | PASS | `cart.service.ts`, teste `cart-merge` | — |
| Merge de carrinho no login | PASS | `mergeCart()` (SET semantics, idempotente) | — |
| Checkout (endereço → frete → resumo → confirmar) | PASS | `CheckoutPage.tsx`, `order.service.createOrder` | Guard de rota só client-side |
| Cálculo de frete | PASS | `shipping.service.ts`, teste `shipping` | Frete simulado (fixo por região) |
| Criação de pedido | PASS | `order.service.ts` (lock de estoque, snapshots), teste `checkout-orders` | — |
| Pagamento PIX (sandbox) | PASS (SANDBOX) | `payment.service.ts`, `payment.provider.ts`, teste `payment` | Sandbox/simulado — documentar |
| Histórico de pedidos (cliente) | PASS | `OrdersPage.tsx`, `useOrders`, `getMyOrders` | — |
| Detalhe de pedido (cliente) | PASS | `OrderDetailPage.tsx` (itens + snapshot + pagamento) | — |
| Perfil do cliente (dados/senha/endereços) | PASS | `AccountPage.tsx` (`/minha-conta`), `PATCH /auth/me` | — |
| LGPD (export + exclusão/anonimização) | PASS | `auth.routes.ts` `/me/data-export`, `DELETE /me/account`, teste `security-lgpd` | — |
| Admin — dashboard (contadores) | PASS | `AdminPage.tsx`, `admin.service.getDashboardStats` | — |
| Admin — gestão de produtos (CRUD) | FAIL (UI) | Backend OK; **sem tela** | Rota `/admin/products` cai no dashboard |
| Admin — gestão de pedidos + mudar status | PARTIAL | Backend OK e testado (`PATCH /orders/:id/status`); **sem botão/tela** | Não demonstrável pela UI |
| Admin — categorias / estoque / usuários / pagamentos / envios | PARTIAL | Backend OK (`admin.routes.ts`) + `admin.ts` client; **sem telas** | Rotas caem no dashboard |
| Estoque transacional + logs | PASS | `SELECT FOR UPDATE`, `StockLog`, testes `stock-concurrency`/`load-concurrency` | — |
| Notificações (e-mail via jobs) | PASS | `jobs/index.ts` (BullMQ), teste `jobs-notifications` | 1 teste flaky sob carga |
| Página `/dashboard` (cliente) | FAIL | `DashboardPage.tsx` com dados **falsos hardcoded** | Órfã; remover/ocultar |
| CI/CD | FAIL | `.github/workflows/ci.yml` com `working-directory: backend/backend` | Caminho errado — quebra no GitHub |

Legenda: PASS = existe, funciona, integrado e persiste. PARTIAL = backend pronto, UI ausente/incompleta. FAIL = não funciona como esperado. NOT_IMPLEMENTED = ausente.

---

## 6. P0 — BLOQUEADORES

**Nenhum P0 identificado.** O sistema sobe, o banco funciona, login funciona, o checkout cria pedido, e o fluxo principal é possível de ponta a ponta.

---

## 7. P1 — MUITO IMPORTANTES

### P1-01 — Painel administrativo no frontend é apenas um dashboard (sem telas de gestão)

```
ID:             P1-01
Problema:       O AdminPage renderiza cards ("Produtos", "Pedidos", "Categorias",
                "Usuários", "Pagamentos", "Envios") que linkam para /admin/products,
                /admin/orders, etc., mas App.tsx mapeia TANTO /admin QUANTO /admin/*
                para o próprio AdminPage. Não existem componentes de sub-página.
                Clicar em qualquer card apenas re-renderiza o dashboard.
Arquivo:        frontend/src/App.tsx (linhas das rotas /admin e /admin/*)
                frontend/src/pages/AdminPage.tsx (cards com href mortos)
                (backend PRONTO: backend/src/routes/admin.routes.ts +
                 backend/src/routes/order.routes.ts PATCH /:id/status)
Como reproduzir: Logar como admin@keycaps.dev → abrir /admin → clicar em "Produtos"
                ou "Pedidos" → volta ao mesmo dashboard (link morto).
Causa provável: Fase de UI admin não foi construída; só o dashboard foi entregue.
Impacto:        Item de banca #14 ("o e-commerce pode ser operado") só é
                parcialmente demonstrável. O admin não consegue cadastrar/editar
                produto, ver a lista de pedidos, abrir um pedido, nem MUDAR STATUS
                pela interface — embora o backend faça tudo isso.
Correção recomendada:
                Criar telas admin mínimas consumindo o admin.ts já existente:
                1) AdminOrdersPage: lista (GET /admin/orders) + detalhe + botão de
                   mudar status (PATCH /orders/:id/status). PRIORIDADE MÁXIMA.
                2) AdminProductsPage: lista + criar/editar/desativar + estoque
                   (usar endpoints de produto/inventory).
                3) (Opcional p/ demo) Categorias e Usuários — read-only já ajuda.
                Registrar as rotas reais em App.tsx no lugar do catch-all /admin/*.
```

### P1-02 — (Condicional) Detalhe de pedido para admin retorna 403 via /orders/:id

```
ID:             P1-02
Problema:       order.routes.ts GET /:id chama getOrderById(id, user.id) SEM passar
                isAdmin=true. Em order.service.getOrderById, se !isAdmin e o pedido
                não é do usuário, lança 403. Logo, um admin abrindo o pedido de OUTRO
                usuário por /orders/:id recebe "Acesso negado".
Arquivo:        backend/src/routes/order.routes.ts (GET /:id)
                backend/src/services/order.service.ts (getOrderById)
Como reproduzir: Como admin, chamar GET /api/v1/orders/{id_de_pedido_de_outro_user}.
Impacto:        Ao construir a tela admin de pedidos (P1-01), abrir o detalhe pela
                rota de cliente falharia. NÃO é falha de segurança (o comportamento
                seguro é o correto) — é uma lacuna de rota admin de leitura.
Correção recomendada:
                Adicionar GET /admin/orders/:id no backend (retornando detalhe
                completo via orderRepo.findById, que já inclui items+payment+
                shipment+user) e consumir essa rota na tela admin. O client
                admin.ts JÁ tem getOrder(id) apontando para /admin/orders/:id —
                basta implementar o endpoint no admin.routes.ts.
```


---

## 8. P2 — IMPORTANTES (corrigir antes da apresentação se possível)

### P2-01 — Página `/dashboard` com dados falsos hardcoded

```
ID:             P2-01
Problema:       DashboardPage exibe "Builds Salvas" com array hardcoded
                ("Midnight Purple 65%", "Arctic TKL"), contador "Builds Salvas: 2"
                fixo, "Total Gasto" usando o total do carrinho (não gasto real), e um
                botão "Salvar Alterações" no perfil que NÃO faz nada.
Arquivo:        frontend/src/pages/DashboardPage.tsx
Como reproduzir: Acessar /dashboard diretamente pela URL (logado).
Causa provável: Página protótipo antiga, substituída por /minha-conta (AccountPage),
                mas nunca removida. A Navbar já aponta para /minha-conta, então é órfã.
Impacto:        Se a banca (ou o aluno por engano) abrir /dashboard, verá dados
                inventados e um botão morto — dá impressão de sistema fake.
Correção recomendada:
                Remover a rota /dashboard de App.tsx e o arquivo DashboardPage.tsx
                (a funcionalidade real de perfil já vive em AccountPage). Alternativa
                mínima: redirecionar /dashboard → /minha-conta.
```

### P2-02 — CI/CD quebrado (caminho `backend/backend` inexistente no repo canônico)

```
ID:             P2-02
Problema:       Tanto .github/workflows/ci.yml (raiz do workspace) quanto
                qwerty-build-hub/.github/workflows/ci.yml usam
                working-directory: backend/backend e
                cache-dependency-path: backend/backend/package-lock.json.
                No repo canônico o backend está em backend/ (um nível só).
Arquivo:        qwerty-build-hub/.github/workflows/ci.yml
Como reproduzir: Qualquer push para main dispararia o CI e falharia no passo npm ci
                (diretório backend/backend não existe).
Impacto:        O README afirma "CI/CD PASS" — afirmação FALSA. Banca pode verificar
                o repositório GitHub e ver o workflow vermelho.
Correção recomendada:
                Trocar working-directory: backend/backend → backend e
                cache-dependency-path: backend/backend/package-lock.json →
                backend/package-lock.json (job backend). Confirmar que o job
                frontend já usa working-directory: frontend (correto).
```

### P2-03 — README subvende os testes e alega CI/CD que não passa

```
ID:             P2-03
Problema:       README diz "162 testes backend + 15 frontend" e "CI/CD PASS".
                Real (executado nesta auditoria): 250 testes backend (249 pass, 1
                flake de timing) e 126 testes frontend (15 ARQUIVOS). CI está quebrado.
Arquivo:        qwerty-build-hub/README.md, docs/GIT-CONSOLIDATION-REPORT.md
Impacto:        Credibilidade. É melhor reportar os números reais (que são
                excelentes) e corrigir o CI antes de reivindicar "PASS".
Correção recomendada:
                Atualizar números para 250 backend + 126 frontend. Só manter
                "CI/CD PASS" DEPOIS de corrigir o P2-02.
```

### P2-04 — Imagens dos 5 teclados-base do catálogo são placeholders

```
ID:             P2-04
Problema:       No seed, os 5 produtos "teclado-*" (ProductsPage) recebem
                url: '/images/product-placeholder.svg'. O catálogo principal de
                teclados aparece sem foto real. Os COMPONENTES do builder e as
                community builds já têm imagens reais (public/images/products e
                public/images/community existem e batem com o seed).
Arquivo:        backend/src/prisma/seed.ts (bloco "PRODUTOS")
Impacto:        A primeira tela do catálogo parece sem acabamento na demo.
Correção recomendada:
                Apontar cada teclado-base para uma imagem real já existente em
                public/images/products/ (há várias) ou adicionar 5 imagens
                dedicadas. Reexecutar o seed.
```

---

## 9. P3 — MELHORIAS (qualidade / acabamento)

- **P3-01 — Teste flaky `jobs-notifications`.** "enqueueNotification creates notification with eventId" espera 1500ms pelo worker BullMQ e falhou (1521ms) sob carga da suíte completa; em isolamento os 10 passam. O teste irmão já usa `if (delivery)` defensivo. Correção: tornar a asserção condicional (como o irmão) OU aumentar a espera para ~3000ms. Não é defeito funcional. Arquivo: `backend/src/__tests__/jobs-notifications.test.ts:79`.
- **P3-02 — `npm run lint` do backend quebrado.** Não há arquivo de config ESLint em `backend/`; o script `eslint src --ext .ts` falha ("couldn't find a configuration file"). O typecheck (`tsc --noEmit`) passa limpo. Correção: adicionar `.eslintrc.cjs` (o `@typescript-eslint` já está nas devDependencies) ou remover o script.
- **P3-03 — Assets de imagem muito pesados.** `hero-keyboard.jpg` 1.7MB, `case1.png` 4.7MB, `Tofu65.png` 3.2MB, `branco-artico.png` 2.2MB, `neon-dreams.png` 1.3MB. Risco de lentidão na demo. Correção: otimizar/redimensionar (WebP, <300KB) e usar `loading="lazy"`.
- **P3-04 — Bundle JS 592KB (177KB gzip).** Aceitável, mas o Vite avisa. Opcional: code-splitting/`manualChunks`.
- **P3-05 — Aviso de import misto de `api/client.ts`** (dinâmico em AccountPage + estático em vários). Cosmético; padronizar para import estático.
- **P3-06 — Guards de rota apenas por página.** Não há `<ProtectedRoute>`/`<AdminRoute>` centralizado; cada página faz `useEffect` + redirect. Funciona (backend garante a autorização real), mas um wrapper centralizado seria mais limpo e evitaria "flash" de conteúdo.
- **P3-07 — `var` em blocos if/else em `order.service.createOrder`.** Funciona por hoisting, mas é estilo ruim; trocar por `let`/`const` fora do bloco.
- **P3-08 — Código de autenticação duplicado.** Coexistem `middlewares/auth.middleware.ts` (usado em todo lugar) e `middlewares/requireAuth.ts` + `requireAdmin.ts` (checam `isActive` no banco, pouco usados). Consolidar num só para evitar divergência.

---

## 10. P4 — EVOLUÇÕES FUTURAS (fora do escopo do TCC)

- Persistir o "build" como entidade de pedido (buildId/buildName no OrderItem) para agrupar componentes de um teclado montado no histórico e no admin.
- Pagamento real (produção Mercado Pago) + webhook público com URL fixa/HTTPS.
- Upload de imagens para S3 (provider já previsto por env).
- Testes E2E com Playwright (instalado, sem specs) cobrindo os fluxos E2E-01..06.
- Observabilidade (Sentry DSN já previsto por env), métricas, dashboards.
- Reviews/avaliações de produto, wishlist persistida no servidor (hoje favoritos são client-side).

---

## 11. TESTES (resultados reais executados nesta auditoria)

```
Build (backend, tsc):        PASS
Build (frontend, vite):      PASS (avisos de bundle/imagens, sem erro)
Typecheck (backend):         PASS (0 erros)
Typecheck (frontend):        PASS (0 erros)
Lint (backend):              FAIL (sem config ESLint — script quebrado) [P3-02]
Unit + Integration (backend, jest): 250 testes → 249 PASS, 1 FAIL (flake) [P3-01]
Unit + Component (frontend, vitest): 126 testes (15 arquivos) → 126 PASS
E2E (Playwright):            NÃO EXISTE (Playwright instalado, sem specs)
```

Detalhe do backend (15 suítes): stock-concurrency, checkout-orders, builder, integration, address, payment, catalog-e2e, security-lgpd, load-concurrency, cart-merge, shipping, admin, community-build, profile-password → PASS. jobs-notifications → 1 asserção falhou sob carga (timing), confirmada como flake (passa 10/10 isolada).

Pré-condições reproduzidas: `docker compose up -d postgres redis` (portas 55432/56379), `prisma migrate deploy`, `prisma db seed` — tudo executou com sucesso.

---

## 12. FLUXO PRINCIPAL

```
Cadastro:        PASS — /register, validação Zod (senha forte), e-mail único, argon2id.
Login:           PASS — tempo constante, JWT access+refresh, sessão restaurada no reload.
Catálogo:        PASS — busca, filtro por categoria, paginação. (imagens dos 5 teclados = placeholder)
Produto:         PASS — detalhe, seletor de variante, galeria, badge de estoque, comprar agora.
Personalização:  PASS — builder 8 etapas, preço em tempo real, compatibilidade em tempo real.
Carrinho:        PASS — visitante (localStorage) e logado (servidor), merge no login.
Checkout:        PASS — endereço → frete → resumo → confirmar; guards client-side + backend.
Pedido:          PASS — criado com lock de estoque, snapshots de preço e endereço, número único.
Pagamento:       PASS (SANDBOX) — PIX com QR; verificação server-side; idempotência.
Histórico:       PASS — lista + detalhe com itens, snapshots, status e pagamento.
Admin:           PARTIAL — login + dashboard de contadores OK; gestão (produtos/pedidos/
                 status) SEM UI (backend pronto). Ver P1-01.
```

---

## 13. PERSONALIZAÇÃO DO TECLADO (análise aprofundada)

```
Interface:     EXCELENTE. Wizard de 8 etapas (Layout → Case → PCB → Plate → Switch →
               Keycap → Extras → Revisão). BuilderStepper navegável, cards de opção,
               preview, LayoutSelector. Foco acessível a cada etapa (a11y).
Persistência:  PARCIAL/BOA. Rascunho salvo em localStorage (apenas IDs + quantidades,
               NUNCA preço/estoque). No pedido, cada componente vira um OrderItem com
               snapshot (productName, variantName, sku, unitPrice, total) → é possível
               saber exatamente o que o cliente comprou. LIMITAÇÃO: o agrupamento
               "isto é um teclado montado" NÃO é persistido — os componentes aparecem
               como itens de linha separados, não como "Teclado Custom = [X, Y, Z]".
Preço:         CONFIÁVEL. Calculado ao vivo no front, mas SEMPRE revalidado no servidor
               (builder.service resolveAndValidate re-busca cada variante e ignora o
               preço enviado pelo cliente). Impossível manipular.
Carrinho:      PASS. Visitante: itens reais em localStorage. Logado: add transacional
               no servidor, re-checando estoque dentro da transação.
Pedido:        PASS. Componentes persistidos com snapshot; recuperável no histórico
               e (após P1-01) no admin.
Admin:         AUSENTE na UI. O admin só veria os componentes como itens de linha
               quando houver a tela de detalhe de pedido (P1-01/P1-02).
Validação:     FORTE. Categorias obrigatórias (case/pcb/plate/switch/keycap) exigidas;
               extras opcionais; compatibilidade por layout e por tipo de switch;
               invalidação em cascata quando o layout muda (com aviso ao usuário).
Segurança:     FORTE. Schema Zod .strict() (rejeita chaves desconhecidas → bloqueia
               injeção de preço), variantId UUID, quantidade 1–99, itens 1–30.
```

Exemplo real de composição (do seed): Layout 65% + Case Tofu65 (R$599,90) + PCB Hotswap 65% (R$349,90) + Plate Alumínio 65% (R$149,90) + Gateron Oil King (R$89,90) + Keycaps GMK Laser (R$349,90) + extras. O total é somado ao vivo e reconferido no servidor.

Componentes propositalmente sem estoque no seed (Holy Panda, PCB Solder TKL) e de família incompatível (Switch Óptico Flaretech) permitem **demonstrar validação de estoque e de compatibilidade real** na banca.

---

## 14. SEGURANÇA

```
AUTH:              FORTE. Argon2id (memoryCost/timeCost/parallelism configuráveis),
                   JWT verificado no servidor, refresh com rotação e revogação,
                   login em tempo constante (hash dummy quando usuário não existe),
                   env exige JWT secrets ≥ 32 chars (processo aborta se inválido).
AUTHORIZATION:     FORTE. RBAC (USER/ADMIN/SUPER_ADMIN). Rotas admin com dupla guarda
                   (authenticate + isAdmin). Mudança de role exige SUPER_ADMIN.
IDOR:              PROTEGIDO. getOrderById checa order.userId !== userId; endpoints de
                   pagamento checam order.userId !== userId. Sem vazamento entre usuários.
PRICE_TAMPERING:   IMPOSSÍVEL. Total do pedido calculado a partir do preço da variante
                   no banco; valor do pagamento vem de Order.total; builder ignora preço
                   do cliente. Enviar {"price": 1} não tem efeito (Zod .strict rejeita).
XSS:               BAIXO RISCO. React escapa por padrão; sem dangerouslySetInnerHTML
                   observado nos fluxos principais. Helmet ativo.
SQL_INJECTION:     BAIXO RISCO. Prisma (queries parametrizadas). Os poucos $queryRaw/
                   $executeRaw usam interpolação de tags do Prisma (parametrizada),
                   não concatenação de string.
SECRETS:           LIMPO. Apenas .env.example (placeholders) versionado; .env removido
                   do git (commit c2c7eb5). Nenhum token real (Mercado Pago/AWS) comitado.
INPUT_VALIDATION:  FORTE. Zod em todas as entradas, .strict(), UUIDs, limites de
                   quantidade/tamanho, complexidade de senha, sanitização (trim/lowercase).
```

Tratamento de erros: `errorHandler` mapeia Zod (422), Prisma P2002/P2025/P2003 e erros genéricos para mensagens limpas; **stack trace só em desenvolvimento**. Não há vazamento de "[object Object]", stack, ou erro cru de banco para o usuário.

**Conclusão de segurança: nenhuma vulnerabilidade crítica.** Este é um ponto forte defensável do TCC.


---

## 15. UX/UI (telas problemáticas por prioridade)

- **HIGH — `/dashboard` com dados falsos** (P2-01): builds e estatísticas inventadas, botão que não salva. Remover/ocultar.
- **HIGH — Cards do admin sem destino** (P1-01): clicar em "Produtos/Pedidos" volta ao dashboard. Parece quebrado.
- **MEDIUM — Catálogo com placeholders** (P2-04): os teclados-base sem foto real destoam do resto (componentes e community têm imagens ricas).
- **MEDIUM — Peso de imagens** (P3-03): possível lentidão/flash em telas com imagens grandes.
- **LOW — Sem `<ProtectedRoute>` central** (P3-06): pode haver breve "flash" antes do redirect em páginas protegidas.
- **COSMETIC — Aviso do Vite de import misto** (P3-05).

Pontos positivos de UX: design consistente (Tailwind + shadcn/ui), estados de loading (spinners), estados vazios ("Nenhum endereço cadastrado", "Nenhum componente compatível"), toasts (sonner) para feedback, stepper visual no builder e no checkout, badges de status/estoque, animações discretas (framer-motion), mensagens de erro amigáveis (`errorMapper`).

---

## 16. RESPONSIVIDADE

```
Desktop (1440/1280): OK — layout em grid (builder 1fr/340px, catálogo responsivo).
Tablet   (768):      OK provável — classes sm:/md:/lg: presentes; Navbar tem menu mobile.
Mobile   (390):      OK provável — Navbar colapsa em menu hambúrguer (AnimatePresence),
                     grids caem para 1 coluna, checkout em coluna única.
```

Observação: a auditoria confirmou os breakpoints no código (Tailwind `sm:`/`md:`/`lg:`, `use-mobile`, menu mobile na Navbar), mas **não houve teste visual em navegador real**. Recomenda-se um passe manual rápido em 390px antes da banca, com atenção às tabelas do futuro admin (P1-01) e às imagens grandes.

---

## 17. DOCUMENTAÇÃO / TCC (o que ainda deveria ser produzido)

Existe boa trilha de engenharia em `docs/` (MVP_SCOPE, ROADMAP, RISKS_AND_DECISIONS, DEFINITION_OF_DONE, relatórios de fase, OPERATIONS-RUNBOOK, auditorias antigas). **Falta o documento acadêmico formal do TCC**, que a banca espera:

- **Problema e justificativa** — por que um e-commerce especializado em teclados personalizados (mercado de mechanical keyboards, dor de montar builds compatíveis).
- **Objetivo geral + objetivos específicos.**
- **Público-alvo.**
- **Requisitos funcionais numerados (RF01…)** — ex.: RF01 cadastro, RF02 personalizar teclado, RF03 carrinho, RF04 checkout/pedido, RF05 admin gerenciar produtos, RF06 histórico, RF07 pagamento PIX, RF08 LGPD.
- **Requisitos não funcionais (RNF01…)** — ex.: RNF01 responsivo, RNF02 autenticação segura (argon2/JWT), RNF03 persistência relacional, RNF04 validação server-side de preço, RNF05 concorrência de estoque.
- **Diagramas**: casos de uso, DER (derivável do `schema.prisma`), arquitetura (containers Docker), fluxo de compra, e (opcional) diagrama de classes/serviços.
- **Matriz de rastreabilidade Requisito → Código → Tela → Teste** (o material já existe; falta tabelar).
- **Limitações declaradas**: pagamento em sandbox, frete simulado, build não agrupado no pedido, admin UI parcial.

Correções pontuais de doc: atualizar **README** (números reais de teste, credenciais demo, screenshots, seção de limitações, deploy) e só marcar CI verde após P2-02.

---

## 18. RISCOS PARA A BANCA (o que pode dar errado ao vivo)

1. **Abrir um card do admin** → cai no dashboard (parece bug). Mitigar: só demonstrar o dashboard OU implementar P1-01 antes.
2. **Abrir `/dashboard`** → dados falsos. Mitigar: remover a rota (P2-01) e nunca digitar essa URL.
3. **Banca abre o GitHub e vê o CI vermelho** contra o README "CI/CD PASS". Mitigar: P2-02 + P2-03.
4. **Imagens grandes** causando lentidão/flash na conexão da sala. Mitigar: P3-03 (otimizar) e rodar local.
5. **Redis fora do ar** → notificações não são enviadas. Não quebra o fluxo (enqueue é tolerante a falha), mas o e-mail de "pedido criado" não sai. Mitigar: subir Redis antes; ou não depender de e-mail na demo.
6. **Pagamento**: é PIX **sandbox/simulado** — deixar explícito para a banca que é ambiente de testes (não cobra de verdade).
7. **Pergunta "onde fica o teclado montado no pedido?"** → responder com honestidade a limitação de agrupamento (componentes como itens de linha) e mostrar `CommunityBuild` como o modelo de agrupamento persistido.

---

## 19. ROTEIRO DE DEMONSTRAÇÃO (5–10 min)

Pré-demo (fora da apresentação): `docker compose up -d postgres redis`; `cd backend && npx prisma migrate deploy && npx prisma db seed && npm run dev`; `cd frontend && npm run dev`. Confirmar que `admin@keycaps.dev` loga.

1. **Home** — apresentar a proposta (e-commerce de teclados personalizados) e "Mais vendidos" (dados reais do seed).
2. **Catálogo** — mostrar busca, filtro por categoria e paginação.
3. **Produto** — abrir um teclado, seletor de variante, estoque, "comprar agora".
4. **Builder (destaque)** — Layout 65% → Case → PCB → Plate → Switch → Keycaps.
5. **Preço em tempo real** — a cada componente, o subtotal atualiza ao vivo.
6. **Compatibilidade** — tentar um componente incompatível (ex.: switch óptico com PCB MX) e mostrar o bloqueio/aviso; mudar o layout e ver a invalidação em cascata.
7. **Adicionar ao carrinho** — mostrar o carrinho com os componentes.
8. **Login/checkout** — logar, escolher endereço, frete, resumo, **confirmar pedido**.
9. **Pagamento PIX (sandbox)** — mostrar o QR e explicar que é ambiente de testes.
10. **Histórico** — abrir o pedido em `/minha-conta` → `/orders/:id` e mostrar os componentes com snapshot de preço.
11. **Admin (login)** — logar como admin e mostrar o **dashboard** com contadores reais. (Se P1-01 for implementado: mostrar lista de pedidos e **mudar o status** de um pedido.)
12. **Bloqueio de acesso** — como cliente comum, tentar `/admin` e mostrar o redirect (autorização).

Se P1-01 **não** for implementado a tempo: no passo 11, ser transparente — mostrar o dashboard e demonstrar a mudança de status **via API** (ex.: uma chamada `PATCH /orders/:id/status` no Insomnia/curl), deixando claro que o backend está pronto e a UI é evolução.

---

## 20. POSSÍVEIS PERGUNTAS DA BANCA (com onde estudar)

1. **Por que essa stack (Node/Express/Prisma/React)?** → `README`, `docs/RISKS_AND_DECISIONS.md`.
2. **Como funciona a autenticação?** → `auth.service.ts`, `auth.middleware.ts`, `AuthContext.tsx` (argon2id, JWT access/refresh, rotação).
3. **Como impedem alteração de preço pelo cliente?** → `builder.service.resolveAndValidate`, `order.service.createOrder`, `payment.service` (total do banco).
4. **Como armazenam as personalizações?** → `schema.prisma` (`OrderItem` com snapshot), `builder.service.ts`; e a limitação de agrupamento (`CommunityBuild` como modelo persistido).
5. **Como é o relacionamento entre pedido e produto?** → `schema.prisma` (`Order`→`OrderItem`→`Product`/`ProductVariant`), `order.repository.ts`.
6. **Por que banco relacional?** → integridade referencial, transações de estoque, `Decimal` para dinheiro. `docs/RISKS_AND_DECISIONS.md`.
7. **Como garantem que um usuário não veja pedidos de outro (IDOR)?** → `order.service.getOrderById`, `payment.service` (checagem de dono), teste `security-lgpd`.
8. **Como tratam produtos personalizados incompatíveis?** → `builderCompatibility.ts` (front+back), testes de compatibilidade.
9. **O sistema está em produção?** → Não; roda local via Docker; pagamento em sandbox. `docker-compose.yml`, seção 21.
10. **Quais as limitações atuais?** → seções 10 e 17 (admin UI parcial, sandbox, frete simulado, agrupamento não persistido).
11. **Como garantem consistência de estoque sob concorrência?** → `SELECT FOR UPDATE` + decremento condicional + `StockLog`; testes `stock-concurrency`/`load-concurrency`.
12. **Como evitam pagamento duplicado?** → `payment.service` (insert-first com unique em `orderId`, `idempotencyKey`); teste `payment` ("Concurrent create").
13. **E se o webhook do pagamento chegar duas vezes ou fora de ordem?** → `applyVerifiedStatus` (idempotente, não faz downgrade de PAID); verificação server-side.
14. **Como o dinheiro é representado?** → `Decimal(10,2)` no Prisma (não float). `schema.prisma`.
15. **O que acontece com um pedido antigo se o preço do produto mudar?** → nada: `OrderItem` guarda `unitPrice`/`total` no momento da compra (snapshot). Idem endereço no `Shipment`.
16. **Como validam entradas?** → Zod `.strict()` em `validators/`, `middlewares/validate.ts`.
17. **Como tratam LGPD?** → `auth.routes.ts` (`/me/data-export`, `DELETE /me/account` com anonimização); teste `security-lgpd`.
18. **Como funcionam as notificações?** → `jobs/index.ts` (BullMQ + Redis), idempotência via `NotificationDelivery`; teste `jobs-notifications`.
19. **Como o admin opera a loja?** → hoje: dashboard (contadores) + backend completo (`admin.routes.ts`, `order.routes.ts` status). Ser honesto sobre a UI de gestão em construção (P1-01).
20. **Como é o build de teclado da comunidade vs. o builder do usuário?** → `CommunityBuild`/`CommunityBuildItem` (persistido), "Montar igual" pré-preenche o builder; `communityBuild.service.ts`.
21. **Quantos testes e o que cobrem?** → 250 backend + 126 frontend; seção 11 (fluxos, concorrência, segurança, builder).
22. **Como garantem que o builder usa produtos reais (sem itens fantasma)?** → `builder.service.getOptions` lê o catálogo real; teste de BuilderPage "no phantom items".
23. **Como o carrinho de visitante vira carrinho de usuário no login?** → `CartContext.mergeAndLoad` + `cart.service.mergeCart` (SET semantics, idempotente); teste `cart-merge`.
24. **Por que Prisma e não SQL puro?** → tipagem, migrations versionadas, produtividade; `$queryRaw` parametrizado onde precisou de lock.

---

## 21. DEPLOY

```
Classificação: LOCAL_ONLY  (STAGING_READY via Docker Compose, mas sem URL pública)
```

```
Frontend:    Build Vite OK; Dockerfile (nginx) presente; vercel.json presente. Não publicado.
Backend:     Dockerfile presente; sobe via compose. Não publicado.
Banco:       PostgreSQL via compose (porta 55432). Migrations aplicam (deploy). Seed OK.
Domínio:     Nenhum verificado.
HTTPS:       Não verificado (local HTTP).
Variáveis:   .env.example completo; env.ts valida e aborta se inválido.
CORS:        Configurado por ALLOWED_ORIGINS.
Migrations:  5 migrations, aplicam com sucesso.
Seed:        Admin + catálogo + componentes + community builds + pedidos demo.
Uploads:     Local (multer/sharp); S3 previsto por env, não usado.
Logs:        Pino/Winston; logs/ ignorado no git.
```

Verificado nesta auditoria: `docker compose up -d postgres redis` subiu saudável; `prisma migrate deploy` (sem migrations pendentes) e `prisma db seed` rodaram com sucesso; a suíte de testes rodou contra esse banco.

---

## 39. PLANO DE FINALIZAÇÃO

### FASE 1 — Bloqueadores (P0)
Nenhum. Nada a fazer.

### FASE 2 — Fluxo principal
Já funciona ponta a ponta (cadastro, personalização, carrinho, checkout, pedido, pagamento sandbox, histórico). Nenhuma correção obrigatória.

### FASE 3 — Segurança e consistência (P1)

```
ID:              F3-01
Prioridade:      P1
Problema:        Admin não consegue abrir detalhe de pedido de outro usuário por /orders/:id.
Solução:         Implementar GET /admin/orders/:id no backend (orderRepo.findById já
                 retorna items+payment+shipment+user).
Arquivos:        backend/src/routes/admin.routes.ts (novo endpoint)
Dependências:    Nenhuma (client admin.ts.getOrder já aponta para /admin/orders/:id).
Critério aceite: Admin obtém 200 com o pedido completo de qualquer usuário; cliente
                 comum continua recebendo 403 em /orders/:id de terceiros.
```

### FASE 4 — Admin e dados (P1/P2)

```
ID:              F4-01
Prioridade:      P1
Problema:        Sem UI admin de pedidos + mudança de status (item de banca #14).
Solução:         Criar AdminOrdersPage (lista GET /admin/orders) + AdminOrderDetail
                 (GET /admin/orders/:id) + botão de status (PATCH /orders/:id/status,
                 respeitando a máquina de estados). Registrar rotas reais em App.tsx.
Arquivos:        frontend/src/pages/admin/AdminOrdersPage.tsx (novo),
                 AdminOrderDetailPage.tsx (novo), App.tsx (rotas),
                 usa frontend/src/api/admin.ts (já existe).
Dependências:    F3-01.
Critério aceite: Admin lista pedidos, abre um, vê componentes (itens de linha) e muda
                 o status; transição inválida é bloqueada com mensagem.

ID:              F4-02
Prioridade:      P1
Problema:        Sem UI admin de produtos/estoque.
Solução:         AdminProductsPage: listar, criar/editar/desativar, editar estoque
                 (PATCH /admin/inventory/:id).
Arquivos:        frontend/src/pages/admin/AdminProductsPage.tsx (novo), App.tsx,
                 api/admin.ts (getInventory/updateStock já existem; add product CRUD).
Dependências:    Nenhuma.
Critério aceite: Admin cria um produto/edita estoque e a mudança reflete no catálogo.

ID:              F4-03
Prioridade:      P2
Problema:        Página /dashboard com dados falsos.
Solução:         Remover rota+arquivo (ou redirecionar para /minha-conta).
Arquivos:        frontend/src/App.tsx, frontend/src/pages/DashboardPage.tsx.
Dependências:    Nenhuma.
Critério aceite: /dashboard não exibe mais dados inventados.

ID:              F4-04
Prioridade:      P2
Problema:        Imagens dos 5 teclados-base são placeholder.
Solução:         Apontar para imagens reais em public/images/products/ e re-seedar.
Arquivos:        backend/src/prisma/seed.ts.
Dependências:    Nenhuma.
Critério aceite: Catálogo mostra fotos reais dos teclados.
```

### FASE 5 — UX/UI (P3)
F5-01 otimizar imagens pesadas (P3-03); F5-02 `<ProtectedRoute>` central (P3-06); F5-03 passe manual de responsividade em 390px.

### FASE 6 — Testes (P3)

```
ID:              F6-01
Prioridade:      P3
Problema:        Teste flaky jobs-notifications sob carga.
Solução:         Asserção condicional (como o teste irmão) ou espera de ~3000ms.
Arquivos:        backend/src/__tests__/jobs-notifications.test.ts:79.
Critério aceite: Suíte completa passa 250/250 de forma estável.

ID:              F6-02
Prioridade:      P3
Problema:        Lint do backend sem config.
Solução:         Adicionar .eslintrc.cjs (@typescript-eslint já instalado) ou remover script.
Arquivos:        backend/ (novo .eslintrc.cjs), package.json.
Critério aceite: npm run lint roda sem erro de configuração.
```

### FASE 7 — Documentação acadêmica (P2)
F7-01 escrever o capítulo formal do TCC (problema, objetivos, RF/RNF, DER, casos de uso, arquitetura, rastreabilidade, limitações). F7-02 atualizar README (números reais 250+126, credenciais demo, screenshots, limitações, deploy). F7-03 corrigir CI (`working-directory: backend`) e só então reivindicar "CI/CD PASS".

### FASE 8 — Preparação da banca
F8-01 ensaiar o roteiro da seção 19; F8-02 preparar credenciais demo (`admin@keycaps.dev` / `Admin123!Dev`; cliente de teste); F8-03 checklist de "não abrir /dashboard nem cards mortos"; F8-04 subir Redis para notificações; F8-05 deixar claro que o PIX é sandbox.

---

## 40. CRITÉRIO FINAL

```
O sistema inicia corretamente?                         YES
Um cliente consegue fazer uma compra completa?         YES
A personalização funciona ponta a ponta?               YES
O pedido registra corretamente a personalização?       YES (como itens de linha com
                                                        snapshot; agrupamento do build
                                                        não é persistido — limitação)
O painel admin funciona?                                PARTIAL (dashboard sim; gestão/
                                                        mudança de status só no backend,
                                                        sem UI)
Existem vulnerabilidades críticas?                      NO
Está adequado para demonstração?                        YES (com ressalvas: evitar
                                                        /dashboard e cards admin mortos,
                                                        ou implementar P1-01)
Está adequado para entrega como TCC?                    YES, com as correções P1/P2
Existem P0?                                             0
Existem P1?                                             2 (P1-01 admin UI, P1-02 rota
                                                        admin de detalhe de pedido)
```

```
FINAL VERDICT:

READY_WITH_GAPS
```

O núcleo do e-commerce (catálogo, personalização, carrinho, checkout, pedido, pagamento sandbox, histórico, segurança, LGPD, testes) está sólido e defensável. Para apresentar **sem medo**, priorize: (1) telas admin mínimas de pedidos + mudança de status (P1-01/P1-02, F3-01/F4-01); (2) remover a página `/dashboard` falsa (P2-01); (3) consertar o CI e sincronizar o README com a realidade (P2-02/P2-03); (4) redigir o capítulo acadêmico com RF/RNF/DER/rastreabilidade (F7-01). Imagens de catálogo e otimização são acabamento (P2-04/P3-03).
