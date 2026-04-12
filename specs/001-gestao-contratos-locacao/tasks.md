# Tasks: Gestão de Contratos de Locação

**Input**: Design documents from `/specs/001-gestao-contratos-locacao/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/supabase-api.md, quickstart.md

**Tests**: Not explicitly requested in the feature specification. Test tasks are NOT included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web**: `web/src/`
- **Mobile**: `mobile/lib/`
- **Supabase**: `supabase/` (migrations, functions, seed)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, tooling, and base configuration for all three project roots (web, mobile, supabase).

- [X] T001 Initialize Supabase project with `supabase init` creating `supabase/config.toml`
- [X] T002 [P] Initialize React+TypeScript web project with Vite, install dependencies (React 18, React Router, TanStack Query, Zod, Tailwind CSS, @supabase/supabase-js) in `web/`
- [X] T003 [P] Initialize Flutter project with `flutter create` in `mobile/`, add dependencies (supabase_flutter, flutter_riverpod, go_router) in `mobile/pubspec.yaml`
- [X] T004 [P] Configure TypeScript strict mode (`"strict": true`, `"noImplicitAny": true`) in `web/tsconfig.json`
- [X] T005 [P] Configure Tailwind CSS with PostCSS in `web/tailwind.config.ts` and `web/postcss.config.js`
- [X] T006 [P] Configure Flutter analysis options with strict linting in `mobile/analysis_options.yaml`
- [X] T007 [P] Create `.env.example` files for web (`web/.env.example`) and supabase secrets documentation with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` placeholders
- [X] T008 [P] Add `.env`, `.env.local`, `supabase/.env` to `.gitignore` at project root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, RLS policies, audit infrastructure, and shared code that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Database Schema & Security

- [X] T009 Create initial schema migration with tables `profiles`, `properties`, `contract_templates`, `contracts`, `invoices`, `invoice_adjustments`, `inspections`, `inspection_photos`, `documents`, `audit_logs` in `supabase/migrations/00001_initial_schema.sql`
- [X] T010 Create RLS policies migration: enable RLS on all tables, create `auth.uid()` policies for `profiles`, `properties`, `contract_templates`, `contracts`, `invoices`, `invoice_adjustments`, `inspections`, `inspection_photos`, `documents` per data-model.md in `supabase/migrations/00002_rls_policies.sql`
- [X] T011 Create security definer function for invoice RLS (validates tenant access via contract relationship) in `supabase/migrations/00002_rls_policies.sql`
- [X] T012 Create audit trigger function and attach triggers to `contracts`, `invoices`, `properties`, `invoice_adjustments` tables; revoke DELETE/UPDATE on `audit_logs` in `supabase/migrations/00003_audit_triggers.sql`
- [X] T013 Create trigger `on_auth_user_created` to auto-create `profiles` row from `auth.users.user_metadata` in `supabase/migrations/00001_initial_schema.sql`
- [X] T014 Create trigger `BEFORE UPDATE ON invoices` to reject updates when `OLD.status = 'paid'` (invoice immutability) in `supabase/migrations/00001_initial_schema.sql`
- [X] T015 Create trigger `BEFORE DELETE ON properties` to reject deletion when active contracts exist in `supabase/migrations/00001_initial_schema.sql`
- [X] T016 Create Supabase Storage buckets (`property-photos`, `inspection-photos`, `shared-documents`, `contract-pdfs`) with RLS policies in `supabase/migrations/00004_storage_buckets.sql`
- [X] T017 Create seed data with 2 default contract templates (residencial + comercial) in `supabase/seed.sql`

### Web Shared Code

