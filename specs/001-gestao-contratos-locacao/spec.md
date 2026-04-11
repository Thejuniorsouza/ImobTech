# Feature Specification: Gestão de Contratos de Locação

**Feature Branch**: `001-gestao-contratos-locacao`  
**Created**: 2026-04-11  
**Status**: Draft  
**Input**: User description: "Aplicativo de controle de contratos de locação de imóveis para proprietários independentes, com áreas distintas para proprietário e inquilino, dashboards financeiros, geração de contratos, vistorias, gestão de imóveis e documentos compartilhados."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Autenticação e Acesso por Perfil (Priority: P1)

O proprietário acessa a plataforma (web ou mobile) e realiza login seguro. Após autenticado, é direcionado automaticamente ao seu dashboard de proprietário. Da mesma forma, o inquilino acessa a plataforma e é direcionado à sua área dedicada. Cada perfil visualiza apenas os dados e funcionalidades pertinentes ao seu papel.

**Why this priority**: Sem autenticação segura e separação de perfis, nenhuma outra funcionalidade pode operar corretamente. É o alicerce de toda a plataforma e requisito para conformidade com a LGPD.

**Independent Test**: Pode ser testado criando uma conta de proprietário e uma de inquilino, verificando que cada um acessa apenas sua respectiva área e que dados de um não são visíveis ao outro.

**Acceptance Scenarios**:

1. **Given** um visitante na tela de login, **When** ele insere credenciais válidas de proprietário, **Then** é redirecionado ao dashboard do proprietário e visualiza apenas seus dados.
2. **Given** um visitante na tela de login, **When** ele insere credenciais válidas de inquilino, **Then** é redirecionado à área do inquilino e visualiza apenas seus contratos e cobranças.
3. **Given** um usuário autenticado como inquilino, **When** ele tenta acessar uma rota exclusiva de proprietário, **Then** o sistema nega o acesso e exibe mensagem de permissão insuficiente.
4. **Given** um usuário na tela de cadastro, **When** ele preenche os dados obrigatórios (nome, e-mail, CPF, senha), **Then** a conta é criada e um e-mail de verificação é enviado.
5. **Given** um usuário autenticado, **When** a sessão expira ou o token é inválido, **Then** o sistema redireciona ao login sem expor dados em cache.

---

### User Story 2 - Cadastro de Imóveis (Priority: P1)

O proprietário acessa a seção "Meus Imóveis" e cadastra um novo imóvel preenchendo endereço completo, tipo (casa, apartamento, sala comercial), metragem, número de quartos/banheiros, valor de IPTU mensal, valor de condomínio (se aplicável) e fotos do imóvel. Após o cadastro, o imóvel fica disponível para ser vinculado a contratos futuros.

**Why this priority**: Imóveis são a entidade central — sem eles cadastrados, não é possível criar contratos nem gerar cobranças. Funciona como MVP independente para o proprietário organizar seu portfólio.

**Independent Test**: Pode ser testado cadastrando 3 imóveis com dados distintos e verificando que aparecem listados corretamente na seção "Meus Imóveis" com todas as informações e fotos.

**Acceptance Scenarios**:

1. **Given** um proprietário autenticado na seção "Meus Imóveis", **When** ele clica em "Novo Imóvel" e preenche todos os campos obrigatórios com fotos, **Then** o imóvel é salvo e aparece na listagem com status "Vago".
2. **Given** um proprietário com imóveis cadastrados, **When** ele edita as informações de um imóvel, **Then** as alterações são salvas e refletidas imediatamente.
3. **Given** um proprietário cadastrando um imóvel, **When** ele deixa campos obrigatórios em branco, **Then** o sistema exibe mensagens de validação específicas por campo.
4. **Given** um proprietário com um imóvel com status "Vago", **When** ele clica em "Gerar Anúncio", **Then** o sistema formata automaticamente título, descrição e valores para as plataformas OLX, ZAP Imóveis e Viva Real, disponibilizando o texto para cópia.

