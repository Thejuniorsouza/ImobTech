<!--
  Sync Impact Report
  ==================
  Version change: 0.0.0 (template) → 1.0.0
  Bump rationale: MAJOR — first ratification; all principles defined.

  Modified Principles:
    - [PRINCIPLE_1] → I. Segurança e Isolamento de Dados (NEW)
    - [PRINCIPLE_2] → II. Integridade e Precisão Financeira (NEW)
    - [PRINCIPLE_3] → III. Arquitetura de Código e Padrões (NEW)
    - [PRINCIPLE_4] → IV. Integração e Geração de Contratos (NEW)
    - [PRINCIPLE_5] → V. Fluxo de Trabalho Spec-Driven (NEW)

  Added Sections:
    - Stack Tecnológica e Infraestrutura
    - Padrões de Qualidade e Revisão

  Removed Sections: (none)

  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ (no changes needed;
      Constitution Check section is dynamic)
    - .specify/templates/spec-template.md ✅ (no changes needed;
      requirements and validation align)
    - .specify/templates/tasks-template.md ✅ (no changes needed;
      security hardening phase already present)

  Follow-up TODOs: (none)
-->

# ImobTech — Constituição do Projeto

## Core Principles

### I. Segurança e Isolamento de Dados (NON-NEGOTIABLE)

O sistema lida com dados sensíveis de usuários e operações
financeiras. A segurança MUST seguir práticas rigorosas:

- **Row Level Security (RLS):** É estritamente obrigatório o uso
  de políticas RLS no Supabase. Nenhuma query de frontend ou
  backend deve ser capaz de retornar dados de imóveis, contratos,
  faturas ou inquilinos que não pertençam ao `auth.uid()` do
  usuário autenticado solicitante.
- **Auditoria de Ações Críticas:** Toda modificação de status de
  contrato, exclusão de dados e alterações em faturas MUST gerar
  logs de auditoria imutáveis, registrando o responsável pela
  ação, o timestamp e os dados alterados, garantindo
  rastreabilidade e monitoramento contínuo.
- **Gestão de Segredos:** Nenhuma chave de API, secret do
  Supabase (`service_role`) ou credencial de terceiros deve ser
  exposta no código-fonte. Toda credencial MUST ser injetada via
  variáveis de ambiente (`.env`).

### II. Integridade e Precisão Financeira

O núcleo da plataforma envolve métricas de fluxo de caixa e
projeção de recebíveis. As seguintes regras são invioláveis:

- **Tipagem Monetária:** Valores financeiros NEVER devem ser
  tratados como números de ponto flutuante (`float`/`double`).
  Todo valor monetário MUST ser armazenado como `integer`
  (representando centavos) ou utilizando o tipo
  `numeric`/`decimal` com precisão exata no PostgreSQL.
- **Imutabilidade de Faturas Pagas:** Faturas e recibos com
  status "Pago" MUST NOT ser alterados diretamente. Qualquer
  correção MUST ser feita através de lançamentos de estorno ou
  ajuste compensatório, preservando a integridade de um
  livro-razão financeiro.
- **Idempotência:** Rotinas em background (CRONs) que geram
  cobranças, repasses de IPTU/Condomínio ou aplicam multas de
  atraso MUST ser idempotentes. A execução repetida acidental
  de um script MUST NOT gerar faturas duplicadas.

### III. Arquitetura de Código e Padrões (Clean Code)

- **TypeScript (Web e Node.js):** O uso de `any` é
  estritamente proibido. Todas as respostas da API, payloads,
  componentes e funções MUST ter interfaces ou tipos
  explicitamente definidos e exportados centralmente.
- **Flutter (Mobile):** MUST adotar um padrão de gerência de
  estado robusto e escalável (BLoC ou Riverpod). A lógica de
  negócio e chamadas de API MUST estar completamente
  desacopladas das camadas de UI (Widgets).
- **React (Web):** Priorizar componentes funcionais limpos,
  hooks customizados para abstrair lógica de negócio (ex:
  `useFinancialMetrics`, `useContractWizard`) e memorização
  (`useMemo`, `useCallback`) em dashboards pesados para evitar
  re-renderizações desnecessárias.

### IV. Integração e Geração de Contratos

- **Processamento Assíncrono:** Tarefas pesadas como o parse
  de templates de contratos e a geração de PDFs MUST NOT
  bloquear a thread principal. MUST ser delegadas para Edge
  Functions assíncronas.
- **Validação de Entrada:** Toda entrada de dados do usuário
  (especialmente na esteira de "Novo Contrato") MUST ser
  validada tanto no cliente (React/Flutter) quanto no servidor
  (Supabase/Node.js) utilizando bibliotecas de schema (Zod),
  prevenindo injeções e garantindo a padronização de CPFs,
  CNPJs e datas.

### V. Fluxo de Trabalho Spec-Driven

O agente de IA MUST consultar esta constituição antes de
planejar (`/speckit.plan`) ou implementar (`/speckit.implement`)
qualquer módulo, garantindo que o código gerado atenda
primeiramente à segurança do PostgreSQL, à exatidão do motor
financeiro e à tipagem rigorosa estipulada.

## Stack Tecnológica e Infraestrutura

| Camada                         | Tecnologia                                     |
| ------------------------------ | ---------------------------------------------- |
| Banco de Dados, Auth e Storage | Supabase (PostgreSQL)                          |
| Backend / Serverless           | Node.js + TypeScript (Supabase Edge Functions) |
| Frontend Web (Dashboard)       | React.js + TypeScript                          |
| Frontend Mobile                | Flutter (Dart)                                 |

Restrições adicionais de infraestrutura:

- Secrets MUST ser gerenciados exclusivamente via variáveis de
  ambiente; nenhum valor sensível pode existir em repositório.
- Toda comunicação entre cliente e servidor MUST usar HTTPS/TLS.
- Supabase `service_role` key MUST ser usada apenas em contextos
  server-side (Edge Functions), nunca no cliente.

## Padrões de Qualidade e Revisão

- Todo PR/review MUST verificar conformidade com os princípios
  desta constituição, especialmente RLS e tipagem monetária.
- Complexidade além do necessário MUST ser justificada e
  documentada no PR.
- Testes de integração são obrigatórios para fluxos críticos:
  criação de contrato, geração de fatura e fluxo de pagamento.
- Validação dupla (client + server) MUST ser verificada para
  toda entrada de dados de usuário.

## Governance

Esta constituição é o documento de autoridade máxima do projeto.
Todas as decisões de arquitetura, segurança e qualidade MUST
estar em conformidade com os princípios aqui descritos.

- **Precedência:** Esta constituição prevalece sobre quaisquer
  outros documentos ou práticas quando houver conflito.
- **Emendas:** Alterações requerem documentação explícita, bump
  de versão semântica e atualização do Sync Impact Report.
    - MAJOR: remoção ou redefinição incompatível de princípios.
    - MINOR: adição de princípio ou expansão material de seção.
    - PATCH: correções de redação, typos, refinamentos.
- **Revisão de Conformidade:** Cada módulo implementado MUST
  passar por verificação de aderência aos princípios antes de
  ser considerado concluído.

**Version**: 1.0.0 | **Ratified**: 2026-04-11 | **Last Amended**: 2026-04-11
