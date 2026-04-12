# 🏢 ImobTech

SaaS de controle de aluguéis para proprietários de imóveis.

## Funcionalidades

- **Autenticação**: Cadastro e login de proprietários
- **Gestão de Imóveis**: Cadastre e gerencie seus imóveis (apartamentos, casas, comerciais)
- **Gestão de Inquilinos**: Cadastro de inquilinos com dados de contato e CPF
- **Contratos de Aluguel**: Crie e acompanhe contratos vinculando imóveis e inquilinos
- **Controle de Pagamentos**: Registre pagamentos, marque como pago, identifique atrasos
- **Dashboard**: Visão geral com estatísticas de imóveis, contratos e pagamentos

## Tecnologias

- **Next.js 16** - Framework React full-stack
- **TypeScript** - Tipagem estática
- **Tailwind CSS 4** - Estilização
- **Prisma** - ORM para banco de dados
- **SQLite** - Banco de dados (desenvolvimento)
- **NextAuth.js** - Autenticação
- **bcryptjs** - Hash de senhas

## Como Executar

1. Clone o repositório:
```bash
git clone https://github.com/Thejuniorsouza/ImobTech.git
cd ImobTech
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

4. Execute as migrações do banco de dados:
```bash
npx prisma migrate dev
```

5. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

6. Acesse [http://localhost:3000](http://localhost:3000)

## Estrutura do Projeto

```
src/
├── app/
│   ├── (auth)/          # Páginas de autenticação (login, registro)
│   ├── (dashboard)/     # Páginas do painel (dashboard, imóveis, inquilinos, contratos, pagamentos)
│   ├── api/             # Rotas de API (CRUD e autenticação)
│   ├── layout.tsx       # Layout raiz
│   └── page.tsx         # Landing page
├── components/          # Componentes reutilizáveis
├── lib/                 # Utilitários (Prisma client, configuração de auth)
└── generated/           # Código gerado pelo Prisma (gitignored)
```