---

### User Story 3 - Criação de Contrato e Geração de Cobranças (Priority: P1)

O proprietário clica em "Novo Contrato", seleciona um template de contrato disponível (padrão do sistema ou enviado por ele), preenche os dados do inquilino (Nome, CPF, RG, Endereço) e os dados do contrato (valor do aluguel, duração, valor de caução, dia de vencimento, imóvel vinculado). Ao confirmar, o sistema gera o documento do contrato para envio ou impressão, cadastra o contrato na plataforma, vincula-o ao imóvel, altera o status do imóvel para "Alugado" e gera automaticamente todas as cobranças mensais (caução, aluguel, IPTU e condomínio se houver) para todo o período contratual.

**Why this priority**: É o fluxo de negócio principal. A geração automática de cobranças e do documento do contrato são o diferencial de valor para o proprietário que dispensa imobiliária.

**Independent Test**: Pode ser testado criando um contrato de 12 meses para um imóvel cadastrado, verificando que o PDF é gerado, o imóvel muda de status e 12 faturas mensais são criadas com os valores corretos de aluguel + encargos.

**Acceptance Scenarios**:

1. **Given** um proprietário com pelo menos um imóvel vago cadastrado, **When** ele clica em "Novo Contrato" e seleciona um template, **Then** o sistema exibe o formulário de preenchimento de dados do inquilino e do contrato.
2. **Given** o formulário de novo contrato preenchido com todos os dados válidos, **When** o proprietário confirma a criação, **Then** o sistema gera o documento do contrato (disponível para download/impressão), cadastra o contrato, vincula ao imóvel e altera o status do imóvel para "Alugado".
3. **Given** um contrato recém-criado de 12 meses com aluguel de R$ 1.500, caução de R$ 3.000, IPTU de R$ 200/mês e condomínio de R$ 400/mês, **When** o sistema processa a criação, **Then** são geradas 12 faturas mensais de R$ 2.100 (aluguel + IPTU + condomínio) além da cobrança inicial de caução de R$ 3.000.
4. **Given** o formulário de novo contrato, **When** o proprietário insere um CPF inválido ou dados incompletos, **Then** o sistema exibe erros de validação e impede a criação do contrato.
5. **Given** um contrato sendo criado, **When** o proprietário seleciona um imóvel que já possui contrato ativo, **Then** o sistema impede a vinculação e informa que o imóvel já está alugado.

---

### User Story 4 - Dashboard Financeiro do Proprietário (Priority: P2)

O proprietário acessa seu dashboard e visualiza um painel consolidado com: total de contratos ativos, valor total a receber no mês corrente, contratos próximos do vencimento, receita recebida vs. a receber, e uma listagem dos imóveis alugados agrupados por dia de vencimento (ex: dia 5, dia 15, dia 25) com a situação financeira de cada um (pago, pendente, atrasado).

**Why this priority**: O dashboard é a principal interface de valor contínuo para o proprietário após a configuração inicial. Sem ele, o proprietário não tem visibilidade sobre sua carteira de locações.

**Independent Test**: Pode ser testado com 5 contratos ativos em diferentes situações (pago, pendente, atrasado) e verificando que o dashboard exibe os totais corretos e a listagem agrupada por vencimento.

**Acceptance Scenarios**:

1. **Given** um proprietário com 5 contratos ativos, **When** ele acessa o dashboard, **Then** visualiza o total de contratos ativos (5), valor total a receber no mês e contratos próximos do vencimento.
2. **Given** um proprietário com imóveis com vencimentos nos dias 5, 15 e 25, **When** ele visualiza a listagem de imóveis no dashboard, **Then** os imóveis são agrupados por dia de vencimento com status financeiro individual (pago, pendente, atrasado).
3. **Given** um proprietário com faturas pagas e pendentes no mês, **When** ele visualiza as métricas, **Then** os valores de "Recebido" e "A Receber" são exibidos corretamente e somam o total esperado.
4. **Given** um proprietário sem nenhum contrato cadastrado, **When** ele acessa o dashboard, **Then** visualiza um estado vazio orientativo com chamada para ação de cadastrar imóvel e criar contrato.

