# FASE 3 — PLANO DE IMPLEMENTAÇÃO

> Data: 2026-08-07
> Status: Aguardando aprovação

---

## 1. Confirmação Pré-Implementação

### Objetivo Oficial da FASE 3
"Produtos do banco aparecem na loja." — ROADMAP.md, FASE 3 — Catálogo e Produtos

### Tasks a implementar
- F3-01: Conectar ProductsPage à API completamente (busca, paginação, filtros)
- F3-02: Criar página /products/:slug
- F3-03: Galeria de imagens no detalhe
- F3-04: Seletor de variantes no detalhe
- F3-05: Mostrar estoque/disponibilidade
- F3-06: Busca server-side
- F3-07: Paginação real
- F3-11: Categorias dinâmicas (consumo público)

### Fora do escopo
- F3-08: Upload de imagens (FASE 9)
- F3-09: Admin CRUD de produtos (FASE 9)
- F3-10: Admin gerenciar variantes (FASE 9)

---

## 2. Contratos Validados

### GET /api/v1/products

```
Response: {
  success: true,
  message: string,
  data: Product[],
  meta: {
    total: number,
    page: number,
    limit: number,
    totalPages: number,
    hasNext: boolean,
    hasPrev: boolean
  }
}
```

**Query params suportados:**
- `page` (number)
- `limit` (number)
- `search` (string) — busca em name, description, brand, sku
- `categoryId` (UUID)
- `brand` (string)
- `sortBy` ("price" | "name" | "createdAt")
- `sortOrder` ("asc" | "desc")

**Product no listing:**
```typescript
{
  id: string           // UUID
  slug: string
  name: string
  description: string | null
  brand: string | null
  sku: string | null
  basePrice: string    // Decimal como string ("299.9")
  salePrice: string | null
  isFeatured: boolean
  isActive: boolean
  tags: string | null
  specs: Record<string, unknown> | null
  categoryId: string
  category: { id: string, name: string, slug: string }
  images: Array<{
    id: string, url: string, altText: string | null,
    isPrimary: boolean, sortOrder: number,
    // + width, height, sizeBytes, mimeType, productId, variantId, createdAt, category
  }>
  variants: Array<{
    id: string, name: string, sku: string,
    price: string | null, stockQty: number
  }>
  _count: { variants: number }
}
```

### GET /api/v1/products/slug/:slug

```
Response: { success: true, data: ProductDetail }
404: { success: false, message: "Produto não encontrado", code: "NOT_FOUND" }
```

**ProductDetail:**
```typescript
{
  id: string
  slug: string
  name: string
  description: string | null
  brand: string | null
  sku: string | null
  basePrice: number    // Note: number no detail (não string)
  salePrice: number | null
  isFeatured: boolean
  isActive: boolean
  tags: string | null
  specs: Record<string, unknown> | null
  categoryId: string
  category: { id: string, name: string, slug: string }
  images: Array<{
    id: string, url: string, altText: string | null,
    isPrimary: boolean, sortOrder: number
  }>
  variants: Array<{
    id: string
    name: string
    sku: string
    price: number | null       // Decimal
    stockQty: number
    isActive: boolean
    switchType: string | null
    layout: string | null
    color: string | null
    backlight: string | null
    connectivity: string | null
    weight: number | null
    images: Array<{ id: string, url: string, altText: string | null }>
  }>
}
```

---

## 3. Arquivos a Criar

| Arquivo | Tipo | Responsabilidade |
|---------|------|-----------------|
| `src/pages/ProductDetailPage.tsx` | Página | Detalhe do produto com galeria, variantes, estoque |
| `src/components/products/ProductGallery.tsx` | Componente | Galeria de imagens com thumb |
| `src/components/products/VariantSelector.tsx` | Componente | Seleção de variante |
| `src/components/products/StockBadge.tsx` | Componente | Indicação de estoque |
| `src/components/products/PriceDisplay.tsx` | Componente | Exibição de preço (base/sale) |
| `src/components/products/SearchInput.tsx` | Componente | Input de busca com debounce |
| `src/components/products/Pagination.tsx` | Componente | Navegação de páginas |
| `src/hooks/useProducts.ts` | Hook | Lista produtos com params |
| `src/hooks/useProduct.ts` | Hook | Detalhe por slug |
| `src/hooks/useDebounce.ts` | Hook | Debounce genérico |
| `src/types/product.ts` | Tipos | Interfaces TypeScript baseadas no contrato real |

