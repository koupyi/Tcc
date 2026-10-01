# Qwerty Build Hub — E-commerce de Teclados Mecânicos Personalizados

E-commerce full-stack para teclados mecânicos customizáveis. O cliente monta seu
teclado peça a peça (case, PCB, plate, switches, keycaps e extras) a partir de
**produtos reais do catálogo**, com verificação de compatibilidade e preço em
tempo real, e conclui a compra com endereço, frete e pagamento PIX (sandbox).

## Proposta

Comprar um teclado custom normalmente exige montar manualmente uma lista de
componentes compatíveis em várias lojas. O Qwerty Build Hub centraliza isso: um
**builder guiado** valida compatibilidade (layout e tipo de switch), calcula o
preço ao vivo e leva a configuração ao carrinho como itens reais, prontos para
checkout — com estoque, snapshots de preço e histórico de pedidos.

## Stack

- **Backend**: Node.js + TypeScript + Express + Prisma + PostgreSQL
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Infra**: Redis + BullMQ (jobs/notificações) + Docker + Nginx
- **Auth**: JWT (access + refresh com rotação) + Argon2id + RBAC
- **Validação**: Zod (server-side, `.strict()`)
- **Pagamentos**: Mercado Pago PIX — **sandbox** por padrão

## Arquitetura (resumo)

```
Frontend (React/Vite)  ──HTTP(JSON)──►  Backend (Express/Prisma)  ──►  PostgreSQL
                                              │
                                              └── Redis + BullMQ (worker de notificações / jobs)
```

- Preço e estoque são **sempre** recalculados no servidor (o cliente nunca dita preço).
- Pedidos guardam **snapshots** de preço (por item) e de endereço (no envio).
- Pagamento com chave de idempotência e verificação server-side.

## Pré-requisitos

- Node.js 20+
- Docker + Docker Compose (para PostgreSQL e Redis) — ou Postgres 16 e Redis 7 locais

## Como rodar (local)

### 1. Subir banco e Redis

```bash
docker compose up -d postgres redis
# Portas locais: PostgreSQL 55432, Redis 56379
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # ajuste se necessário (DATABASE_URL já aponta para a porta 55432)
npx prisma generate --schema=src/prisma/schema.prisma
npx prisma migrate deploy --schema=src/prisma/schema.prisma
npx prisma db seed
npm run dev            # http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:3000/api/v1
npm run dev            # http://localhost:8080 (ou porta do Vite)
```

### Alternativa: stack completa via Docker

```bash
docker compose up -d
docker compose --profile migration run --rm migrate
docker compose exec backend node dist/prisma/seed.js
```

## Credenciais de demonstração

Criadas pelo seed (ambiente de desenvolvimento — não usar em produção):

| Papel    | E-mail                   | Senha             |
|----------|--------------------------|-------------------|
| Admin    | `admin@keycaps.dev`      | `Admin123!Dev`    |
| Cliente  | `comunidade@keycaps.dev` | `Community123!Dev`|

> Também é possível criar um cliente novo pela própria tela de cadastro.

## Funcionalidades

- **Catálogo**: listagem, busca, filtro por categoria, paginação, detalhe com variantes.
- **Builder de teclado (personalização)**: assistente em etapas
  (Layout → Case → PCB → Plate → Switch → Keycaps → Extras → Revisão), com
  preço em tempo real, filtro de compatibilidade e invalidação em cascata.
- **Community builds**: builds prontas (produtos reais) com "Montar igual".
- **Carrinho**: visitante (localStorage) e autenticado (servidor), com merge no login.
- **Checkout**: endereço → frete → resumo → confirmação; cria pedido com lock de estoque.
- **Pagamento**: PIX (sandbox) com QR, idempotência e verificação server-side.
- **Pedidos**: histórico do cliente e detalhe com itens, snapshots e status.
- **Conta** (`/minha-conta`): dados pessoais, troca de senha, endereços.
- **Admin**: dashboard (contadores), **gestão de pedidos** (listar, abrir, mudar
  status pela máquina de estados) e **gestão de produtos** (criar, editar,
  desativar, editar estoque).