- [X] T018 [P] Create Supabase client singleton using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from env in `web/src/services/supabase.ts`
- [X] T019 [P] Define TypeScript domain types (`Profile`, `Property`, `Contract`, `Invoice`, `InvoiceAdjustment`, `Inspection`, `InspectionPhoto`, `Document`, `ContractTemplate`) with all monetary fields as `number` (centavos) in `web/src/types/domain.types.ts`
- [X] T020 [P] Define API request/response types (`CreateContractRequest`, `CreateContractResponse`, `DashboardMetricsResponse`, `GenerateAdResponse`, `TerminateContractRequest`) in `web/src/types/api.types.ts`
- [X] T021 [P] Implement Zod validation schemas for CPF (11 digits + check digits), CEP (8 digits), UF (2 chars), phone, email, property form, contract form in `web/src/lib/validators.ts`
- [X] T022 [P] Implement currency utility functions (`centsToDisplay`, `displayToCents`, `formatBRL`) for centavos↔display conversion in `web/src/lib/currency.ts`
- [X] T023 [P] Define enums and constants (`PropertyType`, `PropertyStatus`, `ContractStatus`, `InvoiceStatus`, `InvoiceType`, `InspectionType`, `UserRole`) in `web/src/lib/constants.ts`
- [X] T024 [P] Create `useSupabaseQuery` custom hook wrapping TanStack Query with Supabase client in `web/src/hooks/useSupabaseQuery.ts`

### Mobile Shared Code

- [X] T025 [P] Initialize Supabase client with URL and anon key from environment in `mobile/lib/core/supabase_client.dart`
- [X] T026 [P] Define Dart model classes (`UserModel`, `PropertyModel`, `ContractModel`, `InvoiceModel`, `InspectionModel`, `DocumentModel`) with `fromJson`/`toJson` and centavos for monetary fields in `mobile/lib/models/`
- [X] T027 [P] Define constants and enums (`PropertyType`, `PropertyStatus`, `ContractStatus`, `InvoiceStatus`, `UserRole`) in `mobile/lib/core/constants.dart`

### Web Layout & Routing

- [X] T028 Create React Router configuration with public routes (`/login`, `/register`, `/verify-email`) and protected routes split by role (`/owner/*`, `/tenant/*`) in `web/src/main.tsx`
- [X] T029 [P] Create base UI components (`Button`, `Input`, `Card`, `Modal`, `EmptyState`, `LoadingSpinner`) with Tailwind in `web/src/components/ui/`

### Mobile Layout & Routing

- [X] T030 Configure GoRouter with auth guards redirecting unauthenticated users to login and role-based route protection in `mobile/lib/core/router.dart`

**Checkpoint**: Foundation ready — all tables, RLS, triggers, shared types, routing, and Supabase clients configured. User story implementation can now begin.

---

## Phase 3: User Story 1 — Autenticação e Acesso por Perfil (Priority: P1) 🎯 MVP

**Goal**: Proprietários e inquilinos podem criar conta, fazer login, e são direcionados à sua área respectiva com isolamento completo de dados.

**Independent Test**: Criar conta de proprietário e inquilino, verificar que cada um acessa apenas sua área e dados de um não são visíveis ao outro.

### Implementation for User Story 1