---

### User Story 5 - Vistoria de Entrada e Saída (Priority: P2)

O proprietário acessa a ficha de um imóvel vinculado a um contrato e registra a vistoria de entrada com fotos categorizadas por cômodo/área. Ao término do contrato, registra a vistoria de saída da mesma forma. Ambas as vistorias ficam permanentemente atreladas ao contrato e ao imóvel para consulta futura.

**Why this priority**: Vistorias são essenciais para proteção jurídica do proprietário e do inquilino, mas a plataforma entrega valor mesmo sem elas configuradas inicialmente.

**Independent Test**: Pode ser testado registrando uma vistoria de entrada com 10 fotos em 3 cômodos, e depois uma vistoria de saída, verificando que ambas ficam acessíveis na ficha do contrato/imóvel.

**Acceptance Scenarios**:

1. **Given** um contrato ativo vinculado a um imóvel, **When** o proprietário acessa a área de vistoria e seleciona "Vistoria de Entrada", **Then** pode fazer upload de fotos categorizadas por cômodo/área com descrição opcional.
2. **Given** um contrato encerrado ou em encerramento, **When** o proprietário registra a "Vistoria de Saída", **Then** as fotos são salvas e vinculadas ao contrato e ao imóvel, lado a lado com a vistoria de entrada.
3. **Given** um contrato com vistoria de entrada registrada, **When** qualquer usuário autorizado (proprietário ou inquilino) consulta o contrato, **Then** as fotos da vistoria são exibidas organizadamente.

---

### User Story 6 - Área de Documentos Compartilhados (Priority: P2)

Dentro da relação contrato-imóvel, tanto o proprietário quanto o inquilino podem enviar documentos e fotos relevantes (comprovantes de pagamento, ordens de serviço, comunicados, laudos). Todos os documentos ficam organizados cronologicamente e acessíveis a ambas as partes.

**Why this priority**: Centralizar documentos reduz conflitos e melhora a comunicação entre proprietário e inquilino, mas pode ser adicionado após os fluxos principais estarem operacionais.

**Independent Test**: Pode ser testado com o proprietário enviando 3 documentos e o inquilino enviando 2, verificando que ambos visualizam todos os 5 documentos na área compartilhada.

**Acceptance Scenarios**:

1. **Given** um contrato ativo, **When** o proprietário acessa a área de documentos e faz upload de um comprovante, **Then** o documento é salvo com data, autor e descrição, ficando visível para o inquilino.
2. **Given** um contrato ativo, **When** o inquilino acessa a área de documentos e faz upload de uma ordem de serviço, **Then** o documento é salvo e fica visível para o proprietário.
3. **Given** um contrato com múltiplos documentos enviados por ambas as partes, **When** qualquer uma das partes acessa a área de documentos, **Then** a listagem aparece ordenada cronologicamente com identificação do remetente.

---

### User Story 7 - Área do Inquilino (Priority: P3)

O inquilino acessa sua área e visualiza seus contratos ativos, as cobranças pendentes e já pagas, pode fazer download do contrato e acessar a área de documentos compartilhados. Ele também pode visualizar as fotos de vistoria do imóvel.

**Why this priority**: Complementa a experiência da plataforma dando autonomia ao inquilino, mas a plataforma já entrega valor completo ao proprietário sem essa área implementada.

**Independent Test**: Pode ser testado com um inquilino logado verificando que ele vê apenas seus contratos e cobranças, consegue baixar o PDF do contrato e acessar documentos.

**Acceptance Scenarios**:

