# ROADMAP — E-commerce Qwerty Build Hub

> Data: 2026-08-06
> Status: Auditoria completa. Aguardando aprovação para iniciar Sprint 1.

---

## CLASSIFICAÇÃO POR PRIORIDADE

### P0 — Bloqueadores (12 itens)

Impedem o sistema de funcionar ou serem testados:

1. Corrigir server.ts (erro de sintaxe, sem middlewares/rotas)
2. Atualizar schema Prisma (desatualizado vs. código)
3. Criar rotas HTTP para controllers existentes
4. Gerar lock file (npm install)
5. Popular .env.example do backend
6. Criar .env.example do frontend (VITE_API_URL)
7. Configurar CORS para aceitar frontend (:8080)
8. Aplicar middlewares de segurança (helmet, compression, etc.)
9. Gerar primeira migration
10. Criar API client no frontend
11. Conectar AuthContext à API real
12. Conectar ProductsPage à API real

### P1 — MVP Obrigatório (28 itens)

Necessário para lançar primeira versão vendável:

1. Catálogo de produtos (listagem + detalhe + variantes)
2. Carrinho server-side funcional
3. Página de detalhe do produto no frontend
4. Checkout flow (endereço + frete + resumo + pagamento)
5. Pedido criado com snapshot
6. Integração de gateway de pagamento (Mercado Pago sandbox)
7. Webhook de pagamento funcional
8. Status de pedidos (máquina de estados)
9. Área do cliente (pedidos, dados pessoais)
10. Admin mínimo (dashboard + produtos + pedidos)
11. Upload de imagens funcional
12. Seed com dados realistas
13. Cálculo de frete (tabela fixa inicialmente)
14. E-mails essenciais (pedido criado, pagamento confirmado)
15. Testes de auth + products + cart
16. Deploy configurado (Docker + CI)
17. Health check endpoint
18. Backup do banco
19. README com instruções de setup
20. Estoque visível no frontend
21. Proteção contra pedidos duplicados
22. Validação final antes do pagamento
23. Carrinho anônimo + merge após login
24. Busca server-side no frontend
25. Paginação real no frontend
26. Unificar auth middleware (remover duplicação)
27. Error boundaries no frontend
28. Loading/skeleton states no frontend

### P2 — Pós-MVP (18 itens)

Melhorias após o lançamento:

1. Cupons de desconto
2. Wishlist / favoritos
3. Salvar builds do builder
4. Reviews/avaliações
5. Produtos relacionados
6. Relatórios avançados (admin)
7. Tracking de entregas
8. Exportação de dados (LGPD)
9. Exclusão de conta
10. Sentry / monitoramento de erros
11. Reserva de estoque com TTL
12. S3 para uploads
13. Templates de email (HTML)
14. Fila de emails (async)
15. Request ID / correlation ID
16. Tests E2E (Playwright)
17. Staging environment
18. Verificação de email

### P3 — Estratégico (8 itens)

1. NFe / integração fiscal
2. Multi-idioma
3. Integração com transportadoras (API)
4. Programa de afiliados
5. Feature flags
6. Analytics / CRO
7. Importação CSV de produtos
8. Antifraude avançado

---

## RECOMENDAÇÃO DE ARQUITETURA

### Opção escolhida: B — Monorepo

**Justificativa:**
- Ambos os projetos são pequenos e de um mesmo time
- Precisam compartilhar tipos TypeScript
- Deploy coordenado simplifica CI/CD
- Facilita a configuração local (docker-compose único)

**Estrutura proposta:**

```
/
├── apps/
│   ├── backend/          (mover conteúdo de backend/backend/)
│   └── frontend/         (mover conteúdo de frontend/)
├── packages/
│   └── shared-types/     (tipos, enums, interfaces compartilhados)
├── docs/                 (auditoria, roadmap, API docs)
├── docker-compose.yml    (PostgreSQL + Redis + backend + frontend)
├── .env.example
├── package.json          (workspace root)
├── turbo.json            (ou pnpm-workspace.yaml)
└── README.md
```

