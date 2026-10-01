# VARIÁVEIS DE AMBIENTE

> Documentação completa de todas as variáveis necessárias para rodar o projeto.

---

## BACKEND

### Geral

| Variável | Tipo | Default | Obrigatória | Descrição |
|----------|------|---------|-------------|-----------|
| NODE_ENV | enum | development | Não | development, test, production |
| PORT | number | 3000 | Não | Porta do servidor |
| API_VERSION | string | v1 | Não | Prefixo das rotas (/api/v1) |

### Banco de Dados

| Variável | Tipo | Default | Obrigatória | Descrição |
|----------|------|---------|-------------|-----------|
| DATABASE_URL | string | — | ✅ SIM | URL PostgreSQL (ex: postgresql://user:pass@localhost:5432/qwerty) |

### JWT / Autenticação

| Variável | Tipo | Default | Obrigatória | Descrição |
|----------|------|---------|-------------|-----------|
| JWT_ACCESS_SECRET | string (min 32) | — | ✅ SIM | Segredo para assinar access tokens |
| JWT_REFRESH_SECRET | string (min 32) | — | ✅ SIM | Segredo para assinar refresh tokens |
| JWT_ACCESS_EXPIRES_IN | string | 15m | Não | Validade do access token |
| JWT_REFRESH_EXPIRES_IN | string | 7d | Não | Validade do refresh token |

### Argon2 (Hash de Senha)

| Variável | Tipo | Default | Obrigatória | Descrição |
|----------|------|---------|-------------|-----------|
| ARGON2_MEMORY_COST | number | 65536 | Não | Memória em KB |
| ARGON2_TIME_COST | number | 3 | Não | Iterações |
| ARGON2_PARALLELISM | number | 4 | Não | Threads |

### Redis / Cache

| Variável | Tipo | Default | Obrigatória | Descrição |
|----------|------|---------|-------------|-----------|
| REDIS_HOST | string | localhost | Não | Host do Redis |
| REDIS_PORT | number | 6379 | Não | Porta do Redis |
| REDIS_PASSWORD | string | — | Não | Senha do Redis |
| REDIS_DB | number | 0 | Não | Database number |

### CORS

| Variável | Tipo | Default | Obrigatória | Descrição |
|----------|------|---------|-------------|-----------|
| ALLOWED_ORIGINS | string | http://localhost:8080 | Não | Origins permitidas (separar com vírgula) |

### Upload de Imagens

| Variável | Tipo | Default | Obrigatória | Descrição |
|----------|------|---------|-------------|-----------|
| UPLOAD_PROVIDER | enum | local | Não | local ou s3 |
| UPLOAD_MAX_SIZE_MB | number | 5 | Não | Tamanho máximo por arquivo |
| UPLOAD_ALLOWED_TYPES | string | image/jpeg,image/png,image/webp | Não | MIME types permitidos |
| LOCAL_UPLOAD_PATH | string | ./uploads | Não | Pasta para uploads locais |

### AWS S3 (opcional, se UPLOAD_PROVIDER=s3)

| Variável | Tipo | Default | Obrigatória | Descrição |
|----------|------|---------|-------------|-----------|
| AWS_ACCESS_KEY_ID | string | — | Se S3 | AWS access key |
| AWS_SECRET_ACCESS_KEY | string | — | Se S3 | AWS secret key |
| AWS_REGION | string | — | Se S3 | Região do bucket |
| AWS_S3_BUCKET | string | — | Se S3 | Nome do bucket |

### Rate Limiting

| Variável | Tipo | Default | Obrigatória | Descrição |
|----------|------|---------|-------------|-----------|
| RATE_LIMIT_WINDOW_MS | number | 900000 | Não | Janela global (15 min) |
| RATE_LIMIT_MAX | number | 100 | Não | Máximo requests por janela |
| AUTH_RATE_LIMIT_MAX | number | 10 | Não | Máximo tentativas de login por janela |

### Logging

| Variável | Tipo | Default | Obrigatória | Descrição |
|----------|------|---------|-------------|-----------|
| LOG_LEVEL | enum | debug | Não | error, warn, info, debug |
| LOG_DIR | string | ./logs | Não | Diretório dos logs |

### Pagamentos (futuro)

| Variável | Tipo | Default | Obrigatória | Descrição |
|----------|------|---------|-------------|-----------|
| STRIPE_SECRET_KEY | string | — | Não | Chave secreta Stripe (se usar) |
| STRIPE_WEBHOOK_SECRET | string | — | Não | Secret para validar webhooks |
| MERCADOPAGO_ACCESS_TOKEN | string | — | MVP | Token de acesso Mercado Pago |
| MERCADOPAGO_WEBHOOK_SECRET | string | — | MVP | Secret para validar webhooks MP |

### E-mail

| Variável | Tipo | Default | Obrigatória | Descrição |
|----------|------|---------|-------------|-----------|
| SMTP_HOST | string | — | MVP | Host SMTP |
| SMTP_PORT | number | — | MVP | Porta SMTP |
| SMTP_USER | string | — | MVP | Usuário SMTP |
| SMTP_PASS | string | — | MVP | Senha SMTP |
| MAIL_FROM | string | — | MVP | Remetente (ex: noreply@qwerty.com) |
| APP_URL | string | — | MVP | URL pública do frontend (para links em emails) |

---

## FRONTEND

| Variável | Tipo | Default | Obrigatória | Descrição |
|----------|------|---------|-------------|-----------|
| VITE_API_URL | string | http://localhost:3000/api/v1 | ✅ SIM | URL base da API backend |
| VITE_APP_NAME | string | Qwerty Build Hub | Não | Nome da aplicação |
| VITE_MERCADOPAGO_PUBLIC_KEY | string | — | MVP | Public key do Mercado Pago |

---

## NOTAS DE SEGURANÇA

1. **NUNCA** commitar `.env` no repositório
2. Usar `.env.example` apenas com valores placeholder (sem segredos reais)
3. Em produção, usar secrets manager (AWS Secrets Manager, Vault, etc.)
4. JWT secrets devem ter no mínimo 32 caracteres aleatórios
5. DATABASE_URL em produção deve usar SSL (`?sslmode=require`)
6. ALLOWED_ORIGINS em produção deve listar APENAS o domínio real
