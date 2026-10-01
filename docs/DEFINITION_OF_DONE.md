# DEFINITION OF DONE

> Critérios para considerar uma task, feature ou release como concluída.

---

## Task-level (cada task individual)

Uma task está DONE quando:

- [ ] Código implementado conforme especificação
- [ ] TypeScript compila sem erros (`tsc --noEmit`)
- [ ] Lint passa sem warnings (`eslint`)
- [ ] Testes unitários escritos e passando (para services/utils)
- [ ] Endpoint testado manualmente (cURL ou Postman/Insomnia)
- [ ] Tratamento de erros implementado (AppError, validação, edge cases)
- [ ] Dados sensíveis não expostos em logs ou respostas
- [ ] Documentação atualizada se API mudou (novo endpoint/campo)
- [ ] Code review feito (ou auto-review se solo)

---

## Feature-level (funcionalidade completa)

Uma feature está DONE quando:

- [ ] Todas as tasks da feature estão DONE
- [ ] Backend e frontend integrados e funcionais end-to-end
- [ ] Loading states implementados no frontend
- [ ] Error states implementados no frontend
- [ ] Empty states implementados (quando aplicável)
- [ ] Responsividade testada (mobile + desktop)
- [ ] Validação de input funciona (frontend + backend)
- [ ] Rate limiting não bloqueia uso normal
- [ ] Performance aceitável (< 500ms para listagens, < 200ms para operações)
- [ ] Teste de integração cobrindo o happy path
- [ ] Fluxo testado com dados reais (não só seeds)

---

## Sprint-level

Um sprint está DONE quando:

- [ ] Todas as features planejadas estão DONE
- [ ] Build passa sem erros (frontend + backend)
- [ ] Todos os testes passam
- [ ] Nenhum bug bloqueador aberto
- [ ] Demo funcional pode ser apresentada
- [ ] Documentação de progresso atualizada
- [ ] Próximo sprint planejado

---

## Release-level (deploy para staging/produção)

Uma release está DONE quando:

- [ ] Sprint DONE + critérios adicionais:
- [ ] Migrations testadas em staging
- [ ] Rollback testado
- [ ] Health checks respondendo
- [ ] Logs coletando corretamente
- [ ] Variáveis de ambiente corretas em produção
- [ ] Backup do banco funcional
- [ ] Monitoramento configurado (pelo menos errors)
- [ ] Performance testada com carga simulada
- [ ] Sem segredos em código versionado
- [ ] CHANGELOG atualizado

---

## Qualidade de código

Padrões a seguir em todo código novo:

### Backend
- Services retornam dados; controllers retornam HTTP
- Repositories encapsulam acesso ao banco
- Validators com Zod para todo input externo
- AppError para erros operacionais
- Logger para tudo significativo
- Transações para operações multi-tabela
- Soft delete quando aplicável
- Paginação em toda listagem

### Frontend
- Componentes < 200 linhas (extrair sub-componentes)
- Hooks customizados para lógica reutilizável
- React Query para server state
- Context apenas para state verdadeiramente global
- Tipos explícitos (não `any`)
- Loading/error/empty states em toda página com dados
- Acessibilidade: labels, keyboard nav, aria attributes
- Internacionalização: textos em PT-BR, formatação BRL
