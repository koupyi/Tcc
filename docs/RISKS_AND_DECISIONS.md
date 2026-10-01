# RISCOS E DECISÕES

> Data: 2026-08-06

---

## DECISÕES TÉCNICAS

### D-001: Monorepo vs. Repositórios Separados

**Decisão:** Monorepo (recomendado), com migração gradual.

**Justificativa:**
- Tipos compartilhados entre frontend e backend
- Docker-compose único para dev
- CI/CD coordenado
- Equipe pequena (1-3 devs)

**Implementação:** Sprint 1 mantém pastas atuais. Migrar para monorepo após estabilização.

---

### D-002: Gateway de Pagamento

**Decisão:** Mercado Pago

**Justificativa:**
- Projeto brasileiro (preços em BRL, endereços com CEP)
- Mercado Pago tem melhor suporte para Brasil
- env.ts já prevê STRIPE como alternativa
- Adapter pattern permite trocar no futuro

**Alternativa descartada:** Stripe (melhor docs, mas taxas maiores para BRL e menos métodos locais)

---

### D-003: Carrinho Anônimo

**Decisão:** Dual — localStorage para anônimo + API para autenticado + merge no login

**Justificativa:**
- Permite UX sem forçar cadastro
- Backend já tem cart service server-side
- Merge evita perda de itens

**Complexidade:** Alta (G) — mas essencial para conversão

---

### D-004: Builder como parte do catálogo

**Decisão:** Builder products serão variantes de produtos do banco, filtrados por tags/categorias

**Justificativa:**
- Não criar modelo paralelo
- Validação de compatibilidade continua no frontend (performance)
- Backend pode validar na criação do pedido se necessário

**Implementação:** Categoria "Builder Components" com subcategorias switch/keycap/pcb/case. Atributos de compatibilidade nas variantes.

---

### D-005: Gerenciador de pacotes

**Decisão:** npm para backend, bun para frontend (manter o que já existe)

**Justificativa:**
- Backend não tem lock file — gerar com npm (padrão Node)
- Frontend já tem bun.lock e bun.lockb — manter bun
- Em eventual monorepo: migrar ambos para pnpm

---

### D-006: Prisma schema — reescrever ou patch?

**Decisão:** Reescrever completamente

**Justificativa:**
- Divergência é tão grande (12+ modelos ausentes) que patches seriam confusos
- Os services já definem a estrutura correta implicitamente
- Melhor gerar schema correto de uma vez e adaptar o seed

---

### D-007: Redis obrigatório?

**Decisão:** Opcional (graceful degradation)

**Justificativa:**
- Código já faz try/catch em cache operations
- Em dev, se Redis não estiver up, tudo funciona sem cache
- Em produção, Redis deve estar presente para performance

---

## RISCOS IDENTIFICADOS

### R-001: Schema rewrite quebra código

| Aspecto | Detalhe |
|---------|---------|
| Probabilidade | Média |
| Impacto | Alto |
| Mitigação | Fazer iterativamente: gerar schema → rodar `tsc` → corrigir imports → repetir |
| Contingência | Se ficar inviável, criar novo schema do zero e adaptar services |

---

### R-002: Mercado Pago sandbox com limitações

| Aspecto | Detalhe |
|---------|---------|
| Probabilidade | Baixa |
| Impacto | Médio |
| Mitigação | Adapter pattern; mock gateway para testes |
| Contingência | Trocar para Stripe se Mercado Pago não atender |

---

### R-003: Race condition no estoque

| Aspecto | Detalhe |
|---------|---------|
| Probabilidade | Baixa (volume inicial) |
| Impacto | Alto (overselling) |
| Mitigação | Prisma $transaction + check constraint (stockQty >= 0) |
| Contingência | Implementar reserva com TTL (Fase 10) |

---

### R-004: Dados do frontend hardcoded demais

| Aspecto | Detalhe |
|---------|---------|
| Probabilidade | Alta |
| Impacto | Médio |
| Mitigação | Refatorar gradualmente: manter dados estáticos como fallback, adicionar API calls |
| Contingência | Homepage pode usar dados estáticos no MVP; apenas products/cart precisam de API |

---

### R-005: Performance sem CDN

| Aspecto | Detalhe |
|---------|---------|
| Probabilidade | Baixa (volume inicial) |
| Impacto | Médio |
| Mitigação | Imagens otimizadas (WebP via Sharp), Redis cache, paginação |
| Contingência | Adicionar CloudFlare ou S3+CloudFront se necessário |

---

### R-006: Dependência de um único desenvolvedor

| Aspecto | Detalhe |
|---------|---------|
| Probabilidade | Alta |
| Impacto | Alto (bus factor = 1) |
| Mitigação | Documentação completa, código bem estruturado, README de onboarding |
| Contingência | Projeto é open source e bem organizado para onboarding |

---

## DEPENDÊNCIAS EXTERNAS

| Dependência | Para que | Obrigatória MVP? | Alternativa |
|-------------|----------|-----------------|-------------|
| PostgreSQL | Banco de dados | ✅ Sim | — |
| Redis | Cache + filas futuras | ⚠️ Opcional dev | Sem cache em dev |
| Mercado Pago | Pagamentos | ✅ Sim (sandbox) | Stripe, simulação |
| SMTP Server | E-mails | ✅ Sim | Mailtrap (dev), SendGrid |
| Node.js ≥ 18 | Runtime backend | ✅ Sim | — |
| Bun ≥ 1.0 | Runtime frontend (dev) | ⚠️ npm funciona | npm |
| Docker | Dev local + deploy | ⚠️ Recomendado | Instalar PG/Redis local |
