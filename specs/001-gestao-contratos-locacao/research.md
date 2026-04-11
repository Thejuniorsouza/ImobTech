# Research: Gestão de Contratos de Locação

**Feature Branch**: `001-gestao-contratos-locacao`
**Date**: 2026-04-11

## 1. Supabase RLS — Isolamento Multi-Tenant

**Decision**: Abordagem híbrida com `auth.uid()` direto + security definer functions para relações complexas.

**Rationale**:

- Policies diretas (`owner_id = auth.uid()`) para acesso de proprietário a imóveis, faturas e contratos — performance máxima.
- Security definer functions para acesso do inquilino via tabela de contratos (evita JOINs caros em policies).
- Índices em foreign keys usadas em policies (`contract_id`, `property_id`, `owner_id`, `tenant_id`).
- RLS garante isolamento no nível do banco — mesmo que o código da aplicação tenha bugs, dados não vazam.

**Alternatives Considered**:

- JWT custom claims: stale até refresh do token; não reflete mudanças em tempo real.
- Filtragem na aplicação: depende de código correto em 3 plataformas; não garante isolamento.
- Banco separado por tenant: complexidade operacional desproporcional para o escopo.

---

## 2. Geração de PDF em Edge Functions (Deno)

**Decision**: `pdf-lib` (npm) via Edge Function para preenchimento de templates e geração de PDF.

**Rationale**:

- Pure JavaScript, compatível com Deno runtime do Supabase.
- Suporte nativo a UTF-8 (nomes com acentos, endereços em português).
- Menor footprint de memória que Puppeteer (que não está disponível em Edge Functions).
- Fluxo: buscar template → substituir variáveis → gerar PDF binário → salvar no Storage → retornar URL.
- Latência estimada < 500ms para contrato típico.

**Alternatives Considered**:

- Puppeteer: requer Chromium, indisponível no runtime Deno do Supabase.
- jsPDF: mais leve mas limitado em form filling e formatação avançada.
- Serviço externo (Lambda): adiciona latência e custo.

---

## 3. Geração Idempotente de Faturas

**Decision**: `INSERT ... ON CONFLICT DO NOTHING` com unique constraint composto `(contract_id, competencia_month, invoice_type)`.

**Rationale**:

- A constraint no banco impede duplicatas mesmo com execuções concorrentes.
- Compatível com pg_cron (executar `SELECT generate_monthly_invoices()` mensalmente).
- Execuções repetidas são inofensivas — nenhuma fatura duplicada, nenhum dado corrompido.
- Valores de fatura gerados no momento da criação do contrato (batch insert para todo o período), e o CRON apenas processa cobranças de status transitions (pendente → atrasado) e potenciais novas gerações.

**Alternatives Considered**:

- ON CONFLICT DO UPDATE: modifica faturas existentes — viola princípio de imutabilidade de faturas pagas.
- Verificação na aplicação: race conditions em execuções concorrentes.
- Tabela de estado ("último mês gerado"): requer coordenação; mais difícil de depurar.

---

## 4. Estrutura de Buckets do Supabase Storage

**Decision**: 4 buckets privados com RLS e organização por path baseada em UUIDs.

| Bucket              | RLS Policy                           | Path                           | Acesso                             |
| ------------------- | ------------------------------------ | ------------------------------ | ---------------------------------- |
| `property-photos`   | `owner_id = auth.uid()`              | `{property_id}/`               | Apenas proprietário                |
| `inspection-photos` | Via contrato (owner ou tenant)       | `{property_id}/{contract_id}/` | Proprietário + inquilino vinculado |
| `shared-documents`  | Via contrato                         | `{contract_id}/shared/`        | Bidirecional                       |
| `contract-pdfs`     | `owner_id OR tenant_id = auth.uid()` | `{contract_id}/`               | Ambas as partes                    |

- Paths com UUIDs (não sequenciais) para evitar enumeração.
- Signed URLs para acesso temporário (24-48h) quando necessário.
- Limite padrão do Supabase: 5GB/arquivo — mais que suficiente para fotos e PDFs.

**Alternatives Considered**:

- Bucket único com nesting profundo: RLS mais complexa, difícil de auditar.
- Buckets públicos com URLs obscuras: security through obscurity, inaceitável.
- Servir via API: latência e custo de bandwidth desnecessários.

---

## 5. Engine de Templates de Contrato

**Decision**: Templates em texto plano com placeholders `{{variable_name}}`, substituição via regex em TypeScript, whitelist de variáveis permitidas.

**Rationale**:

