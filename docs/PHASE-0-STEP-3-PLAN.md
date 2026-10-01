# FASE 0 / ETAPA 3 — PLANO DE EXECUÇÃO

> Data: 2026-08-07
> Referência: ROADMAP.md → FASE 3 — Catálogo e Produtos
> Pré-requisito: FASE 0 / ETAPA 2 ✅ CONCLUÍDA

---

## 1. Resumo Executivo

### Objetivo

Implementar a **FASE 3 do roadmap oficial** — Catálogo e Produtos — que tem como meta:

> "Produtos do banco aparecem na loja."

### Estado Atual

```
Frontend
 ↓
ProductsPage → API real (5 produtos do seed, listagem básica)
 ↓
NÃO EXISTE: página de detalhe /products/:slug
NÃO EXISTE: galeria de imagens
NÃO EXISTE: seletor de variantes
NÃO EXISTE: informação de estoque
NÃO EXISTE: busca server-side
NÃO EXISTE: paginação real
```

O backend já possui todos os endpoints necessários:
- `GET /api/v1/products` (listagem com filtros, paginação)
- `GET /api/v1/products/slug/:slug` (detalhe com variantes e imagens)
- `GET /api/v1/products/:id` (detalhe por ID)

### Resultado Esperado

```
Frontend
 ↓
ProductsPage → API com busca, filtros e paginação
 ↓
ProductDetailPage → /products/:slug com variantes, galeria, estoque
 ↓
Seleção de variante → adicionar ao carrinho com variantId correto
 ↓
Estoque visível → produto esgotado não adicionável
```

---

## 2. Objetivos Técnicos

### Funcionalidades liberadas

1. **Página de detalhe do produto** (`/products/:slug`) — Cliente vê informações completas, imagens, variantes
2. **Seletor de variantes** — Cliente escolhe switch, layout, cor antes de adicionar ao carrinho
3. **Galeria de imagens** — Imagens do produto/variante com navegação
4. **Estoque visível** — Disponibilidade por variante, produto esgotado bloqueado
5. **Busca server-side** — Input de busca que consulta a API
6. **Paginação real** — Navegação entre páginas de produtos via API
7. **Filtros via API** — Categoria, faixa de preço, ordenação enviados como query params

### Problemas resolvidos

- GAP-013 (Frontend sem página de detalhe do produto) → **RESOLVIDO COMPLETAMENTE**
- Incompatibilidade estrutural do modelo de produto → **RESOLVIDO** (ProductsPage já mapeia API)
- Frontend AUDIT item #9 (Página de detalhe ❌) → **RESOLVIDO**
- Frontend AUDIT item #8 (Paginação ❌) → **RESOLVIDO**
- Frontend AUDIT item #4 (Busca ❌) → **RESOLVIDO**
- Frontend AUDIT item #11 (Seleção de variantes apenas no Builder) → **RESOLVIDO** na loja
- Frontend AUDIT item #13 (Estoque não mostrado) → **RESOLVIDO**
- Frontend AUDIT item #29 (Produto esgotado sem indicação) → **RESOLVIDO**

---

## 3. Relação com Auditoria

| Problema encontrado | Documento | Solução da Etapa 3 |
|---|---|---|
| GAP-013: Frontend sem página de detalhe do produto | INTEGRATION_GAPS.md | Criar `/products/:slug` com galeria, variantes, estoque |
| Frontend #9: NÃO EXISTE rota /products/:id | FRONTEND_AUDIT.md | Criar rota e página completa |
| Frontend #8: Paginação não existe | FRONTEND_AUDIT.md | Implementar com meta do backend |
| Frontend #4: Não existe campo de busca | FRONTEND_AUDIT.md | Adicionar input de busca com debounce |
| Frontend #11: Seleção de variantes apenas no Builder | FRONTEND_AUDIT.md | Criar seletor na página de detalhe |
| Frontend #13: Estoque não verificado/mostrado | FRONTEND_AUDIT.md | Mostrar stockQty, bloquear se 0 |
| Frontend #29: Produto esgotado sem indicação | FRONTEND_AUDIT.md | Badge "Esgotado", botão desabilitado |
| API_FRONTEND #Produtos-Detalhe: getBySlug pronto, sem frontend | API_FRONTEND_COMPATIBILITY.md | Consumir endpoint existente |
| API_FRONTEND #Paginação: meta pronta, sem frontend | API_FRONTEND_COMPATIBILITY.md | Consumir meta.totalPages, hasNext, etc |
| API_FRONTEND #Filtros: backend suporta, frontend filtra local | API_FRONTEND_COMPATIBILITY.md | Enviar como query params |
| API_FRONTEND #Estoque: stockQty existe, frontend ignora | API_FRONTEND_COMPATIBILITY.md | Exibir e validar antes de add to cart |