- [X] T031 [US1] Implement auth service with `signUp`, `signIn`, `signOut`, `getSession`, `onAuthStateChange` wrapping Supabase Auth SDK in `web/src/services/auth.service.ts`
- [X] T032 [US1] Create `useAuth` custom hook managing session state, role detection, and auth redirects in `web/src/hooks/useAuth.ts`
- [X] T033 [P] [US1] Create Login page with email/password form and Zod validation in `web/src/pages/auth/LoginPage.tsx`
- [X] T034 [P] [US1] Create Register page with name, email, CPF, password, role selection form and Zod validation in `web/src/pages/auth/RegisterPage.tsx`
- [X] T035 [P] [US1] Create VerifyEmail page with confirmation message and resend link in `web/src/pages/auth/VerifyEmailPage.tsx`
- [X] T036 [US1] Create ProtectedRoute wrapper component that checks auth state and redirects by role (owner→`/owner/dashboard`, tenant→`/tenant/dashboard`) in `web/src/components/ui/ProtectedRoute.tsx`
- [X] T037 [US1] Create owner layout shell (sidebar navigation, header with user info, logout) in `web/src/pages/owner/OwnerLayout.tsx`
- [X] T038 [P] [US1] Create tenant layout shell (sidebar navigation, header, logout) in `web/src/pages/tenant/TenantLayout.tsx`
- [X] T039 [US1] Implement auth service in Flutter with `signUp`, `signIn`, `signOut`, `onAuthStateChange` in `mobile/lib/services/auth_service.dart`
- [X] T040 [US1] Create Riverpod `authProvider` (StreamProvider) and `authStateProvider` for reactive auth state in `mobile/lib/providers/auth_provider.dart`
- [X] T041 [P] [US1] Create Login screen with email/password in `mobile/lib/screens/auth/login_screen.dart`
- [X] T042 [P] [US1] Create Register screen with name, email, CPF, password, role selection in `mobile/lib/screens/auth/register_screen.dart`
- [X] T043 [US1] Update GoRouter to use `authProvider` for redirect guards (unauthenticated→login, owner→owner routes, tenant→tenant routes) in `mobile/lib/core/router.dart`

**Checkpoint**: Authentication fully functional on web and mobile. Role-based access enforced. RLS guarantees data isolation at the database level.

---

## Phase 4: User Story 2 — Cadastro de Imóveis (Priority: P1) 🎯 MVP

**Goal**: Proprietário cadastra imóveis com todas as especificações, fotos, e valores de IPTU/condomínio. Imóveis ficam disponíveis para vinculação a contratos.

**Independent Test**: Cadastrar 3 imóveis com dados distintos e verificar listagem correta com fotos, informações e status "Vago".

### Implementation for User Story 2

- [X] T044 [US2] Implement property service with `list`, `create`, `update`, `delete` and photo upload via Supabase Storage in `web/src/services/property.service.ts`
- [X] T045 [US2] Implement storage service with `uploadFile`, `getPublicUrl`, `deleteFile` for `property-photos` bucket in `web/src/services/storage.service.ts`
- [X] T046 [P] [US2] Create PropertyForm component with Zod validation (address fields, type, area, bedrooms, bathrooms, IPTU/condo in centavos, photo upload) in `web/src/components/properties/PropertyForm.tsx`
- [X] T047 [P] [US2] Create PropertyCard component displaying property summary (address, type, status badge, photo thumbnail) in `web/src/components/properties/PropertyCard.tsx`
- [X] T048 [US2] Create Properties list page with "Novo Imóvel" button, PropertyCard grid, edit/delete actions in `web/src/pages/owner/PropertiesPage.tsx`
- [X] T049 [US2] Create Property detail/edit page reusing PropertyForm in `web/src/pages/owner/PropertyDetailPage.tsx`
- [X] T050 [US2] Implement property service in Flutter with `list`, `create`, `update`, `delete`, photo upload in `mobile/lib/services/property_service.dart`
- [X] T051 [US2] Create Riverpod `propertyProvider` (FutureProvider.autoDispose) and `storageProvider` in `mobile/lib/providers/property_provider.dart` and `mobile/lib/providers/storage_provider.dart`
- [X] T052 [P] [US2] Create Properties list screen with FAB "Novo Imóvel" in `mobile/lib/screens/owner/properties_screen.dart`
- [X] T053 [P] [US2] Create Property form screen with validation and photo picker in `mobile/lib/screens/owner/property_form_screen.dart`

**Checkpoint**: Proprietário can fully manage their property portfolio on web and mobile. Photos stored in Supabase Storage with RLS.

---

## Phase 5: User Story 3 — Criação de Contrato e Geração de Cobranças (Priority: P1) 🎯 MVP

**Goal**: Proprietário cria contrato selecionando template, preenchendo dados do inquilino e do contrato. Sistema gera PDF, faturas e altera status do imóvel automaticamente.