- Proprietários não-técnicos conseguem editar templates com `{{nome_inquilino}}`, `{{cpf}}`, `{{valor_aluguel}}`.
- Substituição simples e auditável.
- Whitelist de variáveis previne injeção de código — apenas variáveis conhecidas são substituídas.
- Valores são escapados como texto puro antes da inserção no template.
- Templates armazenados como Text no banco, vinculados ao proprietário ou marcados como "padrão do sistema".

**Variáveis padronizadas**:

- `{{nome_inquilino}}`, `{{cpf_inquilino}}`, `{{rg_inquilino}}`, `{{endereco_inquilino}}`
- `{{nome_proprietario}}`, `{{cpf_proprietario}}`
- `{{endereco_imovel}}`, `{{tipo_imovel}}`
- `{{valor_aluguel}}`, `{{valor_caucao}}`, `{{valor_iptu}}`, `{{valor_condominio}}`
- `{{data_inicio}}`, `{{data_fim}}`, `{{dia_vencimento}}`, `{{duracao_meses}}`

**Alternatives Considered**:

- DOCX com placeholders: requer library docx; complexidade desnecessária.
- HTML para PDF: risco de XSS, requer sanitização robusta.
- Handlebars/Nunjucks: superfície de ataque maior; lógica condicional nos templates não é necessária.

---

## 6. Auditoria Imutável em PostgreSQL

**Decision**: Tabela `audit_logs` append-only com triggers em tabelas críticas e permissões revogadas para DELETE/UPDATE.

**Schema da tabela**:

- `id`: BIGSERIAL PK
- `entity_type`: VARCHAR(50) — 'contract', 'invoice', 'property'
- `entity_id`: UUID
- `action`: VARCHAR(20) — 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE'
- `old_values`: JSONB — snapshot dos dados anteriores
- `new_values`: JSONB — snapshot dos dados novos
- `user_id`: UUID — `auth.uid()` capturado no trigger
- `timestamp`: TIMESTAMPTZ DEFAULT NOW()
- `metadata`: JSONB — informações adicionais (IP, motivo)

**Proteção contra adulteração**:

- `REVOKE DELETE, UPDATE ON audit_logs FROM public, authenticated, anon;`
- Apenas `INSERT` e `SELECT` concedidos para `authenticated`.
- Triggers automáticos em: `contracts`, `invoices`, `properties` (DELETE).

**Alternatives Considered**:

- Logging na aplicação: pode ser contornado; não é tamper-proof.
- Event sourcing: redesign completo do sistema; desproporcional para requisito de auditoria.
- WAL archival: ferramenta de recovery, não de auditoria.

---

## 7. Flutter Riverpod + Supabase — Padrões de Integração

**Decision**: Riverpod com Repository pattern; StreamProvider para real-time; FutureProvider para dados sob demanda.

**Rationale**:

- **Inicialização**: `Provider<SupabaseClient>` com URL e anon key via variáveis de ambiente.
- **Auth**: `StreamProvider<AuthState>` observa `onAuthStateChange`; GoRouter reage para redirect automaticamente.
- **Repositories**: `Provider<ContractsRepository>` encapsula chamadas ao Supabase; testável com mocks.
- **Dados**: `FutureProvider.autoDispose<List<Contract>>` para listas; auto-cancela quando widget sai da tela.
- **Real-time**: `StreamProvider` com `.stream(primaryKey: ['id'])` para atualizações automáticas de faturas e contratos.
- **Testes**: Riverpod permite override completo de providers em testes unitários.

**Alternatives Considered**:

- BLoC: mais boilerplate (Event + State classes) para cada feature; a equipe é reduzida.
- GetX: reativo mas opinionado; menor segurança de tipos.
- Provider: menos type-safe; sem validação em compile-time.

---

## Summary

| Tópico              | Decisão                                         | Risco Residual                                             |
| ------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| RLS Multi-Tenant    | Híbrido: `auth.uid()` direto + security definer | Requires indexing on FK columns                            |
| PDF Generation      | `pdf-lib` em Edge Functions                     | Memory limit para documentos muito longos                  |
| Idempotent Invoices | `ON CONFLICT DO NOTHING` + unique composite     | Nenhum (idempotência garantida no banco)                   |
| Storage Buckets     | 4 buckets privados com RLS por path             | Signed URLs devem ter TTL curto                            |
| Template Engine     | Regex + whitelist de variáveis                  | Templates mal formatados devem ser rejeitados na validação |
| Audit Logging       | Triggers + append-only table                    | Garantir triggers em todas as tabelas críticas             |
| Flutter + Riverpod  | Repository + Stream/FutureProvider              | Manter providers `.autoDispose` para evitar memory leaks   |