## 4. Arquivos a Alterar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ProductsPage.tsx` | Reescrever: remover dados estáticos, usar hook useProducts, adicionar busca/paginação/filtros |
| `src/App.tsx` | Adicionar rota `/products/:slug` → ProductDetailPage |
| `src/api/products.ts` | Já existe — sem alteração (contrato correto) |

## 5. Arquivos NÃO alterados

- AuthContext — não tocado
- CartContext — não tocado (já aceita variantId)
- Backend — não tocado (endpoints 100% prontos)
- Prisma/migrations — não tocados

---

## 6. Estratégia de Implementação

### Ordem de execução:

1. **Tipos** (`src/types/product.ts`) — interfaces TypeScript a partir dos contratos validados
2. **Hooks** (useDebounce, useProducts, useProduct) — encapsulam chamadas à API
3. **Componentes de UI** (StockBadge, PriceDisplay, SearchInput, Pagination, ProductGallery, VariantSelector)
4. **ProductDetailPage** — composição dos componentes
5. **ProductsPage refatorada** — substituir dados estáticos por hooks
6. **App.tsx** — adicionar rota
7. **Testes** — backend, frontend, E2E
8. **Validação** — tsc, build, testes, E2E manual

### Princípios:

- Nenhum `any` — tipos explícitos baseados no contrato validado
- Nenhum dado estático — 100% API
- Nenhum fallback local — se API falha → error state
- Loading states em todas as páginas com dados
- Error states com mensagem + retry

---

## 7. Plano de Testes

### Backend (adicionar ao test suite existente)
- GET /products?page=1&limit=2 → retorna 2 items, meta.totalPages=3
- GET /products?search=Red → retorna 1 resultado
- GET /products?sortBy=price&sortOrder=asc → ordenação crescente
- GET /products/slug/teclado-mecanico-red → 200 com variantes
- GET /products/slug/inexistente → 404

### Frontend (Vitest)
- ProductsPage renderiza produtos da API (mock)
- SearchInput dispara busca com debounce
- Pagination navega entre páginas
- ProductDetailPage carrega e exibe produto
- VariantSelector altera variante selecionada
- StockBadge mostra "Disponível"/"Esgotado"
- Add to cart envia variantId correto

### E2E (curl/script)
1. Listar produtos
2. Buscar produto por nome
3. Abrir detalhe via slug
4. Verificar variantes
5. Verificar estoque
6. Login
7. Adicionar ao carrinho com variantId
8. Verificar carrinho persistido

---

## 8. Riscos

| Risco | Mitigação |
|-------|-----------|
| Seed com apenas 5 produtos | Usar limit=2 para demonstrar paginação |
| Produtos têm apenas 1 variante cada | Funcionalidade demonstrada; com mais variantes ficaria mais rico visualmente |
| Imagens placeholder | Não bloqueia funcionalidade; demonstra galeria |
| basePrice como string no listing | Converter com Number() no frontend |

---

## 9. Critérios de Aceite

```
[ ] ProductDetailPage (/products/:slug) funcional
[ ] Galeria de imagens funcional
[ ] Seletor de variantes funcional
[ ] Estoque visível (disponível/esgotado)
[ ] Busca server-side na ProductsPage
[ ] Paginação real na ProductsPage
[ ] Filtros via query params
[ ] Link do card → detalhe
[ ] Add to cart com variantId real
[ ] Loading states
[ ] Error states
[ ] Sem any
[ ] Sem dados estáticos
[ ] Sem mocks na produção
[ ] tsc --noEmit → 0 erros
[ ] npm run build → OK
[ ] Testes passando
[ ] E2E fluxo completo validado
```

---

*Plano gerado em 2026-08-07. Aguardando aprovação para implementar.*