**Nota:** Esta reorganização pode ser feita gradualmente. Para o Sprint 1, os projetos podem permanecer nas pastas atuais (`backend/` e `frontend/`).

---

## ROADMAP POR FASES

### FASE 0 — Diagnóstico e estabilização

**Objetivo:** Fazer os dois projetos iniciarem e se comunicarem.

**Tasks:**

| ID | Título | Prioridade | Projeto | Tamanho |
|----|--------|-----------|---------|---------|
| F0-01 | Corrigir server.ts | P0 | Backend | P |
| F0-02 | Instalar dependências + gerar lock file | P0 | Backend | P |
| F0-03 | Atualizar schema Prisma completo | P0 | Backend | G |
| F0-04 | Gerar primeira migration | P0 | Backend | P |
| F0-05 | Criar rotas (auth, products, cart, orders, admin) | P0 | Backend | M |
| F0-06 | Popular .env.example backend | P0 | Backend | P |
| F0-07 | Configurar CORS | P0 | Backend | P |
| F0-08 | Aplicar middlewares de segurança | P0 | Backend | P |
| F0-09 | Health check GET /health | P0 | Backend | P |
| F0-10 | Criar .env.example frontend (VITE_API_URL) | P0 | Frontend | P |
| F0-11 | Docker-compose (PostgreSQL + Redis) | P1 | Ambos | M |
| F0-12 | Unificar auth middleware | P1 | Backend | P |

**Critério de saída:**
- ✅ Backend inicia (`npm run dev`)
- ✅ Frontend inicia (`npm run dev`)
- ✅ Banco conecta (Prisma migrate + seed)
- ✅ Build compila sem erros
- ✅ GET /health → 200
- ✅ Ambos rodam localmente simultaneamente

---

### FASE 1 — Contrato da API e integração base

**Objetivo:** Frontend consegue chamar a API com segurança.

**Tasks:**

| ID | Título | Prioridade | Projeto | Tamanho |
|----|--------|-----------|---------|---------|
| F1-01 | Criar API client (fetch wrapper + interceptors) | P0 | Frontend | M |
| F1-02 | Conectar AuthContext à API real | P0 | Frontend | M |
| F1-03 | Implementar refresh token automático (401 interceptor) | P1 | Frontend | M |
| F1-04 | Token storage (localStorage access + httpOnly refresh) | P1 | Frontend | M |
| F1-05 | Padronizar error handling no client | P1 | Frontend | M |
| F1-06 | Error boundary global | P1 | Frontend | P |
| F1-07 | Loading/skeleton components | P1 | Frontend | M |
| F1-08 | Criar pacote shared-types (ou type exports) | P1 | Ambos | M |
| F1-09 | Vite proxy para /api em dev | P1 | Frontend | P |

**Critério de saída:**
- ✅ Frontend chama API com sucesso
- ✅ Login funcional end-to-end
- ✅ Erros tratados e exibidos ao usuário
- ✅ Token refresh funciona transparentemente
- ✅ Rotas protegidas redirecionam para login

---

### FASE 2 — Banco, usuários e autenticação

**Objetivo:** Fluxo completo de registro, login, sessão.

**Tasks:**

| ID | Título | Prioridade | Projeto | Tamanho |
|----|--------|-----------|---------|---------|
| F2-01 | Seed atualizado com dados de exemplo | P1 | Backend | M |
| F2-02 | Register end-to-end (backend + frontend) | P0 | Ambos | M |
| F2-03 | Login end-to-end | P0 | Ambos | P |
| F2-04 | Logout com revogação | P0 | Ambos | P |
| F2-05 | Perfil do usuário (GET /me) | P1 | Ambos | P |
| F2-06 | Forgot/reset password (telas frontend) | P1 | Frontend | M |
| F2-07 | Admin role seeding (primeiro admin) | P1 | Backend | P |
| F2-08 | Testes de autenticação | P1 | Backend | M |