**Independent Test**: Criar contrato de 12 meses, verificar PDF gerado, imóvel status "Alugado", e 12+ faturas criadas com valores corretos em centavos.

### Edge Functions

- [X] T054 [US3] Create shared types and Zod validators for Edge Functions in `supabase/functions/_shared/types.ts` and `supabase/functions/_shared/validators.ts`
- [X] T055 [US3] Create CORS handler for Edge Functions in `supabase/functions/_shared/cors.ts`
- [X] T056 [US3] Implement `create-contract` Edge Function: validate with Zod, check property ownership + vacant status, create/invite tenant, insert contract, generate invoices idempotently (`ON CONFLICT DO NOTHING`), update property status, generate PDF with `pdf-lib`, save to Storage in `supabase/functions/generate-contract-pdf/index.ts`
- [X] T057 [US3] Implement `terminate-contract` Edge Function: update contract status to `terminated`, set property to `vacant`, cancel future pending invoices in `supabase/functions/terminate-contract/index.ts`

### Web Implementation

- [X] T058 [US3] Implement contract service with `list`, `create` (calls Edge Function), `terminate`, `getById` in `web/src/services/contract.service.ts`
- [X] T059 [US3] Implement invoice service with `listByContract`, `markAsPaid`, `createAdjustment` in `web/src/services/invoice.service.ts`
- [X] T060 [US3] Create `useContractWizard` custom hook managing multi-step form state (template selection → tenant data → contract data → confirmation) in `web/src/hooks/useContractWizard.ts`
- [X] T061 [US3] Create ContractWizard multi-step component with template picker, tenant form (name, CPF, RG, address with Zod), contract form (rent, deposit, due day, dates, property picker), confirmation step in `web/src/components/contracts/ContractWizard.tsx`
- [X] T062 [P] [US3] Create ContractCard component showing contract summary (property address, tenant, rent, status, dates) in `web/src/components/contracts/ContractCard.tsx`
- [X] T063 [US3] Create Contracts list page with "Novo Contrato" button and ContractCard list in `web/src/pages/owner/ContractsPage.tsx`
- [X] T064 [US3] Create Contract detail page showing contract info, invoice list with status badges, pay/adjust actions, PDF download link, terminate button in `web/src/pages/owner/ContractDetailPage.tsx`

### Mobile Implementation

- [X] T065 [US3] Implement contract service in Flutter calling `create-contract` Edge Function and REST endpoints in `mobile/lib/services/contract_service.dart`
- [X] T066 [US3] Implement invoice service in Flutter with `listByContract`, `markAsPaid` in `mobile/lib/services/invoice_service.dart`
- [X] T067 [US3] Create Riverpod `contractProvider` and `invoiceProvider` in `mobile/lib/providers/contract_provider.dart` and `mobile/lib/providers/invoice_provider.dart`
- [X] T068 [US3] Create contract creation flow screens (template selection → tenant data → contract data → confirm) in `mobile/lib/screens/owner/contract_wizard_screen.dart`
- [X] T069 [P] [US3] Create Contracts list screen in `mobile/lib/screens/owner/contracts_screen.dart`
- [X] T070 [US3] Create Contract detail screen with invoices, PDF download, terminate action in `mobile/lib/screens/owner/contract_detail_screen.dart`

**Checkpoint**: Full contract lifecycle operational. PDF generation, automatic invoicing, and property status transitions working end-to-end.

---

## Phase 6: User Story 4 — Dashboard Financeiro do Proprietário (Priority: P2)

**Goal**: Proprietário visualiza painel consolidado com métricas financeiras, contratos ativos, valores a receber, e listagem agrupada por dia de vencimento.

**Independent Test**: Com 5 contratos ativos em diferentes situações, verificar totais corretos e agrupamento por vencimento.

### Edge Function