---

## 4. Escopo Backend

### Arquivos que serão alterados

O backend já está **completo** para esta fase. Alterações mínimas:

| Arquivo | Alteração | Motivo |
|---------|-----------|--------|
| `repositories/product.repository.ts` | Nenhuma (ou mínima) | Já inclui variantes no listing |
| `services/product.service.ts` | Nenhuma esperada | Listagem, detalhe, filtros já implementados |
| Nenhum controller novo | — | Endpoints já existem |

### Endpoints envolvidos (já existentes)

| Método | Endpoint | Objetivo |
|--------|----------|----------|
| GET | `/api/v1/products` | Listagem com paginação/filtros |
| GET | `/api/v1/products/slug/:slug` | Detalhe completo (variantes + imagens) |
| GET | `/api/v1/products/:id` | Detalhe por ID |

**Query params suportados pelo backend (já implementados):**
- `page`, `limit` — paginação
- `search` — busca por nome/descrição/brand/sku
- `categoryId` — filtro por categoria
- `brand` — filtro por marca
- `minPrice`, `maxPrice` — faixa de preço
- `sortBy` — campo de ordenação (price, name, createdAt)
- `sortOrder` — asc/desc

### Banco de dados

- **Tabelas existentes utilizadas:** products, product_variants, images, categories
- **Novas tabelas:** NENHUMA
- **Alterações Prisma:** NENHUMA
- **Migrations:** NENHUMA necessária

### Regras de negócio

- Produto com `isActive: false` ou `deletedAt != null` → NÃO aparece na loja
- Variante com `isActive: false` ou `deletedAt != null` → NÃO aparece no detalhe
- Variante com `stockQty: 0` → exibida como "Esgotada", botão desabilitado
- Adição ao carrinho requer `variantId` com estoque > 0

---

## 5. Escopo Frontend

### Páginas afetadas

| Página | Ação |
|--------|------|
| `ProductsPage.tsx` | Refatorar: adicionar busca, paginação real, filtros via API, link para detalhe |
| `ProductDetailPage.tsx` | **CRIAR** — página completa de detalhe |
| `App.tsx` | Adicionar rota `/products/:slug` |

### Componentes necessários (criar)

| Componente | Responsabilidade |
|------------|-----------------|
| `ProductDetailPage` | Página principal de detalhe |
| `ProductGallery` | Galeria de imagens com thumb navigation |
| `VariantSelector` | Seletor de variante (switch, layout, cor) |
| `StockBadge` | Indicação de disponibilidade |
| `PriceDisplay` | Exibe basePrice/salePrice com formatação |
| `SearchInput` | Input de busca com debounce |
| `Pagination` | Navegação entre páginas |

### Contexts afetados

| Context | Alteração |
|---------|-----------|
| CartContext | Nenhuma — já aceita `variantId` |
| AuthContext | Nenhuma |

### Hooks necessários

| Hook | Funcionalidade |
|------|---------------|
| `useProducts` | Fetch lista com params (search, page, category, sort) |
| `useProduct` | Fetch detalhe por slug |
| `useDebounce` | Debounce para busca |

### Integrações API necessárias

| API call | Quando |
|----------|--------|
| `productsApi.list(params)` | ProductsPage mount + filtros/busca/paginação mudam |
| `productsApi.getBySlug(slug)` | ProductDetailPage mount |

### Como o frontend deixará de usar dados estáticos

- ProductsPage já busca da API (Etapa 2). Será estendida com paginação e busca.
- ProductDetailPage consumirá `getBySlug` — nenhum dado estático.
- O import de `data/products.ts` na ProductsPage será mantido apenas como fallback (se API offline).
- Novos componentes nunca usarão dados estáticos.

---

## 6. Arquitetura Impactada

### ANTES (estado atual):

```
Frontend
 ↓
ProductsPage → lista simples da API (sem paginação, sem busca)
 ↓
Clique no produto → NADA ACONTECE (sem link, sem detalhe)
 ↓
"Adicionar" → variante default (sem escolha do usuário)
```

### DEPOIS (resultado da Etapa 3):

```
Frontend
 ↓
ProductsPage
 ├── SearchInput → GET /products?search=...
 ├── CategoryFilter → GET /products?categoryId=...
 ├── SortSelect → GET /products?sortBy=...&sortOrder=...
 ├── Pagination → GET /products?page=N&limit=12
 └── ProductCard → Link → /products/:slug
         ↓
ProductDetailPage
 ├── ProductGallery → imagens do produto/variante
 ├── VariantSelector → escolha de switch/layout/cor
 ├── StockBadge → stockQty da variante selecionada
 ├── PriceDisplay → preço da variante ou basePrice
 └── AddToCartButton → POST /cart/items { variantId, quantity }
         ↓
CartContext → API real com variantId selecionado
         ↓
PostgreSQL (carrinho persistido)
```

