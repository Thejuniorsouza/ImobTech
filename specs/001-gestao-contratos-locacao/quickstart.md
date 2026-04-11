# Quickstart: Gestão de Contratos de Locação

**Feature Branch**: `001-gestao-contratos-locacao`
**Date**: 2026-04-11

## Prerequisites

- **Node.js** ≥ 18 (para frontend web e Supabase CLI)
- **Flutter** ≥ 3.x (para app mobile)
- **Supabase CLI** (`npm install -g supabase`) — para migrações locais e Edge Functions
- **Docker** (necessário para `supabase start` local)
- **Git** (repositório já inicializado)

## 1. Setup Supabase Local

```bash
# Na raiz do projeto
cd /Users/juniorsouza/Documents/Projetos/imobTech

# Iniciar Supabase local (PostgreSQL + Auth + Storage + Edge Functions)
supabase start

# Aplicar migrações
supabase db reset
```

O comando `supabase start` exibirá as URLs locais:

- **API URL**: `http://localhost:54321`
- **Anon Key**: (copiar para `.env`)
- **Service Role Key**: (copiar para `.env` — apenas server-side)
- **Studio**: `http://localhost:54323`

## 2. Setup Frontend Web (React + TypeScript)

```bash
cd web

# Instalar dependências
npm install

# Criar arquivo .env.local
cat > .env.local << 'EOF'
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<anon-key-do-supabase-start>
EOF

# Iniciar dev server
npm run dev
```

Acesse `http://localhost:5173`.

## 3. Setup Mobile (Flutter)

```bash
cd mobile

# Instalar dependências
flutter pub get

# Criar arquivo de configuração
# (variáveis de ambiente via --dart-define ou .env)
flutter run --dart-define=SUPABASE_URL=http://localhost:54321 \
            --dart-define=SUPABASE_ANON_KEY=<anon-key>
```

## 4. Seed Data

Após as migrações, o seed cria:

- 1 template de contrato padrão (residencial)
- 1 template de contrato padrão (comercial)

```bash
supabase db reset  # Executa migrations + seed.sql
```

## 5. Fluxo de Verificação Rápida

1. Abrir o web app → Cadastrar conta como proprietário
2. Verificar e-mail (Supabase Studio → Auth → Users para confirmar manualmente em dev)
3. Login → Dashboard vazio com CTA "Cadastrar Imóvel"
4. Cadastrar um imóvel com dados mínimos
5. Criar contrato → selecionar template → preencher dados → confirmar
6. Verificar: PDF gerado, faturas criadas, imóvel status "Alugado"
7. Dashboard atualizado com métricas

## 6. Rodar Testes

```bash
# Web
cd web && npm test

# Edge Functions
cd supabase && supabase functions test

# Mobile
cd mobile && flutter test
```

## 7. Deploy

```bash
# Migrações em produção
supabase db push

# Edge Functions
supabase functions deploy generate-contract-pdf
supabase functions deploy generate-invoices
supabase functions deploy dashboard-metrics
supabase functions deploy generate-ad

# Web — build e deploy (ex: Vercel, Netlify)
cd web && npm run build

# Mobile — build
cd mobile && flutter build apk   # Android
cd mobile && flutter build ios    # iOS
```

## Variáveis de Ambiente Necessárias

| Variável                    | Onde                     | Descrição                            |
| --------------------------- | ------------------------ | ------------------------------------ |
| `VITE_SUPABASE_URL`         | web/.env                 | URL da API Supabase                  |
| `VITE_SUPABASE_ANON_KEY`    | web/.env                 | Chave anon (pública)                 |
| `SUPABASE_URL`              | mobile env               | URL da API Supabase                  |
| `SUPABASE_ANON_KEY`         | mobile env               | Chave anon (pública)                 |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions (secrets) | Chave service_role (NUNCA no client) |

> **Constituição §I**: `SUPABASE_SERVICE_ROLE_KEY` existe apenas como secret das Edge Functions. Nunca é exposta no código frontend, mobile ou repositório.