- [X] T071 [US4] Implement `dashboard-metrics` Edge Function: aggregate query on contracts+invoices for current month filtered by `auth.uid()`, return total_active_contracts, receivable/received totals, expiring soon count, properties grouped by due_day in `supabase/functions/dashboard-metrics/index.ts`

### Web Implementation

- [X] T072 [US4] Create `useFinancialMetrics` custom hook calling dashboard-metrics Edge Function with TanStack Query caching in `web/src/hooks/useFinancialMetrics.ts`
- [X] T073 [P] [US4] Create MetricCard component (icon, label, value with currency formatting) in `web/src/components/dashboard/MetricCard.tsx`
- [X] T074 [P] [US4] Create DueDateGroup component showing properties grouped by due day with status badges (paid/pending/overdue) in `web/src/components/dashboard/DueDateGroup.tsx`
- [X] T075 [US4] Create Owner Dashboard page composing MetricCards (active contracts, receivable, received, expiring), DueDateGroups, and EmptyState fallback in `web/src/pages/owner/DashboardPage.tsx`

### Mobile Implementation

- [X] T076 [US4] Create owner dashboard screen with metrics cards and due date grouped property list in `mobile/lib/screens/owner/dashboard_screen.dart`

**Checkpoint**: Dashboard operational with real-time financial metrics. Empty state guides new users.

---

## Phase 7: User Story 5 — Vistoria de Entrada e Saída (Priority: P2)

**Goal**: Proprietário registra vistorias com fotos categorizadas por cômodo, vinculadas ao contrato e imóvel.

**Independent Test**: Registrar vistoria de entrada com 10 fotos em 3 cômodos, depois uma de saída, verificar ambas acessíveis.

### Web Implementation

- [X] T077 [P] [US5] Create InspectionUploader component with room categorization, multi-photo upload to `inspection-photos` bucket, and description fields in `web/src/components/inspections/InspectionUploader.tsx`
- [X] T078 [P] [US5] Create PhotoGrid component displaying inspection photos grouped by room with expand/zoom in `web/src/components/inspections/PhotoGrid.tsx`
- [X] T079 [US5] Create Inspection page (entry/exit tabs) accessible from contract detail, showing InspectionUploader for creation and PhotoGrid for viewing existing inspections in `web/src/pages/owner/InspectionPage.tsx`

### Mobile Implementation

- [X] T080 [US5] Create inspection screen with camera/gallery picker, room categorization, upload to Supabase Storage in `mobile/lib/screens/owner/inspection_screen.dart`

**Checkpoint**: Vistorias entry and exit fully operational with photo management on both platforms.

---

## Phase 8: User Story 6 — Área de Documentos Compartilhados (Priority: P2)

**Goal**: Proprietário e inquilino enviam e visualizam documentos no contexto do contrato.

**Independent Test**: Proprietário envia 3 documentos, inquilino envia 2, verificar que ambos visualizam todos os 5 na área compartilhada.

### Web Implementation

- [X] T081 [P] [US6] Create DocumentUploader component with file picker, document type selector, description field, upload to `shared-documents` bucket in `web/src/components/documents/DocumentUploader.tsx`
- [X] T082 [P] [US6] Create DocumentList component showing documents chronologically with sender name, type badge, date, download link in `web/src/components/documents/DocumentList.tsx`
- [X] T083 [US6] Add documents tab/section to contract detail page integrating DocumentUploader and DocumentList in `web/src/pages/owner/ContractDetailPage.tsx`

### Mobile Implementation

- [X] T084 [US6] Create documents screen with file upload and chronological listing accessible from contract detail in `mobile/lib/screens/owner/documents_screen.dart`

**Checkpoint**: Bidirectional document sharing operational. Both parties can view all documents in the contract context.

---

## Phase 9: User Story 7 — Área do Inquilino (Priority: P3)

**Goal**: Inquilino visualiza contratos, cobranças, baixa PDF do contrato, acessa documentos e vistorias.