---

## 7. Plano de Implementação

### FASE A — Preparação

1. Verificar que o backend retorna dados completos para `getBySlug` (variantes, imagens, categoria, estoque)
2. Verificar que paginação retorna meta correta (`total, page, limit, totalPages, hasNext, hasPrev`)
3. Confirmar schema de resposta documentado
4. Criar seed adicional se necessário (mais variantes/imagens para demonstrar galeria)

### FASE B — Backend

1. Verificar se `getBySlug` retorna imagens ordenadas por `sortOrder`
2. Verificar se filtros/paginação funcionam corretamente (testar via curl)
3. Se necessário, ajustar seed para ter produtos com múltiplas variantes e imagens para demo

### FASE C — Banco

- **Nenhuma migration necessária**
- Possível enriquecimento do seed:
  - Adicionar variantes extras (cor, switch) a produtos existentes
  - Adicionar mais imagens por produto para testar galeria
  - Adicionar descrições aos produtos

### FASE D — Frontend

1. **Rota:** Adicionar `/products/:slug` em App.tsx
2. **ProductDetailPage:** Criar com galeria, variantes, estoque, preço, add to cart
3. **ProductGallery:** Componente de galeria de imagens
4. **VariantSelector:** Seleção dinâmica baseada em atributos da variante
5. **StockBadge:** Indicador visual de disponibilidade
6. **PriceDisplay:** Componente de preço com sale/base
7. **SearchInput:** Input com debounce
8. **Pagination:** Componente de paginação
9. **ProductsPage:** Refatorar para usar busca, paginação, links para detalhe
10. **ProductCard:** Adicionar Link para `/products/:slug`
11. **Loading states:** Skeleton/spinner para lista e detalhe
12. **Error states:** Mensagens de erro para API failures

### FASE E — Testes

1. **Backend:** Testar `getBySlug`, filtros, paginação (adicionar ao test suite existente)
2. **Frontend:** Testar ProductDetailPage, VariantSelector, busca, paginação
3. **E2E:** Fluxo: listar → buscar → filtrar → abrir detalhe → selecionar variante → add to cart → verificar carrinho

### FASE F — Documentação

1. Atualizar `docs/PHASE-0-STEP-3-REPORT.md` com resultados
2. Documentar endpoints utilizados e formato de resposta

---

## 8. Plano de Testes

### Backend

| Teste | Endpoint | Validação |
|-------|----------|-----------|
| Listagem com paginação | GET /products?page=1&limit=2 | Retorna 2 items + meta.totalPages > 1 |
| Busca por nome | GET /products?search=RGB | Retorna apenas produtos com "RGB" |
| Filtro por categoria | GET /products?categoryId=X | Retorna apenas dessa categoria |
| Ordenação por preço | GET /products?sortBy=price&sortOrder=asc | Primeiro item é mais barato |
| Detalhe por slug | GET /products/slug/teclado-mecanico-red | Retorna produto com variantes e imagens |
| Slug inexistente | GET /products/slug/nao-existe | Retorna 404 |
| Variantes no detalhe | GET /products/slug/:slug | Variantes com stockQty visível |

### Frontend

| Teste | Componente | Validação |
|-------|------------|-----------|
| Renderiza lista de produtos | ProductsPage | Exibe cards com dados da API |
| Busca filtra resultados | SearchInput | Digitar texto → produtos filtrados |
| Paginação navega | Pagination | Clicar próxima → novos produtos |
| Detalhe carrega | ProductDetailPage | Slug da URL → dados do produto |
| Variante selecionável | VariantSelector | Clicar variante → preço/estoque atualizam |
| Esgotado bloqueia | AddToCartButton | stockQty=0 → botão disabled |
| Add to cart funciona | ProductDetailPage | Selecionar variante → adicionar → toast + cart atualizado |
| Loading state | ProductDetailPage | Enquanto carrega → skeleton/spinner |
| Erro 404 | ProductDetailPage | Slug inexistente → mensagem de erro |

### E2E

```
1. Acessar /products
2. Verificar produtos do seed aparecem
3. Digitar "Red" na busca
4. Verificar apenas "Teclado Mecânico RGB Red Switch" aparece
5. Limpar busca
6. Clicar no primeiro produto
7. Verificar redirecionamento para /products/:slug
8. Verificar imagens carregam
9. Verificar variantes aparecem
10. Selecionar uma variante
11. Verificar preço e estoque atualizam
12. Clicar "Adicionar ao carrinho" (autenticado)
13. Verificar carrinho tem o item com variantId correto
14. Voltar para /products
15. Navegar para página 2 (se houver dados suficientes)
16. Verificar produtos mudam
```

---

## 9. Critérios de Aceite

