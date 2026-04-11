# Data Model: Gestão de Contratos de Locação

**Feature Branch**: `001-gestao-contratos-locacao`
**Date**: 2026-04-11
**Source**: [spec.md](spec.md) (Key Entities) + [research.md](research.md)

> **Convenção monetária (Constituição §II)**: Todos os campos de valor monetário são `BIGINT` representando **centavos**. Exemplo: R$ 1.500,00 = `150000`.

---

## Entity: profiles

Perfil do usuário vinculado ao `auth.users` do Supabase.

| Campo      | Tipo        | Constraints                        | Descrição                         |
| ---------- | ----------- | ---------------------------------- | --------------------------------- |
| id         | UUID        | PK, FK → auth.users(id)            | Mesmo ID do Supabase Auth         |
| role       | TEXT        | NOT NULL, CHECK('owner', 'tenant') | Perfil: proprietário ou inquilino |
| full_name  | TEXT        | NOT NULL                           | Nome completo                     |
| cpf        | VARCHAR(11) | NOT NULL, UNIQUE                   | CPF (apenas dígitos)              |
| email      | TEXT        | NOT NULL                           | E-mail (espelhado do auth)        |
| phone      | VARCHAR(15) | NULLABLE                           | Telefone com DDD                  |
| rg         | VARCHAR(20) | NULLABLE                           | RG (usado em contratos)           |
| address    | TEXT        | NULLABLE                           | Endereço completo                 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()            | Data de criação                   |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()            | Última atualização                |

**RLS**:

- SELECT/UPDATE: `auth.uid() = id`
- INSERT: após signup, via trigger ou client

**Validation (Zod)**:

- `cpf`: 11 dígitos numéricos, validação de dígitos verificadores
- `email`: formato de e-mail válido
- `phone`: formato brasileiro (DDD + número)
- `role`: enum restrito

---

## Entity: properties

Imóveis cadastrados por proprietários.

| Campo                | Tipo          | Constraints                                           | Descrição                     |
| -------------------- | ------------- | ----------------------------------------------------- | ----------------------------- |
| id                   | UUID          | PK, DEFAULT gen_random_uuid()                         | ID único                      |
| owner_id             | UUID          | NOT NULL, FK → profiles(id)                           | Proprietário                  |
| address_street       | TEXT          | NOT NULL                                              | Logradouro                    |
| address_number       | TEXT          | NOT NULL                                              | Número                        |
| address_complement   | TEXT          | NULLABLE                                              | Complemento                   |
| address_neighborhood | TEXT          | NOT NULL                                              | Bairro                        |
| address_city         | TEXT          | NOT NULL                                              | Cidade                        |
| address_state        | VARCHAR(2)    | NOT NULL                                              | UF                            |
| address_zip          | VARCHAR(8)    | NOT NULL                                              | CEP (apenas dígitos)          |
| property_type        | TEXT          | NOT NULL, CHECK('house', 'apartment', 'commercial')   | Tipo do imóvel                |
| area_sqm             | NUMERIC(10,2) | NULLABLE                                              | Área em m²                    |
| bedrooms             | SMALLINT      | NULLABLE, DEFAULT 0                                   | Quartos                       |
| bathrooms            | SMALLINT      | NULLABLE, DEFAULT 0                                   | Banheiros                     |
| parking_spaces       | SMALLINT      | NULLABLE, DEFAULT 0                                   | Vagas de garagem              |
| iptu_monthly_cents   | BIGINT        | NULLABLE, DEFAULT 0                                   | IPTU mensal em centavos       |
| condo_monthly_cents  | BIGINT        | NULLABLE, DEFAULT 0                                   | Condomínio mensal em centavos |
| status               | TEXT          | NOT NULL, DEFAULT 'vacant', CHECK('vacant', 'rented') | Status atual                  |
| description          | TEXT          | NULLABLE                                              | Descrição livre               |
| created_at           | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()                               |                               |
| updated_at           | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()                               |                               |

**RLS**:

- ALL: `owner_id = auth.uid()`

**Indexes**:

- `idx_properties_owner_id` ON (owner_id)
- `idx_properties_status` ON (owner_id, status)

---

## Entity: contract_templates

Templates de contrato (padrão do sistema ou personalizados).