**Independent Test**: Inquilino logado vê apenas seus contratos e cobranças, consegue baixar PDF e acessar documentos.

### Web Implementation

- [X] T085 [US7] Create Tenant Dashboard page showing active contracts, current month invoices (pending/paid), total amounts in `web/src/pages/tenant/TenantDashboardPage.tsx`
- [X] T086 [US7] Create Tenant Contract detail page with invoice list, PDF download, documents tab (reusing DocumentList + DocumentUploader), inspection photos (reusing PhotoGrid read-only) in `web/src/pages/tenant/TenantContractDetailPage.tsx`

### Mobile Implementation

- [X] T087 [US7] Create tenant home screen with contract list and monthly invoices summary in `mobile/lib/screens/tenant/tenant_home_screen.dart`
- [X] T088 [US7] Create tenant contract detail screen with invoices, PDF download, documents, inspections in `mobile/lib/screens/tenant/tenant_contract_detail_screen.dart`

**Checkpoint**: Tenant area fully functional. Inquilinos have self-service access to their contractual data.

---

## Phase 10: User Story 8 — Templates de Contrato Personalizados (Priority: P3)

**Goal**: Proprietário pode fazer upload de templates customizados com placeholders que são preenchidos automaticamente na geração de contratos.

**Independent Test**: Upload de template customizado, criar contrato com ele, verificar preenchimento correto.

### Web Implementation

- [X] T089 [US8] Create Templates management page with list of templates (system + custom), upload form with name and body (textarea with placeholder hints), delete action in `web/src/pages/owner/TemplatesPage.tsx`
- [X] T090 [US8] Add template validation on upload: verify all `{{placeholders}}` are from the allowed whitelist, reject if unknown placeholders found in `web/src/services/contract.service.ts`

### Mobile Implementation

- [X] T091 [US8] Create templates management screen with list, upload, and delete in `mobile/lib/screens/owner/templates_screen.dart`

**Checkpoint**: Custom templates operational. Proprietários can personalize their contracts.

---

## Phase 11: User Story 9 — Geração de Anúncio para Imóvel Vago (Priority: P3)

**Goal**: Sistema formata anúncio automaticamente com dados do imóvel otimizado para OLX, ZAP Imóveis e Viva Real.

**Independent Test**: Imóvel vago com dados completos → anúncio gerado com todas as informações para cada plataforma.

### Edge Function

- [X] T092 [US9] Implement `generate-ad` Edge Function: fetch property data, format title/description/values for OLX, ZAP Imóveis, Viva Real with platform-specific formatting in `supabase/functions/generate-ad/index.ts`

### Web Implementation

- [X] T093 [US9] Create AdGenerator component with platform tabs (OLX, ZAP, Viva Real), generated text preview, edit capability, and "Copy to Clipboard" button per platform in `web/src/components/properties/AdGenerator.tsx`
- [X] T094 [US9] Integrate AdGenerator into property detail page, visible only when property status is `vacant` in `web/src/pages/owner/PropertyDetailPage.tsx`

### Mobile Implementation

- [X] T095 [US9] Create ad generation screen with platform selector, preview, edit, and share/copy functionality in `mobile/lib/screens/owner/ad_generator_screen.dart`

**Checkpoint**: Ad generation operational. Proprietários can quickly advertise vacant properties.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories.