1. **Given** um inquilino autenticado com um contrato ativo, **When** ele acessa sua área, **Then** visualiza o contrato vigente, cobranças do mês (pendentes e pagas) e valor total do mês.
2. **Given** um inquilino com contrato, **When** ele clica em "Baixar Contrato", **Then** o PDF do contrato é baixado.
3. **Given** um inquilino com acesso à área de documentos, **When** ele faz upload de um comprovante, **Then** o documento fica disponível para o proprietário na área compartilhada.

---

### User Story 8 - Templates de Contrato Personalizados (Priority: P3)

O proprietário pode fazer upload de seus próprios templates de contrato (além dos templates padrão oferecidos pela plataforma). Ao criar um novo contrato, ele escolhe qual template utilizar e o sistema preenche automaticamente os campos variáveis com os dados do inquilino e do contrato.

**Why this priority**: Personalização de templates agrega valor mas não é essencial para o MVP — os templates padrão atendem a maioria dos casos iniciais.

**Independent Test**: Pode ser testado fazendo upload de um template customizado, criando um contrato com ele e verificando que os dados foram preenchidos corretamente no documento gerado.

**Acceptance Scenarios**:

1. **Given** um proprietário na área de templates, **When** ele faz upload de um novo template de contrato, **Then** o template é salvo e aparece como opção na criação de novos contratos.
2. **Given** um proprietário criando um contrato com um template personalizado, **When** ele confirma os dados, **Then** o sistema preenche automaticamente os campos variáveis (nome, CPF, endereço, valores) e gera o documento final.
3. **Given** um proprietário, **When** ele acessa a lista de templates sem ter enviado nenhum, **Then** visualiza ao menos um template padrão do sistema disponível para uso.

---

### User Story 9 - Geração de Anúncio para Imóvel Vago (Priority: P3)

O proprietário acessa um imóvel com status "Vago" e clica em "Gerar Anúncio". O sistema formata automaticamente um anúncio completo com título atrativo, descrição detalhada baseada nas especificações cadastradas, valores e fotos, otimizado para as plataformas OLX, ZAP Imóveis e Viva Real. O proprietário pode revisar, editar e copiar o texto formatado.

**Why this priority**: É uma funcionalidade de conveniência que agiliza a divulgação, mas o proprietário pode criar anúncios manualmente sem ela.

**Independent Test**: Pode ser testado com um imóvel vago completo (fotos, especificações, valores) e verificando que o anúncio gerado contém todas as informações relevantes e está formatado adequadamente para cada plataforma.

**Acceptance Scenarios**:

1. **Given** um imóvel com status "Vago" e dados completos, **When** o proprietário clica em "Gerar Anúncio", **Then** o sistema gera título, descrição e valores formatados para OLX, ZAP Imóveis e Viva Real.
2. **Given** um anúncio gerado, **When** o proprietário revisa o texto, **Then** ele pode editar qualquer campo antes de copiar.
3. **Given** um anúncio finalizado, **When** o proprietário clica em "Copiar" para uma plataforma específica, **Then** o texto formatado para aquela plataforma é copiado para a área de transferência.

---

### Edge Cases