**Critério de saída:**
- ✅ Usuário cria conta
- ✅ Usuário faz login
- ✅ Sessão é renovada automaticamente
- ✅ Admin tem role separada
- ✅ Senhas hashadas com argon2id

---

### FASE 3 — Catálogo e produtos

**Objetivo:** Produtos do banco aparecem na loja.

**Tasks:**

| ID | Título | Prioridade | Projeto | Tamanho |
|----|--------|-----------|---------|---------|
| F3-01 | Conectar ProductsPage à API | P0 | Frontend | M |
| F3-02 | Criar página /products/:slug | P1 | Frontend | G |
| F3-03 | Galeria de imagens no detalhe | P1 | Frontend | M |
| F3-04 | Seletor de variantes no detalhe | P1 | Frontend | M |
| F3-05 | Mostrar estoque/disponibilidade | P1 | Frontend | P |
| F3-06 | Busca server-side | P1 | Frontend | M |
| F3-07 | Paginação real | P1 | Frontend | M |
| F3-08 | Upload de imagens (admin) | P1 | Backend | M |
| F3-09 | Admin: CRUD de produtos (tela) | P1 | Frontend | G |
| F3-10 | Admin: gerenciar variantes | P1 | Frontend | G |
| F3-11 | Categorias dinâmicas | P1 | Ambos | M |

**Critério de saída:**
- ✅ Admin cria/edita produto com variantes e imagens
- ✅ Produto aparece na loja pública
- ✅ Cliente visualiza detalhe com variantes
- ✅ Busca e filtros funcionam via API
- ✅ Paginação funciona

---

### FASE 4 — Carrinho e estoque

**Objetivo:** Carrinho funcional com persistência e validação de estoque.

| ID | Título | Prioridade | Projeto | Tamanho |
|----|--------|-----------|---------|---------|
| F4-01 | Refazer CartContext para usar API | P0 | Frontend | G |
| F4-02 | Carrinho anônimo (localStorage) | P1 | Frontend | M |
| F4-03 | Merge de carrinho após login | P1 | Backend + Frontend | G |
| F4-04 | Revalidação de estoque no get cart | P1 | Backend | M |
| F4-05 | Exibir indisponível se esgotado | P1 | Frontend | P |
| F4-06 | Concorrência: SELECT FOR UPDATE no estoque | P1 | Backend | M |

**Critério de saída:**
- ✅ Cliente adiciona/remove itens
- ✅ Carrinho persiste entre sessões
- ✅ Estoque não fica negativo
- ✅ Preços e disponibilidade revalidados

---

### FASE 5 — Checkout e pedidos

**Objetivo:** Cliente finaliza compra e acompanha pedido.

| ID | Título | Prioridade | Projeto | Tamanho |
|----|--------|-----------|---------|---------|
| F5-01 | Form de endereço (CRUD) | P1 | Ambos | M |
| F5-02 | Tela de checkout multi-step | P1 | Frontend | G |
| F5-03 | Cálculo de frete (tabela fixa) | P1 | Backend | M |
| F5-04 | Resumo com snapshot de itens/preço/frete | P1 | Frontend | M |
| F5-05 | Criar pedido via API | P1 | Frontend | M |
| F5-06 | Proteção duplo clique/idempotência | P1 | Ambos | M |
| F5-07 | Página de sucesso | P1 | Frontend | P |
| F5-08 | Área "Meus Pedidos" | P1 | Frontend | M |
| F5-09 | Admin: listagem de pedidos + update status | P1 | Frontend | M |

**Critério de saída:**
- ✅ Checkout cria pedido com snapshot
- ✅ Preço histórico preservado
- ✅ Pedido duplicado impossível
- ✅ Cliente vê seus pedidos
- ✅ Admin gerencia pedidos

---

### FASE 6 — Pagamentos

**Objetivo:** Pagamento funcional em sandbox.