| Campo      | Tipo        | Constraints                   | Descrição                             |
| ---------- | ----------- | ----------------------------- | ------------------------------------- |
| id         | UUID        | PK, DEFAULT gen_random_uuid() | ID único                              |
| owner_id   | UUID        | NULLABLE, FK → profiles(id)   | NULL = template do sistema            |
| name       | TEXT        | NOT NULL                      | Nome do template                      |
| body       | TEXT        | NOT NULL                      | Corpo com placeholders `{{variavel}}` |
| is_system  | BOOLEAN     | NOT NULL, DEFAULT false       | Template padrão do sistema            |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()       |                                       |

**RLS**:

- SELECT: `owner_id = auth.uid() OR is_system = true`
- INSERT/UPDATE/DELETE: `owner_id = auth.uid()` (apenas templates personalizados)

---

## Entity: contracts

Contratos de locação vinculando proprietário, inquilino e imóvel.

| Campo                | Tipo        | Constraints                                               | Descrição                        |
| -------------------- | ----------- | --------------------------------------------------------- | -------------------------------- |
| id                   | UUID        | PK, DEFAULT gen_random_uuid()                             | ID único                         |
| property_id          | UUID        | NOT NULL, FK → properties(id)                             | Imóvel vinculado                 |
| owner_id             | UUID        | NOT NULL, FK → profiles(id)                               | Proprietário                     |
| tenant_id            | UUID        | NOT NULL, FK → profiles(id)                               | Inquilino                        |
| template_id          | UUID        | NULLABLE, FK → contract_templates(id)                     | Template utilizado               |
| rent_amount_cents    | BIGINT      | NOT NULL                                                  | Valor do aluguel em centavos     |
| deposit_amount_cents | BIGINT      | NOT NULL, DEFAULT 0                                       | Valor da caução em centavos      |
| due_day              | SMALLINT    | NOT NULL, CHECK(1..28)                                    | Dia de vencimento mensal         |
| start_date           | DATE        | NOT NULL                                                  | Data de início                   |
| end_date             | DATE        | NOT NULL                                                  | Data de término                  |
| status               | TEXT        | NOT NULL, DEFAULT 'active', CHECK('active', 'terminated') | Status do contrato               |
| pdf_storage_path     | TEXT        | NULLABLE                                                  | Path do PDF no Storage           |
| tenant_name          | TEXT        | NOT NULL                                                  | Nome do inquilino (snapshot)     |
| tenant_cpf           | VARCHAR(11) | NOT NULL                                                  | CPF do inquilino (snapshot)      |
| tenant_rg            | VARCHAR(20) | NULLABLE                                                  | RG do inquilino (snapshot)       |
| tenant_address       | TEXT        | NULLABLE                                                  | Endereço do inquilino (snapshot) |
| created_at           | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                                   |                                  |
| updated_at           | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                                   |                                  |

**RLS**:

- SELECT: `owner_id = auth.uid() OR tenant_id = auth.uid()`
- INSERT/UPDATE: `owner_id = auth.uid()`

**Indexes**:

- `idx_contracts_owner_id` ON (owner_id)
- `idx_contracts_tenant_id` ON (tenant_id)
- `idx_contracts_property_id` ON (property_id)
- `idx_contracts_status` ON (owner_id, status)

**Constraints**:

- CHECK: `end_date > start_date`
- CHECK: `due_day BETWEEN 1 AND 28` (evita problemas com meses de 28-31 dias)

**State Transitions**:

- `active` → `terminated` (encerramento manual ou vencimento)
- Sem transição reversa — novo contrato é criado se necessário

**Nota**: Campos `tenant_name`, `tenant_cpf`, `tenant_rg`, `tenant_address` são snapshots no momento da criação para preservar integridade do documento gerado, mesmo se o perfil do inquilino for atualizado.

---

## Entity: invoices

Faturas (cobranças) individuais por mês de contrato.

