# Implementation Plan: Gestão de Contratos de Locação

**Branch**: `001-gestao-contratos-locacao` | **Date**: 2026-04-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-gestao-contratos-locacao/spec.md`

## Summary

SaaS multi-plataforma (web React + mobile Flutter) para gestão direta de locações imobiliárias entre proprietários e inquilinos, sem intermediação de imobiliária. O sistema utiliza Supabase (PostgreSQL + Auth + Storage + Edge Functions) como backend serverless. Funcionalidades principais: autenticação por perfil com RLS, cadastro de imóveis, criação de contratos com geração automática de PDF e cobranças mensais, dashboard financeiro consolidado, vistorias fotográficas, documentos compartilhados e geração de anúncios para plataformas de divulgação. Toda a camada financeira opera com valores em centavos (integer) para precisão exata, e faturas pagas são imutáveis com correções via estorno.

## Technical Context

**Language/Version**: TypeScript 5.x (Web + Edge Functions), Dart 3.x (Flutter Mobile)
**Primary Dependencies**: React 18+, React Router, TanStack Query, Zod, Tailwind CSS (Web); Flutter 3.x, Riverpod, GoRouter (Mobile); Supabase JS SDK v2 (ambos); Deno runtime (Edge Functions)
**Storage**: Supabase PostgreSQL (dados), Supabase Storage (fotos, documentos, PDFs)
**Testing**: Vitest + Testing Library (Web), flutter_test + integration_test (Mobile), Deno test (Edge Functions)
**Target Platform**: Web (browsers modernos), Android 8+, iOS 14+
**Project Type**: web-service + mobile-app (SaaS multi-plataforma)
**Performance Goals**: Dashboard < 3s carregamento; Geração de PDF < 15s; 500 proprietários simultâneos
**Constraints**: Apenas recursos gratuitos do Supabase para LGPD; sem gateway de pagamento (registro manual de status); todos os valores monetários em centavos (integer)
**Scale/Scope**: ~500 proprietários ativos, ~15 telas web, ~12 telas mobile, 7 entidades principais

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #   | Princípio da Constituição                            | Status  | Evidência no Plano                                                                                                                                                                             |
| --- | ---------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I   | **Segurança e Isolamento de Dados (NON-NEGOTIABLE)** | ✅ PASS | RLS obrigatória em todas as tabelas; `auth.uid()` como filtro em todas as policies; `service_role` apenas em Edge Functions; secrets via `.env`                                                |
| II  | **Integridade e Precisão Financeira**                | ✅ PASS | Valores monetários como `integer` (centavos) no PostgreSQL; faturas pagas imutáveis com estorno/ajuste; geração de cobranças idempotente via chave composta `(contrato_id, competencia, tipo)` |
| III | **Arquitetura de Código e Padrões**                  | ✅ PASS | TypeScript strict mode, `any` proibido; Flutter com Riverpod para state management; React com hooks customizados e memorização; tipos exportados centralmente                                  |
| IV  | **Integração e Geração de Contratos**                | ✅ PASS | Geração de PDF via Edge Function assíncrona; validação dupla (Zod client + server) para todos os formulários; padronização de CPF/CNPJ                                                         |
| V   | **Fluxo Spec-Driven**                                | ✅ PASS | Este plano foi gerado consultando a constituição; todas as decisões técnicas a seguem                                                                                                          |

**Gate Result**: ✅ ALL PASSED — Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-gestao-contratos-locacao/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── supabase-api.md  # Supabase RPC + REST contract definitions
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
web/                              # React.js + TypeScript (dashboard proprietário + área inquilino)
├── src/
│   ├── components/               # Componentes React reutilizáveis
│   │   ├── ui/                   # Componentes de UI genéricos (Button, Input, Card, Modal)
│   │   ├── dashboard/            # Widgets do dashboard (MetricCard, PropertyList, DueDateGroup)
│   │   ├── contracts/            # Componentes de contrato (ContractWizard, ContractCard)
│   │   ├── properties/           # Componentes de imóvel (PropertyForm, PropertyCard, AdGenerator)
│   │   ├── inspections/          # Componentes de vistoria (InspectionUploader, PhotoGrid)
│   │   └── documents/            # Componentes de documentos (DocumentUploader, DocumentList)
│   ├── pages/                    # Páginas/rotas da aplicação
│   │   ├── auth/                 # Login, Register, VerifyEmail
│   │   ├── owner/                # Dashboard, Properties, Contracts, Inspections, Documents
│   │   └── tenant/               # TenantDashboard, TenantContracts, TenantDocuments
│   ├── hooks/                    # Custom hooks
│   │   ├── useAuth.ts            # Autenticação e sessão
│   │   ├── useFinancialMetrics.ts # Métricas do dashboard
│   │   ├── useContractWizard.ts  # Fluxo de criação de contrato
│   │   └── useSupabaseQuery.ts   # Wrapper TanStack Query + Supabase
│   ├── services/                 # Camada de acesso a dados
│   │   ├── supabase.ts           # Cliente Supabase (anon key apenas)
│   │   ├── auth.service.ts       # Funções de autenticação
│   │   ├── property.service.ts   # CRUD de imóveis
│   │   ├── contract.service.ts   # CRUD + geração de contrato
│   │   ├── invoice.service.ts    # Consulta e atualização de faturas
│   │   └── storage.service.ts    # Upload/download de arquivos
│   ├── types/                    # Tipos TypeScript centralizados
│   │   ├── database.types.ts     # Tipos gerados pelo Supabase CLI
│   │   ├── domain.types.ts       # Tipos de domínio (Property, Contract, Invoice, etc.)
│   │   └── api.types.ts          # Tipos de request/response
│   ├── lib/                      # Utilitários
│   │   ├── validators.ts         # Schemas Zod (CPF, CNPJ, contrato, imóvel)
│   │   ├── currency.ts           # Helpers de conversão centavos ↔ display
│   │   └── constants.ts          # Enums e constantes
│   ├── index.css
│   └── main.tsx
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── package.json

mobile/                           # Flutter (Dart) — app proprietário + inquilino
├── lib/
│   ├── core/                     # Infraestrutura compartilhada
│   │   ├── supabase_client.dart  # Inicialização do Supabase
│   │   ├── router.dart           # GoRouter com guards de autenticação
│   │   └── constants.dart        # Constantes e enums
│   ├── models/                   # Entidades de domínio
│   │   ├── user_model.dart
│   │   ├── property_model.dart
│   │   ├── contract_model.dart
│   │   ├── invoice_model.dart
│   │   ├── inspection_model.dart
│   │   └── document_model.dart
│   ├── providers/                # Riverpod providers
│   │   ├── auth_provider.dart
│   │   ├── property_provider.dart
│   │   ├── contract_provider.dart
│   │   ├── invoice_provider.dart
│   │   └── storage_provider.dart
│   ├── services/                 # Camada de dados (Supabase calls)
│   │   ├── auth_service.dart
│   │   ├── property_service.dart
│   │   ├── contract_service.dart
│   │   ├── invoice_service.dart
│   │   └── storage_service.dart
│   ├── screens/                  # Telas
│   │   ├── auth/                 # Login, Register, VerifyEmail
│   │   ├── owner/                # Dashboard, Properties, Contracts, Inspections
│   │   └── tenant/               # TenantHome, TenantContracts, TenantDocuments
│   ├── widgets/                  # Widgets reutilizáveis
│   └── main.dart
├── test/
├── pubspec.yaml
└── analysis_options.yaml

supabase/                         # Supabase project config + Edge Functions
├── config.toml
├── migrations/                   # SQL migrations (schema + RLS policies)
│   ├── 00001_initial_schema.sql
│   ├── 00002_rls_policies.sql
│   └── 00003_audit_triggers.sql
├── functions/                    # Supabase Edge Functions (Deno/TypeScript)
│   ├── create-contract/          # Criação de contrato: validação, faturas, PDF, status imóvel
│   │   └── index.ts
│   ├── terminate-contract/       # Encerramento de contrato + cancelamento de faturas futuras
│   │   └── index.ts
│   ├── dashboard-metrics/        # Agregação de métricas financeiras por owner
│   │   └── index.ts
│   ├── generate-ad/              # Formatação de anúncio para OLX, ZAP, Viva Real
│   │   └── index.ts
│   ├── delete-user-data/         # LGPD FR-018: exclusão de dados pessoais sob demanda
│   │   └── index.ts
│   └── _shared/                  # Código compartilhado entre functions
│       ├── types.ts
│       ├── validators.ts
│       └── cors.ts
└── seed.sql                      # Dados de seed (templates padrão de contrato)
```

**Structure Decision**: Estrutura de 3 projetos (web + mobile + supabase) que reflete a stack definida na constituição. O diretório `web/` já existe no repositório. O `supabase/` centraliza migrações SQL, RLS policies e Edge Functions. O `mobile/` contém o app Flutter com Riverpod. Tipos de domínio são definidos separadamente em cada plataforma mas derivados do mesmo schema PostgreSQL.

## Complexity Tracking

> Sem violações à Constituição — tabela não necessária.