| ID | Título | Prioridade | Projeto | Tamanho |
|----|--------|-----------|---------|---------|
| F6-01 | Integrar Mercado Pago SDK | P1 | Backend | G |
| F6-02 | Criar payment preference/intent | P1 | Backend | G |
| F6-03 | Redirect para checkout Mercado Pago | P1 | Frontend | M |
| F6-04 | Webhook com validação de assinatura | P1 | Backend | M |
| F6-05 | Idempotência de webhook (dedup) | P1 | Backend | M |
| F6-06 | Atualizar order status via webhook | P1 | Backend | M |
| F6-07 | Testes de webhook em sandbox | P1 | Backend | M |

**Critério de saída:**
- ✅ Pagamento sandbox funciona
- ✅ Pedido muda para PAID via webhook
- ✅ Webhook inválido rejeitado
- ✅ Dados de cartão NUNCA armazenados

---

### FASE 7 — Frete e logística

| ID | Título | Prioridade | Projeto | Tamanho |
|----|--------|-----------|---------|---------|
| F7-01 | API de consulta de frete por CEP | P1 | Backend | M |
| F7-02 | Múltiplas opções (normal/express) | P2 | Backend | M |
| F7-03 | Exibir opções no checkout | P1 | Frontend | M |
| F7-04 | Tracking code no shipment | P2 | Backend | P |
| F7-05 | Tela de tracking (cliente) | P2 | Frontend | M |

**Critério de saída:**
- ✅ Cliente vê opções de frete por CEP
- ✅ Frete incluído no total
- ✅ Método registrado no pedido

---

### FASE 8 — Notificações e jobs

| ID | Título | Prioridade | Projeto | Tamanho |
|----|--------|-----------|---------|---------|
| F8-01 | E-mail de pedido criado | P1 | Backend | M |
| F8-02 | E-mail de pagamento confirmado | P1 | Backend | M |
| F8-03 | Templates HTML de email | P2 | Backend | M |
| F8-04 | Fila com BullMQ (Redis) | P2 | Backend | G |
| F8-05 | Retry em falhas de envio | P2 | Backend | M |
| F8-06 | Job: limpar carrinhos expirados | P2 | Backend | M |

**Critério de saída:**
- ✅ E-mails essenciais enviados
- ✅ Falhas são reprocessadas
- ✅ Jobs não bloqueiam a API

---

### FASE 9 — Área administrativa

| ID | Título | Prioridade | Projeto | Tamanho |
|----|--------|-----------|---------|---------|
| F9-01 | Layout admin separado (/admin) | P1 | Frontend | M |
| F9-02 | Dashboard com stats reais | P1 | Frontend | M |
| F9-03 | CRUD de categorias | P1 | Frontend | M |
| F9-04 | Upload/reorder de imagens | P1 | Frontend | M |
| F9-05 | Gestão de estoque | P1 | Frontend | M |
| F9-06 | Gestão de usuários | P2 | Frontend | M |
| F9-07 | Logs de auditoria | P2 | Frontend | M |

**Critério de saída:**
- ✅ Admin opera a loja sem acessar banco direto

---

### FASE 10 — Segurança, LGPD e qualidade

| ID | Título | Prioridade | Projeto | Tamanho |
|----|--------|-----------|---------|---------|
| F10-01 | Rate limit aplicado e testado | P1 | Backend | P |
| F10-02 | Headers de segurança (helmet config) | P1 | Backend | P |
| F10-03 | Input sanitization (HTML strip) | P2 | Backend | M |
| F10-04 | LGPD: exportação de dados | P2 | Backend | M |
| F10-05 | LGPD: exclusão de conta com cascata | P2 | Backend | M |
| F10-06 | Audit log sem PII sensível | P2 | Backend | P |
| F10-07 | SAST (npm audit, eslint security) | P2 | CI | M |

**Critério de saída:**
- ✅ Sem vulnerabilidades críticas
- ✅ Dados pessoais gerenciáveis
- ✅ Segredos não versionados

---

### FASE 11 — Testes completos

| ID | Título | Prioridade | Projeto | Tamanho |
|----|--------|-----------|---------|---------|
| F11-01 | Unit tests (services) | P1 | Backend | G |
| F11-02 | Integration tests (API) | P1 | Backend | G |
| F11-03 | Frontend component tests | P2 | Frontend | G |
| F11-04 | E2E: fluxo completo de compra | P2 | Ambos | G |
| F11-05 | Load test estoque concorrente | P2 | Backend | M |
| F11-06 | Webhook replay tests | P2 | Backend | M |

