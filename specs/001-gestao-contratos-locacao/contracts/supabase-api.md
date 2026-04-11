# Supabase API Contracts: Gestão de Contratos de Locação

**Feature Branch**: `001-gestao-contratos-locacao`
**Date**: 2026-04-11

> Esta plataforma usa Supabase como backend. Os "contratos de API" são compostos por:
>
> 1. **Supabase REST API (PostgREST)** — CRUD automático para tabelas com RLS
> 2. **Supabase Edge Functions** — lógica de negócio complexa (RPC-like)
> 3. **Supabase Realtime** — subscriptions para atualizações em tempo real

---

## 1. Auth Endpoints (Supabase Auth SDK)

### POST /auth/v1/signup

**Descrição**: Cadastro de novo usuário.

**Request**:

```json
{
    "email": "proprietario@email.com",
    "password": "SenhaSegura123!",
    "options": {
        "data": {
            "full_name": "João da Silva",
            "cpf": "12345678901",
            "role": "owner"
        }
    }
}
```

**Response 200**:

```json
{
    "user": {
        "id": "uuid",
        "email": "...",
        "user_metadata": { "role": "owner" }
    },
    "session": null
}
```

**Regras**:

- E-mail de verificação enviado automaticamente pelo Supabase.
- Trigger `on_auth_user_created` cria registro em `profiles` com dados do `user_metadata`.
- `role` é validado no trigger: apenas `owner` ou `tenant`.

### POST /auth/v1/token?grant_type=password

**Descrição**: Login com e-mail e senha.

**Request**:

```json
{
    "email": "proprietario@email.com",
    "password": "SenhaSegura123!"
}
```

**Response 200**:

```json
{
    "access_token": "jwt...",
    "refresh_token": "...",
    "user": { "id": "uuid", "user_metadata": { "role": "owner" } }
}
```

---

## 2. Properties (Supabase REST — PostgREST)

Base URL: `GET/POST/PATCH/DELETE /rest/v1/properties`

Todas as operações filtradas automaticamente por RLS (`owner_id = auth.uid()`).

### GET /rest/v1/properties

**Descrição**: Listar imóveis do proprietário autenticado.

**Query params**: `?select=*&order=created_at.desc`

**Response 200**:

```json
[
    {
        "id": "uuid",
        "owner_id": "uuid",
        "address_street": "Rua das Flores",
        "address_number": "123",
        "address_complement": "Apt 4B",
        "address_neighborhood": "Centro",
        "address_city": "São Paulo",
        "address_state": "SP",
        "address_zip": "01001000",
        "property_type": "apartment",
        "area_sqm": 75.5,
        "bedrooms": 2,
        "bathrooms": 1,
        "parking_spaces": 1,
        "iptu_monthly_cents": 20000,
        "condo_monthly_cents": 40000,
        "status": "vacant",
        "description": "Apartamento reformado...",
        "created_at": "2026-04-11T10:00:00Z",
        "updated_at": "2026-04-11T10:00:00Z"
    }
]
```

### POST /rest/v1/properties

**Descrição**: Cadastrar novo imóvel.

**Request** (header: `Prefer: return=representation`):

```json
{
    "address_street": "Rua das Flores",
    "address_number": "123",
    "address_neighborhood": "Centro",
    "address_city": "São Paulo",
    "address_state": "SP",
    "address_zip": "01001000",
    "property_type": "apartment",
    "area_sqm": 75.5,
    "bedrooms": 2,
    "bathrooms": 1,
    "iptu_monthly_cents": 20000,
    "condo_monthly_cents": 40000
}
```

**Validação (Zod — client + server)**:

- `address_zip`: 8 dígitos numéricos
- `address_state`: 2 caracteres maiúsculos, UF válida
- `property_type`: enum `house | apartment | commercial`
- `iptu_monthly_cents`, `condo_monthly_cents`: integer ≥ 0

### PATCH /rest/v1/properties?id=eq.{uuid}

**Descrição**: Atualizar imóvel. RLS garante que apenas o proprietário pode alterar.

### DELETE /rest/v1/properties?id=eq.{uuid}

**Descrição**: Excluir imóvel. Trigger verifica se há contratos ativos vinculados — rejeita se houver.

---

## 3. Contracts (REST + Edge Function)

### POST /functions/v1/create-contract

**Descrição**: Edge Function que orquestra criação de contrato + geração de faturas + PDF.

**Request**:

```json
{
    "property_id": "uuid",
    "template_id": "uuid",
    "tenant_name": "Maria Oliveira",
    "tenant_cpf": "98765432100",
    "tenant_rg": "123456789",
    "tenant_address": "Rua dos Pinheiros, 456 - São Paulo/SP",
    "tenant_email": "maria@email.com",
    "rent_amount_cents": 150000,
    "deposit_amount_cents": 300000,
    "due_day": 15,
    "start_date": "2026-05-01",
    "end_date": "2027-04-30"
}
```

**Response 201**:

```json
{
    "contract": {
        "id": "uuid",
        "status": "active",
        "pdf_storage_path": "uuid-contract/contract.pdf"
    },
    "invoices_created": 13,
    "tenant_account_created": true
}
```

**Lógica interna (Edge Function)**:

1. Validar dados com Zod (server-side).
2. Verificar que o imóvel pertence ao `auth.uid()` e está `vacant`.
3. Criar conta de inquilino (se não existir) com `service_role` — envia convite por e-mail.
4. Inserir registro em `contracts`.
5. Gerar faturas: 1 deposit + N rent + N iptu (se > 0) + N condo (se > 0) via `INSERT ... ON CONFLICT DO NOTHING`.
6. Atualizar status do imóvel para `rented`.
7. Buscar template, preencher variáveis, gerar PDF com `pdf-lib`, salvar no Storage.
8. Atualizar `pdf_storage_path` no contrato.
9. Retornar resultado.

**Erros**:

- `400`: Validação falhou (detalhes por campo).
- `409`: Imóvel já possui contrato ativo.
- `404`: Imóvel ou template não encontrado.

### GET /rest/v1/contracts

**Descrição**: Listar contratos (RLS filtra por owner_id ou tenant_id automaticamente).

**Query**: `?select=*,properties(*),invoices(*)&order=created_at.desc`

### PATCH /functions/v1/terminate-contract

**Descrição**: Edge Function para encerrar contrato.

**Request**:

```json
{
    "contract_id": "uuid",
    "termination_reason": "Encerramento por término de vigência"
}
```

**Lógica interna**:

1. Atualizar status do contrato para `terminated`.
2. Atualizar status do imóvel para `vacant`.
3. Cancelar faturas pendentes futuras (status → `cancelled`).
4. Log de auditoria automático via trigger.

---

## 4. Invoices (REST + Edge Function)

### GET /rest/v1/invoices

**Descrição**: Listar faturas. RLS via security definer function que valida relacionamento com contrato.

**Query**: `?select=*,contracts(property_id,properties(address_street))&contract_id=eq.{uuid}&order=due_date.asc`

### PATCH /rest/v1/invoices?id=eq.{uuid}

**Descrição**: Atualizar status de fatura (ex: marcar como pago).

**Request**:

```json
{
    "status": "paid",
    "paid_at": "2026-05-15T14:30:00Z"
}
```

**Regra**: Trigger `BEFORE UPDATE` rejeita se `OLD.status = 'paid'` (imutabilidade).

### POST /rest/v1/invoice_adjustments

**Descrição**: Criar estorno/ajuste para fatura paga.

**Request**:

```json
{
    "invoice_id": "uuid",
    "adjustment_type": "refund",
    "amount_cents": -150000,
    "reason": "Valor cobrado a maior no mês de maio"
}
```

---

## 5. Inspections (REST)

### POST /rest/v1/inspections

**Descrição**: Criar registro de vistoria.

**Request**:

```json
{
    "contract_id": "uuid",
    "property_id": "uuid",
    "inspection_type": "entry",
    "notes": "Imóvel em boas condições"
}
```

**Constraint**: Unique `(contract_id, inspection_type)` — máximo 1 entrada e 1 saída.

### POST /rest/v1/inspection_photos

**Descrição**: Registrar foto de vistoria (após upload no Storage).

**Request**:

```json
{
    "inspection_id": "uuid",
    "room_name": "Sala de estar",
    "storage_path": "property-uuid/contract-uuid/foto1.jpg",
    "description": "Parede norte, sem danos"
}
```

---

## 6. Documents (REST)

### POST /rest/v1/documents

**Descrição**: Registrar documento compartilhado (após upload no Storage).

**Request**:

```json
{
    "contract_id": "uuid",
    "document_type": "comprovante",
    "description": "Comprovante de pagamento - Maio/2026",
    "file_name": "comprovante-maio.pdf",
    "storage_path": "contract-uuid/comprovante-maio.pdf"
}
```

