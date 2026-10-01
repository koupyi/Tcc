# MVP SCOPE — Qwerty Build Hub

> Data: 2026-08-06

---

## Definição de MVP

O MVP (Minimum Viable Product) é a versão mínima que permite **vender um produto online** com segurança. Corresponde às Fases 0-6 do roadmap.

---

## O que ESTÁ no MVP

### Para o cliente:
- [x] Ver catálogo de produtos com imagens, preço, variantes
- [x] Buscar e filtrar produtos
- [x] Ver página de detalhe com variantes e estoque
- [x] Adicionar ao carrinho (anônimo e autenticado)
- [x] Criar conta e fazer login
- [x] Informar endereço de entrega
- [x] Calcular frete (tabela fixa por região)
- [x] Finalizar checkout com resumo
- [x] Pagar via Mercado Pago (sandbox → produção)
- [x] Acompanhar status do pedido
- [x] Receber emails de confirmação

### Para o admin:
- [x] Dashboard com métricas básicas
- [x] CRUD de produtos e variantes
- [x] Upload de imagens
- [x] Gerenciar estoque
- [x] Visualizar e atualizar status de pedidos
- [x] Auditoria básica de ações

### Técnico:
- [x] Backend com API RESTful funcional
- [x] Autenticação JWT com refresh tokens
- [x] Validação de input (Zod)
- [x] Rate limiting
- [x] CORS seguro
- [x] Helmet headers
- [x] Health check
- [x] Docker-compose para dev local
- [x] Testes unitários dos services críticos (auth, cart, order)
- [x] CI básico (lint + typecheck + test + build)
- [x] Documentação de setup

---

## O que NÃO está no MVP

| Feature | Motivo | Fase planejada |
|---------|--------|---------------|
| Cupons de desconto | Complexidade vs. valor initial | P2 - Fase pós-MVP |
| Wishlist / Favoritos | Não bloqueia venda | P2 |
| Reviews/Avaliações | Não bloqueia venda | P2 |
| Salvar builds do Builder | UX nice-to-have | P2 |
| Tracking avançado (transportadora) | Tabela fixa é suficiente | P2 |
| Multi-idioma | Brasil only no MVP | P3 |
| NFe / Fiscal | Pode ser manual inicialmente | P3 |
| Feature flags | Não justifica a complexidade | P3 |
| Antifraude avançado | Gateway cuida do básico | P3 |
| S3 para uploads | Local é suficiente para volume inicial | P2 |
| E2E tests (Playwright) | Testes manuais no MVP | P2 |
| Sentry | Console logging suficiente no início | P2 |

---

## Fluxo E2E do MVP

```
1. Visitante acessa a loja (HomePage)
2. Navega para /products → vê catálogo paginado
3. Clica em produto → /products/:slug com variantes
4. Seleciona variante → adiciona ao carrinho
5. (Opcional) Ajusta quantidade no /cart
6. Clica "Finalizar compra"
7. Se não logado → redirect /login → cria conta ou faz login
8. Carrinho anônimo mesclado com autenticado
9. Informa endereço de entrega
10. Seleciona opção de frete
11. Revisa resumo do pedido
12. Confirma → pedido PENDING criado
13. Redirect para Mercado Pago → paga
14. Webhook → pedido muda para PAID/CONFIRMED
15. E-mail de confirmação enviado
16. Cliente vê pedido em /orders/:id
17. Admin atualiza status → SHIPPED com tracking
18. Cliente vê status atualizado
```

---

## Critério de aceite do MVP

O MVP é considerado **concluído** quando:

1. ✅ Um cliente real consegue completar o fluxo E2E acima
2. ✅ O pagamento sandbox do Mercado Pago funciona
3. ✅ O admin consegue gerenciar produtos e pedidos
4. ✅ O sistema pode rodar em um servidor (Docker)
5. ✅ Existe backup do banco de dados
6. ✅ Não existem vulnerabilidades críticas conhecidas
7. ✅ Documentação permite setup por novo desenvolvedor em < 30 min