**Critério de saída:**
- ✅ Fluxo de compra passa automaticamente
- ✅ Coverage > 60% nos services críticos

---

### FASE 12 — Deploy, observabilidade e operação

| ID | Título | Prioridade | Projeto | Tamanho |
|----|--------|-----------|---------|---------|
| F12-01 | Dockerfile backend | P1 | Backend | M |
| F12-02 | Dockerfile frontend (nginx) | P1 | Frontend | M |
| F12-03 | docker-compose produção | P1 | Ambos | M |
| F12-04 | GitHub Actions CI | P1 | Ambos | M |
| F12-05 | Migration pipeline | P1 | Backend | M |
| F12-06 | Sentry integration | P2 | Ambos | M |
| F12-07 | Backup PostgreSQL (cron) | P1 | Infra | M |
| F12-08 | Rollback strategy | P2 | Infra | M |
| F12-09 | Runbook operacional | P2 | Docs | M |

**Critério de saída:**
- ✅ Sistema publicável e recuperável com segurança
- ✅ Rollback possível em < 5 minutos
- ✅ Erros são alertados automaticamente

---

## RESUMO EXECUTIVO

### Estado atual

| Projeto | Completude | O que funciona |
|---------|-----------|----------------|
| Backend | ~13% funcional | Nada executa. Código de serviço ~70% escrito. |
| Frontend | ~60% UI, 0% integração | UI renderiza com dados estáticos. Zero API calls. |
| Integração | 0% | Projetos não se comunicam de nenhuma forma. |

### Métricas

| Métrica | Valor |
|---------|-------|
| Bloqueadores P0 | 12 |
| Tasks P1 (MVP) | 28 |
| Tasks P2 (Pós-MVP) | 18 |
| Tasks P3 (Estratégico) | 8 |
| Total de tasks | ~66 |
| Fases do roadmap | 13 (0-12) |
| Estimativa para MVP funcional | Fases 0-6 (~40-50 tasks) |

### Principais riscos

1. **Schema rewrite pode quebrar código existente** — Mitigação: fazer iterativamente com tsc checking
2. **Mercado Pago sandbox pode ter limitações** — Mitigação: adapter pattern permite trocar
3. **Performance do Redis como cache obrigatório** — Mitigação: fallback graceful (já implementado)
4. **Concorrência de estoque** — Mitigação: transaction + SELECT FOR UPDATE
5. **Tempo de setup para novo dev** — Mitigação: docker-compose + .env.example + README

### Ordem de execução

```
FASE 0 (Estabilização) → FASE 1 (API Client) → FASE 2 (Auth) → FASE 3 (Catálogo)
    → FASE 4 (Carrinho) → FASE 5 (Checkout) → FASE 6 (Pagamentos)
        → FASE 7 (Frete) → FASE 8 (Notificações) → FASE 9 (Admin)
            → FASE 10 (Segurança) → FASE 11 (Testes) → FASE 12 (Deploy)
```

### O que NÃO fazer agora

- ❌ Não migrar para monorepo antes de estabilizar
- ❌ Não integrar gateway de pagamento antes de ter checkout
- ❌ Não implementar cupons/wishlist/reviews (P2)
- ❌ Não criar admin antes de ter produtos funcionais
- ❌ Não escrever testes E2E antes de ter o fluxo completo
- ❌ Não configurar CI/CD antes de ter testes básicos

### Definição de MVP

O MVP é atingido quando um usuário consegue:
1. Ver produtos na loja
2. Adicionar ao carrinho
3. Criar conta / fazer login
4. Informar endereço
5. Calcular frete
6. Realizar pagamento (sandbox)
7. Acompanhar status do pedido

E um admin consegue:
1. Gerenciar produtos e estoque
2. Visualizar e atualizar pedidos