### GET /rest/v1/documents

**Query**: `?contract_id=eq.{uuid}&order=created_at.desc`

RLS garante que apenas owner e tenant do contrato visualizam.

---

## 7. Contract Templates (REST)

### GET /rest/v1/contract_templates

**Query**: `?select=id,name,is_system&or=(owner_id.eq.{auth.uid()},is_system.eq.true)`

### POST /rest/v1/contract_templates

**Request**:

```json
{
    "name": "Contrato Residencial Padrão",
    "body": "CONTRATO DE LOCAÇÃO RESIDENCIAL\n\nLocador: {{nome_proprietario}}, CPF {{cpf_proprietario}}...\nLocatário: {{nome_inquilino}}, CPF {{cpf_inquilino}}...\n\nValor do aluguel: R$ {{valor_aluguel}}..."
}
```

---

## 8. Dashboard Metrics (Edge Function)

### GET /functions/v1/dashboard-metrics

**Descrição**: Retorna métricas consolidadas para o dashboard do proprietário.

**Response 200**:

```json
{
  "total_active_contracts": 5,
  "total_receivable_cents": 1050000,
  "total_received_cents": 630000,
  "contracts_expiring_soon": 2,
  "properties_by_due_day": [
    {
      "due_day": 5,
      "properties": [
        {
          "property_id": "uuid",
          "address": "Rua das Flores, 123",
          "rent_amount_cents": 150000,
          "invoice_status": "paid"
        }
      ]
    },
    {
      "due_day": 15,
      "properties": [...]
    }
  ]
}
```

**Lógica**: Query agregada em `contracts` + `invoices` do mês corrente, filtrada por `auth.uid()`.

---

## 9. Ad Generation (Edge Function)

### POST /functions/v1/generate-ad

**Descrição**: Gera texto de anúncio otimizado para plataformas de divulgação.

**Request**:

```json
{
    "property_id": "uuid",
    "platforms": ["olx", "zap", "vivareal"]
}
```

**Response 200**:

```json
{
    "ads": {
        "olx": {
            "title": "Apartamento 2 quartos - Centro, São Paulo",
            "description": "Lindo apartamento reformado com 75m²...",
            "price_cents": 150000
        },
        "zap": { "title": "...", "description": "...", "price_cents": 150000 },
        "vivareal": {
            "title": "...",
            "description": "...",
            "price_cents": 150000
        }
    }
}
```

---

## 10. Supabase Realtime Subscriptions

### Channel: contracts

```typescript
supabase
    .channel("contracts")
    .on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "contracts",
            filter: `owner_id=eq.${userId}`,
        },
        callback,
    )
    .subscribe();
```

### Channel: invoices

```typescript
supabase
    .channel("invoices")
    .on(
        "postgres_changes",
        {
            event: "UPDATE",
            schema: "public",
            table: "invoices",
        },
        callback,
    )
    .subscribe();
```

RLS filtra automaticamente — cada usuário recebe apenas eventos de seus dados.

---

## Resumo dos Endpoints

| Endpoint                         | Método    | Tipo          | Auth           |
| -------------------------------- | --------- | ------------- | -------------- |
| /auth/v1/signup                  | POST      | Auth SDK      | Public         |
| /auth/v1/token                   | POST      | Auth SDK      | Public         |
| /rest/v1/properties              | CRUD      | PostgREST     | Owner          |
| /rest/v1/contracts               | GET       | PostgREST     | Owner + Tenant |
| /functions/v1/create-contract    | POST      | Edge Function | Owner          |
| /functions/v1/terminate-contract | PATCH     | Edge Function | Owner          |
| /rest/v1/invoices                | GET/PATCH | PostgREST     | Owner + Tenant |
| /rest/v1/invoice_adjustments     | POST      | PostgREST     | Owner          |
| /rest/v1/inspections             | CRUD      | PostgREST     | Owner          |
| /rest/v1/inspection_photos       | CRUD      | PostgREST     | Owner + Tenant |
| /rest/v1/documents               | CRUD      | PostgREST     | Owner + Tenant |
| /rest/v1/contract_templates      | CRUD      | PostgREST     | Owner          |
| /functions/v1/dashboard-metrics  | GET       | Edge Function | Owner          |
| /functions/v1/generate-ad        | POST      | Edge Function | Owner          |