- O que acontece quando um contrato vence e não é renovado? O sistema altera o status do imóvel para "Vago" e encerra a geração de novas cobranças, mantendo o histórico.
- O que acontece quando o proprietário tenta excluir um imóvel que possui contrato ativo? O sistema impede a exclusão e informa que o imóvel possui vínculo ativo.
- O que acontece quando há falha no upload de fotos de vistoria? O sistema permite reenvio e não perde fotos já enviadas na mesma sessão.
- Como o sistema lida com cobranças de meses com valores diferentes (ex: IPTU com reajuste anual)? O proprietário pode editar valores de cobranças futuras individualmente, sem afetar as já geradas.
- O que acontece quando dois proprietários tentam cadastrar o mesmo imóvel (mesmo endereço)? Cada proprietário gerencia seus próprios dados de forma isolada — imóveis de um não são visíveis ao outro.
- Como o sistema trata tentativas de acesso a dados de outros usuários via manipulação de URL/API? Todas as consultas são filtradas pelo identificador do usuário autenticado, retornando erro de permissão para dados alheios.
- O que acontece com os dados do inquilino após o término do contrato? Os dados permanecem vinculados ao contrato encerrado para fins de histórico, respeitando as políticas de retenção definidas na LGPD.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST permitir cadastro e autenticação de usuários com verificação de e-mail, separando perfis de proprietário e inquilino.
- **FR-002**: O sistema MUST isolar completamente os dados de cada usuário — nenhum proprietário pode acessar dados de outro proprietário, e nenhum inquilino pode acessar dados de outro inquilino.
- **FR-003**: O proprietário MUST poder cadastrar imóveis com endereço, tipo, metragem, cômodos, valores de IPTU/condomínio e fotos.
- **FR-004**: O proprietário MUST poder criar contratos selecionando um template, preenchendo dados do inquilino (Nome, CPF, RG, Endereço) e dados contratuais (valor aluguel, duração, caução, vencimento, imóvel).
- **FR-005**: O sistema MUST gerar o documento do contrato preenchido para download/impressão ao confirmar a criação.
- **FR-006**: O sistema MUST gerar automaticamente todas as cobranças mensais (aluguel, IPTU, condomínio se houver) e a cobrança de caução para todo o período contratual no momento da criação do contrato.
- **FR-007**: O sistema MUST alterar automaticamente o status do imóvel para "Alugado" quando um contrato é criado e para "Vago" quando o contrato é encerrado.
- **FR-008**: O sistema MUST validar CPF, CNPJ e dados obrigatórios tanto no cliente quanto no servidor antes de persistir qualquer informação.
- **FR-009**: O proprietário MUST visualizar um dashboard com: total de contratos ativos, valor a receber no mês, contratos a vencer, receita recebida vs. a receber, e listagem de imóveis agrupados por dia de vencimento.
- **FR-010**: O proprietário MUST poder registrar vistorias de entrada e saída com fotos categorizadas, vinculadas ao contrato e ao imóvel.
- **FR-011**: Proprietário e inquilino MUST poder enviar e visualizar documentos compartilhados (comprovantes, ordens de serviço) na área do contrato.
- **FR-012**: O inquilino MUST poder visualizar seus contratos ativos, cobranças pendentes e pagas, e fazer download do contrato.
- **FR-013**: O proprietário MUST poder fazer upload de templates de contrato personalizados, além dos templates padrão do sistema.
- **FR-014**: O sistema MUST formatar automaticamente anúncios de imóveis vagos para OLX, ZAP Imóveis e Viva Real com base nos dados cadastrados.
- **FR-015**: O sistema MUST impedir alteração direta de faturas já pagas — correções devem ser feitas via estorno ou ajuste compensatório.
- **FR-016**: O sistema MUST gerar logs de auditoria imutáveis para toda modificação de status de contrato, exclusão de dados e alteração de faturas.
- **FR-017**: O sistema MUST armazenar valores monetários como inteiros (centavos) ou tipo numérico de precisão exata, nunca como ponto flutuante.
- **FR-018**: O sistema MUST proteger todos os dados pessoais e documentos em conformidade com a LGPD, incluindo criptografia em trânsito, controle de acesso granular e possibilidade de exclusão de dados pessoais mediante solicitação do titular.
- **FR-019**: O sistema MUST garantir idempotência em rotinas automáticas de geração de cobranças — execuções repetidas não devem gerar duplicatas.
- **FR-020**: O sistema MUST processar geração de PDFs e parse de templates de forma assíncrona, sem bloquear a interface do usuário.

### Key Entities