- **LGPD**: exportação de dados e exclusão/anonimização da conta.
- **Segurança**: RBAC, proteção contra IDOR, preço não manipulável, hashing Argon2id.

### Personalização — como funciona

Cada componente do builder é um `ProductVariant` real (preço/estoque verdadeiros).
Ao adicionar ao carrinho, o backend **revalida** compatibilidade, estoque e preço
(ignorando qualquer preço vindo do cliente). No pedido, cada componente vira um
item de linha com snapshot (nome do produto, nome da variante, SKU, preço e total),
de modo que é sempre possível saber exatamente o que foi comprado.

**Limitação conhecida**: o pedido guarda os componentes como itens de linha
individuais; ele **não** agrupa esses itens sob um identificador único de "build".
As *community builds* são persistidas como entidade própria (`CommunityBuild`).

## Testes

Resultados reais da última execução local (com Postgres + Redis via Docker):

```bash
# Backend (Jest + Supertest) — requer banco/Redis no ar
cd backend && npm test
# → 16 suítes, 261 testes, 261 passando

# Frontend (Vitest + Testing Library)
cd frontend && npm test
# → 15 arquivos, 126 testes, 126 passando
```

Cobrem, entre outros: autenticação, RBAC, catálogo, builder, compatibilidade,
carrinho e merge, checkout/pedidos, concorrência de estoque, pagamento
(idempotência/webhook), detalhe de pedido admin, IDOR e LGPD.

## CI

O workflow em `.github/workflows/ci.yml` executa, para o backend
(`working-directory: backend`): `npm ci`, `prisma generate`, `prisma migrate deploy`,
`prisma db seed`, `tsc --noEmit`, `npm test`; e para o frontend
(`working-directory: frontend`): `npm ci`, `tsc --noEmit`, `npm test`, `npm run build`.

> Os comandos do CI foram **reproduzidos localmente com sucesso** nesta máquina.
> O status do pipeline no GitHub Actions deve ser confirmado pelo badge do
> repositório após o push — não afirmamos "verde" sem essa evidência.

## Pagamento (PIX sandbox)

O pagamento usa o **provider de sandbox** por padrão (`SandboxPixProvider`), que
gera um QR PIX simulado — **não há cobrança real**. Se `MERCADOPAGO_ACCESS_TOKEN`
for configurado, o `MercadoPagoProvider` é usado (ambiente de testes do Mercado
Pago). O valor cobrado vem sempre do `total` do pedido no banco.

## Frete

O cálculo de frete é **simulado** (`ShippingService`): opções e preços fixos por
faixa/região, suficientes para demonstrar o fluxo de checkout. Não há integração
com transportadora real.

## Estado do deploy

`LOCAL_ONLY` (pronto para staging via Docker Compose). O `docker-compose.yml`
sobe Postgres, Redis, backend, worker e frontend (Nginx). O frontend inclui
`vercel.json`. Ainda **não** há URL pública/HTTPS/domínio configurados.

## Limitações atuais

- Pagamento em **sandbox/simulado** (sem cobrança real).
- Frete **simulado** (valores fixos por região).
- Pedido não agrupa componentes de um build sob um identificador único.
- Admin: telas de **Categorias, Usuários, Pagamentos e Envios** ainda não têm
  interface dedicada (os endpoints existem no backend; os cards aparecem como
  "Em breve"). Gestão de **Pedidos** e **Produtos/Estoque** já possui interface.
- Desativar produto é uma via só (soft delete); reativar exige ação no banco.
- Sem deploy público; sem testes E2E automatizados (Playwright instalado, sem specs).

## Documentação

- `docs/` — relatórios de fase, runbook operacional, decisões e riscos.
- `TCC_ECOMMERCE_FINAL_AUDIT.md` — auditoria técnica/funcional/acadêmica.
- `docs/TCC_PRESENTATION_CLOSURE_REPORT.md` — relatório de fechamento para a banca.