| Campo             | Tipo        | Constraints                                                      | Descrição                          |
| ----------------- | ----------- | ---------------------------------------------------------------- | ---------------------------------- |
| id                | UUID        | PK, DEFAULT gen_random_uuid()                                    | ID único                           |
| contract_id       | UUID        | NOT NULL, FK → contracts(id)                                     | Contrato vinculado                 |
| competencia_month | DATE        | NOT NULL                                                         | Primeiro dia do mês de competência |
| invoice_type      | TEXT        | NOT NULL, CHECK('rent', 'deposit', 'iptu', 'condo')              | Tipo da cobrança                   |
| amount_cents      | BIGINT      | NOT NULL                                                         | Valor em centavos                  |
| due_date          | DATE        | NOT NULL                                                         | Data de vencimento                 |
| status            | TEXT        | NOT NULL, DEFAULT 'pending', CHECK('pending', 'paid', 'overdue') | Status                             |
| paid_at           | TIMESTAMPTZ | NULLABLE                                                         | Data do pagamento                  |
| created_at        | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                                          |                                    |
| updated_at        | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                                          |                                    |

**RLS**:

- SELECT: via contrato (`contract_id` → owner_id ou tenant_id = `auth.uid()`)
- UPDATE (status apenas): via contrato, owner_id = `auth.uid()`
- INSERT: via Edge Function (service_role)

**Indexes**:

- `idx_invoices_contract_id` ON (contract_id)
- `idx_invoices_due_date` ON (due_date)
- `idx_invoices_status` ON (contract_id, status)

**Unique Constraint (Idempotência)**:

- `uq_invoices_idempotent` ON (contract_id, competencia_month, invoice_type)

**Imutabilidade (Constituição §II)**:

- Trigger: `BEFORE UPDATE ON invoices` → se `OLD.status = 'paid'`, rejeitar UPDATE (exceto via estorno).
- Correções para faturas pagas: criar `invoice_adjustment` (ver abaixo).

**State Transitions**:

- `pending` → `paid` (proprietário registra pagamento)
- `pending` → `overdue` (CRON job: `due_date < CURRENT_DATE AND status = 'pending'`)
- `overdue` → `paid` (pagamento atrasado registrado)
- `paid` → imutável (sem transição reversa)

---

## Entity: invoice_adjustments

Estornos e ajustes compensatórios para faturas já pagas.

| Campo           | Tipo        | Constraints                             | Descrição                                               |
| --------------- | ----------- | --------------------------------------- | ------------------------------------------------------- |
| id              | UUID        | PK, DEFAULT gen_random_uuid()           | ID único                                                |
| invoice_id      | UUID        | NOT NULL, FK → invoices(id)             | Fatura original                                         |
| adjustment_type | TEXT        | NOT NULL, CHECK('refund', 'correction') | Tipo de ajuste                                          |
| amount_cents    | BIGINT      | NOT NULL                                | Valor do ajuste (positivo = crédito, negativo = débito) |
| reason          | TEXT        | NOT NULL                                | Motivo do ajuste                                        |
| created_by      | UUID        | NOT NULL, FK → profiles(id)             | Quem criou o ajuste                                     |
| created_at      | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                 |                                                         |

**RLS**:

- SELECT: via invoice → contrato → owner_id ou tenant_id
- INSERT: owner_id = `auth.uid()`

---

## Entity: inspections

Vistorias de entrada/saída vinculadas a contrato + imóvel.

| Campo           | Tipo        | Constraints                      | Descrição          |
| --------------- | ----------- | -------------------------------- | ------------------ |
| id              | UUID        | PK, DEFAULT gen_random_uuid()    | ID único           |
| contract_id     | UUID        | NOT NULL, FK → contracts(id)     | Contrato vinculado |
| property_id     | UUID        | NOT NULL, FK → properties(id)    | Imóvel vinculado   |
| inspection_type | TEXT        | NOT NULL, CHECK('entry', 'exit') | Tipo de vistoria   |
| notes           | TEXT        | NULLABLE                         | Observações gerais |
| created_by      | UUID        | NOT NULL, FK → profiles(id)      | Quem realizou      |
| created_at      | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()          |                    |

**RLS**:

- SELECT: via contrato (owner_id ou tenant_id)
- INSERT/UPDATE: owner_id = `auth.uid()`

**Unique Constraint**:

- `uq_inspection_type` ON (contract_id, inspection_type) — no máximo 1 entrada e 1 saída por contrato

---

## Entity: inspection_photos

Fotos individuais de vistoria, categorizadas por cômodo.