- **Usuário**: Pessoa cadastrada na plataforma. Possui perfil (proprietário ou inquilino), dados pessoais (nome, CPF, e-mail, telefone) e credenciais de acesso.
- **Imóvel**: Propriedade cadastrada por um proprietário. Possui endereço, tipo, especificações físicas, valores fixos (IPTU, condomínio), fotos e status (Vago, Alugado).
- **Contrato**: Acordo de locação vinculando um proprietário, um inquilino e um imóvel. Possui template utilizado, datas de início/fim, valor de aluguel, valor de caução, dia de vencimento, status (Ativo, Encerrado) e documento gerado.
- **Fatura**: Cobrança individual gerada para um mês de contrato. Possui valor, componentes (aluguel, IPTU, condomínio, caução), data de vencimento, status (Pendente, Pago, Atrasado) e referência ao contrato.
- **Vistoria**: Registro fotográfico do estado do imóvel. Possui tipo (Entrada, Saída), fotos categorizadas por cômodo, data de registro e vínculo com contrato e imóvel.
- **Documento**: Arquivo enviado por proprietário ou inquilino no contexto de um contrato. Possui tipo, descrição, data de envio, autor e arquivo.
- **Template de Contrato**: Modelo de documento utilizado para gerar contratos. Possui tipo (Padrão do sistema, Personalizado), campos variáveis e proprietário associado (se personalizado).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Proprietários conseguem criar um contrato completo (desde a seleção do template até a geração do documento e cobranças) em menos de 10 minutos.
- **SC-002**: O sistema suporta pelo menos 500 proprietários simultâneos sem degradação perceptível na experiência de uso.
- **SC-003**: 95% dos proprietários conseguem cadastrar um imóvel e criar seu primeiro contrato sem suporte externo na primeira utilização.
- **SC-004**: O dashboard exibe métricas financeiras atualizadas em menos de 3 segundos após o carregamento da página.
- **SC-005**: 100% das cobranças geradas automaticamente possuem valores corretos (aluguel + encargos) sem discrepância de centavos.
- **SC-006**: Nenhum dado de um usuário é acessível por outro usuário não autorizado em qualquer cenário de uso.
- **SC-007**: O tempo de geração do documento de contrato (PDF) não excede 15 segundos a partir da confirmação.
- **SC-008**: 90% dos inquilinos conseguem acessar suas cobranças e baixar o contrato sem suporte externo.
- **SC-009**: O anúncio gerado automaticamente contém todas as informações essenciais do imóvel (título, descrição, metragem, cômodos, valor) e está pronto para publicação sem edição obrigatória.

## Assumptions

- O acesso à internet é requisito para utilizar a plataforma (não há modo offline).
- A autenticação será feita por e-mail e senha com verificação de e-mail. Login social (Google, Apple) pode ser adicionado futuramente mas está fora do escopo inicial.
- Os templates padrão de contrato fornecidos pelo sistema atendem aos modelos mais comuns de locação residencial e comercial no Brasil.
- Valores de IPTU e condomínio são informados manualmente pelo proprietário no momento do cadastro do imóvel e replicados para as cobranças. Integração com fontes externas está fora do escopo.
- O sistema não realiza cobrança ou processamento de pagamento — apenas registra o status da fatura (Pendente, Pago, Atrasado). Integração com gateways de pagamento é um possível incremento futuro.
- A geração de anúncios para OLX, ZAP Imóveis e Viva Real consiste na formatação de texto para cópia manual — não há integração direta via API com essas plataformas.
- O suporte a múltiplos idiomas está fora do escopo — a plataforma será em português brasileiro.
- A conformidade com a LGPD será garantida com recursos gratuitos: criptografia em trânsito (HTTPS/TLS), controle de acesso por RLS, logs de auditoria e funcionalidade de exclusão de dados pessoais mediante solicitação.
- O aplicativo mobile (Flutter) e o painel web (React) compartilham a mesma base de dados e regras de negócio, diferindo apenas na interface.