- [X] T096 [P] Configure Supabase Realtime subscriptions for contracts and invoices tables with RLS filtering in `web/src/services/supabase.ts`
- [X] T097 [P] Add responsive design breakpoints to all web pages for tablet/mobile browser usage in `web/src/index.css`
- [X] T098 [P] Add loading states, error boundaries, and toast notifications across all web pages in `web/src/components/ui/`
- [X] T099 [P] Add proper error handling and user-friendly error messages to all Flutter screens in `mobile/lib/widgets/`
- [X] T100 Run quickstart.md validation: execute full flow (register → create property → create contract → verify PDF + invoices → dashboard → vistoria → documents)
- [X] T101 Review all RLS policies against constitution §I: verify no data leakage across owners or tenants
- [X] T102 Review all monetary calculations against constitution §II: verify centavos throughout, no float usage
- [X] T103 [P] Add `updated_at` auto-update trigger for all tables with `updated_at` column in `supabase/migrations/00005_updated_at_triggers.sql`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) — **BLOCKS all user stories**
- **User Story 1 / Auth (Phase 3)**: Depends on Foundational — **BLOCKS all subsequent user stories** (auth required for everything)
- **User Story 2 / Properties (Phase 4)**: Depends on Auth (Phase 3) — **BLOCKS User Story 3** (contracts need properties)
- **User Story 3 / Contracts (Phase 5)**: Depends on Properties (Phase 4) — **BLOCKS User Stories 4-9** (all features need contracts)
- **User Stories 4, 5, 6 (Phases 6, 7, 8)**: All depend on Contracts (Phase 5) — **Can run in parallel**
- **User Story 7 / Tenant (Phase 9)**: Depends on Contracts (Phase 5) — Can run in parallel with US4, US5, US6
- **User Story 8 / Templates (Phase 10)**: Depends on Contracts (Phase 5) — Can run in parallel with US4-US7
- **User Story 9 / Ads (Phase 11)**: Depends on Properties (Phase 4) — Can run in parallel with US3+
- **Polish (Phase 12)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Phase 1 (Setup)
    └── Phase 2 (Foundational) ── BLOCKS ALL ──┐
        └── Phase 3 (US1: Auth)                │
            └── Phase 4 (US2: Properties)      │
                ├── Phase 5 (US3: Contracts)   │
                │   ├── Phase 6 (US4: Dashboard) ──┐
                │   ├── Phase 7 (US5: Vistoria) ───┤ Can run
                │   ├── Phase 8 (US6: Documents) ──┤ in parallel
                │   ├── Phase 9 (US7: Tenant) ─────┘
                │   └── Phase 10 (US8: Templates)
                └── Phase 11 (US9: Ads) ← only needs Properties
                    └── Phase 12 (Polish)
```

### Within Each User Story

- Edge Functions before web/mobile services that call them
- Services before hooks that consume them
- Hooks before pages/components that use hooks
- Models/types before services (already in Foundational)
- Tasks marked [P] within a phase can run in parallel

### Parallel Opportunities

**After Phase 5 (Contracts) completes, up to 5 stories can execute in parallel:**
- US4 (Dashboard), US5 (Vistoria), US6 (Documents), US7 (Tenant), US8 (Templates)

**Within Phase 2 (Foundational):**
- T018-T029 web shared code tasks marked [P] can all run in parallel
- T025-T027 mobile shared code tasks can run in parallel with web tasks

**Within each user story:**
- Web and mobile implementations of the same story can run in parallel once shared Edge Functions (if any) are complete

---

## Implementation Strategy

### MVP Scope (Recommended)

**Phases 1-5** (Setup → Foundational → US1 Auth → US2 Properties → US3 Contracts) deliver a fully functional MVP where a proprietário can:
- Create an account and log in
- Register properties with photos
- Create contracts with automatic PDF and invoice generation
- View and manage invoices

**Task count for MVP**: T001–T070 (70 tasks)

### Incremental Delivery After MVP

1. **US4 Dashboard** (T071–T076): Adds financial visibility
2. **US5 Vistoria** (T077–T080): Adds legal protection
3. **US6 Documents** (T081–T084): Adds communication layer
4. **US7 Tenant Area** (T085–T088): Completes the two-sided platform
5. **US8 Templates** (T089–T091): Adds customization
6. **US9 Ads** (T092–T095): Adds convenience feature
7. **Polish** (T096–T103): Final hardening