| Campo         | Tipo        | Constraints                    | Descrição                |
| ------------- | ----------- | ------------------------------ | ------------------------ |
| id            | UUID        | PK, DEFAULT gen_random_uuid()  | ID único                 |
| inspection_id | UUID        | NOT NULL, FK → inspections(id) | Vistoria vinculada       |
| room_name     | TEXT        | NOT NULL                       | Nome do cômodo/área      |
| storage_path  | TEXT        | NOT NULL                       | Path no Supabase Storage |
| description   | TEXT        | NULLABLE                       | Descrição da foto        |
| created_at    | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()        |                          |

**RLS**: herda via inspection → contrato

---

## Entity: documents

Documentos compartilhados entre proprietário e inquilino.

| Campo         | Tipo        | Constraints                   | Descrição                                                   |
| ------------- | ----------- | ----------------------------- | ----------------------------------------------------------- |
| id            | UUID        | PK, DEFAULT gen_random_uuid() | ID único                                                    |
| contract_id   | UUID        | NOT NULL, FK → contracts(id)  | Contrato vinculado                                          |
| uploaded_by   | UUID        | NOT NULL, FK → profiles(id)   | Quem enviou                                                 |
| document_type | TEXT        | NULLABLE                      | Tipo (comprovante, ordem_servico, comunicado, laudo, outro) |
| description   | TEXT        | NULLABLE                      | Descrição                                                   |
| file_name     | TEXT        | NOT NULL                      | Nome original do arquivo                                    |
| storage_path  | TEXT        | NOT NULL                      | Path no Supabase Storage                                    |
| created_at    | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()       |                                                             |

**RLS**:

- SELECT: via contrato (owner_id ou tenant_id)
- INSERT: `auth.uid()` é owner_id ou tenant_id do contrato
- DELETE: apenas `uploaded_by = auth.uid()` (quem enviou pode remover)

---

## Entity: audit_logs

Logs de auditoria imutáveis (Constituição §I).

| Campo       | Tipo        | Constraints             | Descrição                             |
| ----------- | ----------- | ----------------------- | ------------------------------------- |
| id          | BIGSERIAL   | PK                      | ID sequencial                         |
| entity_type | VARCHAR(50) | NOT NULL                | Tabela de origem                      |
| entity_id   | UUID        | NOT NULL                | ID do registro afetado                |
| action      | VARCHAR(20) | NOT NULL                | CREATE, UPDATE, DELETE, STATUS_CHANGE |
| old_values  | JSONB       | NULLABLE                | Dados antes da alteração              |
| new_values  | JSONB       | NULLABLE                | Dados após a alteração                |
| user_id     | UUID        | NULLABLE                | `auth.uid()` no momento da ação       |
| created_at  | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Timestamp imutável                    |
| metadata    | JSONB       | NULLABLE                | Informações adicionais                |

**Permissões**:

- `REVOKE DELETE, UPDATE ON audit_logs FROM public, authenticated, anon;`
- `GRANT INSERT, SELECT ON audit_logs TO authenticated;`

**RLS**:

- SELECT: `user_id = auth.uid()` (proprietário vê apenas seus logs)

**Triggers ativos em**: `contracts`, `invoices`, `properties`, `invoice_adjustments`

---

## Entity Relationship Diagram (textual)

```
profiles (1) ──── owns ────── (N) properties
profiles (1) ──── owns ────── (N) contracts (as owner)
profiles (1) ──── rents ───── (N) contracts (as tenant)
profiles (1) ──── owns ────── (N) contract_templates

properties (1) ── has ─────── (N) contracts
properties (1) ── has ─────── (N) inspections

contracts (1) ─── has ─────── (N) invoices
contracts (1) ─── has ─────── (N) documents
contracts (1) ─── has ─────── (2) inspections (entry + exit)
contracts (1) ─── uses ────── (1) contract_templates

invoices (1) ──── has ─────── (N) invoice_adjustments

inspections (1) ─ has ─────── (N) inspection_photos
```

---

## Storage Buckets (Supabase Storage)

| Bucket              | Acesso                     | Organização                              |
| ------------------- | -------------------------- | ---------------------------------------- |
| `property-photos`   | Owner only                 | `{property_id}/{filename}`               |
| `inspection-photos` | Owner + tenant do contrato | `{property_id}/{contract_id}/{filename}` |
| `shared-documents`  | Owner + tenant do contrato | `{contract_id}/{filename}`               |
| `contract-pdfs`     | Owner + tenant do contrato | `{contract_id}/{filename}.pdf`           |
