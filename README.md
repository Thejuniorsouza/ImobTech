# 🏢 OwnerDirect - SaaS de Gestão de Locação Independente

![Status](https://img.shields.io/badge/Status-Em%20Desenvolvimento-blue)
![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Flutter%20%7C%20Node.js%20%7C%20Supabase-success)

## 📖 Sobre o Projeto

Um sistema completo (SaaS) desenhado para desburocratizar o mercado imobiliário, colocando o controle de ativos e rendimentos diretamente nas mãos dos proprietários. A plataforma elimina a necessidade de intermediários (imobiliárias), oferecendo gestão financeira de precisão, esteira automatizada de contratos e um portal de autoatendimento para inquilinos.

O ecossistema é composto por duas frentes principais:

1. **Área do Proprietário (Web e Mobile):** Foco em gestão de carteira, conciliação de caixa, inadimplência e emissão de contratos.
2. **Área do Inquilino (Mobile):** Foco em usabilidade para acesso a boletos/Pix, download de contratos e histórico de pagamentos.

---

## 🚀 Principais Funcionalidades

### Para o Proprietário

- **Dashboard Financeiro Analítico:** Visão consolidada de fluxo de caixa, recebimentos agrupados por dia de vencimento, e alertas de inadimplência.
- **Esteira de Contratos:** Geração automatizada de contratos em PDF a partir de templates pré-configurados, com cálculo automático de parcelas, caução e repasses (IPTU/Condomínio).
- **Gestão de Ativos:** Cadastro de imóveis, controle de vacância e alertas de reajuste anual de aluguel (IPCA/IGPM).

### Para o Inquilino

- **Autoatendimento:** Acesso rápido às faturas do mês vigente e histórico financeiro.
- **Repositório de Documentos:** Acesso permanente à via digital do contrato de locação e laudos de vistoria.

---

## 🛠️ Stack Tecnológica

A arquitetura foi projetada para garantir segurança de dados e alta performance, mantendo um livro-razão financeiro imutável e confiável.

- **Frontend Web:** React.js com TypeScript
- **Frontend Mobile:** Flutter (Dart)
- **Backend & Workers:** Node.js com TypeScript (Edge Functions)
- **Banco de Dados & BaaS:** Supabase (PostgreSQL)
- **Autenticação:** Supabase Auth (Multi-tenant)
- **Armazenamento:** Supabase Storage (para PDFs de contratos)

---

## 🔒 Segurança e Arquitetura

Este projeto lida com dados financeiros e contratuais sensíveis. As seguintes políticas são inegociáveis:

- **Row Level Security (RLS):** Implementação rigorosa de políticas RLS diretamente no PostgreSQL para garantir que nenhum proprietário tenha acesso a dados de terceiros.
- **Precisão Financeira:** Valores monetários armazenados estritamente como inteiros (centavos) ou decimais de precisão exata para evitar falhas de arredondamento.
- **Desacoplamento UI/Business Logic:** Uso de padrões de arquitetura limpa e gerência de estado robusta (ex: BLoC no Flutter e Custom Hooks no React).

---

## ⚙️ Como Executar o Projeto Localmente

### Pré-requisitos

- Node.js (v18+)
- Flutter SDK
- CLI do Supabase