A etapa somente será considerada concluída quando:

### Infraestrutura
- [ ] Nenhuma migration nova necessária — banco inalterado
- [ ] Seed enriquecido (se necessário) executado sem erros

### Backend
- [ ] GET /products com paginação validada
- [ ] GET /products com busca validada
- [ ] GET /products/slug/:slug retorna produto completo
- [ ] Testes backend adicionados e passando
- [ ] tsc --noEmit → 0 erros

### Frontend
- [ ] Rota /products/:slug criada e funcional
- [ ] ProductDetailPage exibe dados reais
- [ ] Galeria de imagens funciona
- [ ] Seletor de variantes funciona
- [ ] Estoque visível por variante
- [ ] Produto esgotado → botão desabilitado
- [ ] Adicionar ao carrinho usa variantId selecionado
- [ ] Busca server-side funciona na ProductsPage
- [ ] Paginação funciona na ProductsPage
- [ ] Link dos cards direciona para detalhe
- [ ] Loading states implementados
- [ ] Error states implementados
- [ ] tsc --noEmit → 0 erros
- [ ] npm run build → OK
- [ ] Testes frontend passando

### E2E
- [ ] Listar produtos → buscar → filtrar
- [ ] Abrir detalhe via slug
- [ ] Selecionar variante
- [ ] Verificar estoque
- [ ] Adicionar ao carrinho
- [ ] Carrinho reflete item com variante correta
- [ ] Paginação navega entre páginas

### Qualidade
- [ ] Sem mocks ou dados falsos
- [ ] Sem URLs hardcoded
- [ ] Responsividade testada
- [ ] Componentes < 200 linhas
- [ ] Tipos explícitos (sem `any`)

---

## 10. Estimativa Técnica

### Complexidade

| Aspecto | Avaliação |
|---------|-----------|
| Backend | **Baixa** — endpoints já existem e funcionam |
| Banco | **Nenhuma** — sem migrations |
| Frontend | **Média-Alta** — criar página completa + componentes + integração |
| Testes | **Média** — testes de integração + unitários + E2E |

### Arquivos impactados

| Camada | Novos | Alterados |
|--------|-------|-----------|
| Backend | 0-1 (test) | 0-1 (seed para demo) |
| Frontend pages | 1 (ProductDetailPage) | 2 (ProductsPage, App.tsx) |
| Frontend components | 5-7 novos | 0 |
| Frontend hooks | 2-3 novos | 0 |
| Frontend tests | 2-4 novos | 0 |
| Docs | 1 (report) | 0 |
| **Total estimado** | **~12-15 arquivos** | **~3-4 arquivos** |

### Possíveis dificuldades

1. **Seed com poucos dados** — apenas 5 produtos com 1 variante cada e imagem placeholder. Pode ser necessário enriquecer para demonstrar galeria e seletor de variantes adequadamente.
2. **Paginação com 5 produtos** — com apenas 5 items, paginação de 12/page não demonstra navegação. Pode ser necessário usar `limit=2` para demo ou adicionar mais produtos ao seed.
3. **Imagens placeholder** — todas as imagens são `via.placeholder.com/300`. A galeria pode parecer vazia/repetitiva. Não é bloqueador funcional.
4. **Compatibilidade com Builder** — o BuilderPage usa `addItem` sem `variantId` (dados estáticos). Essa página NÃO será alterada nesta etapa, mantendo comportamento local.

### Dependências

- Nenhuma nova dependência npm necessária no backend
- Frontend: nenhuma nova dependência obrigatória (todos os componentes UI já existem via shadcn)
- Possível uso de componentes Radix existentes para galeria/tabs

---

## Apêndice: Tasks do Roadmap Cobertas

| ID | Título | Status pós Etapa 3 |
|----|--------|---------------------|
| F3-01 | Conectar ProductsPage à API | ✅ (iniciado na Etapa 2, completado aqui com busca/paginação) |
| F3-02 | Criar página /products/:slug | ✅ |
| F3-03 | Galeria de imagens no detalhe | ✅ |
| F3-04 | Seletor de variantes no detalhe | ✅ |
| F3-05 | Mostrar estoque/disponibilidade | ✅ |
| F3-06 | Busca server-side | ✅ |
| F3-07 | Paginação real | ✅ |
| F3-08 | Upload de imagens (admin) | ⚪ Fora do escopo (FASE 9) |
| F3-09 | Admin: CRUD de produtos (tela) | ⚪ Fora do escopo (FASE 9) |
| F3-10 | Admin: gerenciar variantes | ⚪ Fora do escopo (FASE 9) |
| F3-11 | Categorias dinâmicas | 🟡 Parcial (categorias vêm da API, sem CRUD admin) |

---

*Plano gerado em 2026-08-07. Aguardando aprovação para implementação.*
