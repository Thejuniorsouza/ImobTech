-- ============================================================
-- Seed: seed.sql
-- Purpose: Insert default system contract templates.
-- ============================================================

-- Residential template (is_system = true, owner_id = NULL)
INSERT INTO public.contract_templates (id, owner_id, name, body, is_system)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  NULL,
  'Contrato Residencial Padrão',
  E'CONTRATO DE LOCAÇÃO RESIDENCIAL\n\n'
  'Pelo presente instrumento particular, as partes abaixo identificadas celebram\n'
  'o presente Contrato de Locação Residencial, regido pela Lei nº 8.245/91.\n\n'
  '1. PARTES\n\n'
  'LOCADOR: {{owner_name}}, CPF nº {{owner_cpf}},\n'
  'residente e domiciliado em {{owner_address}}.\n\n'
  'LOCATÁRIO: {{tenant_name}}, CPF nº {{tenant_cpf}}, RG nº {{tenant_rg}},\n'
  'residente e domiciliado em {{tenant_address}}.\n\n'
  '2. IMÓVEL\n\n'
  'O LOCADOR cede ao LOCATÁRIO, para fins exclusivamente residenciais,\n'
  'o imóvel localizado em {{property_address}}.\n\n'
  '3. PRAZO\n\n'
  'O prazo da locação é de {{contract_duration_months}} meses,\n'
  'com início em {{start_date}} e término em {{end_date}}.\n\n'
  '4. ALUGUEL\n\n'
  'O valor do aluguel mensal é de {{rent_amount}}, com vencimento todo\n'
  'dia {{due_day}} de cada mês.\n\n'
  '5. CAUÇÃO\n\n'
  'Fica estipulada a caução no valor de {{deposit_amount}}, a ser\n'
  'devolvida ao término do contrato, descontados eventuais danos.\n\n'
  '6. ENCARGOS\n\n'
  'O IPTU mensal de {{iptu_monthly}} e o condomínio mensal de {{condo_monthly}}\n'
  'são de responsabilidade do LOCATÁRIO.\n\n'
  '7. DISPOSIÇÕES GERAIS\n\n'
  'Fica eleito o foro da comarca de {{property_city}} para dirimir quaisquer\n'
  'dúvidas oriundas do presente contrato.\n\n'
  'Local e data: {{property_city}}, {{contract_date}}.\n\n'
  '___________________________________\n'
  'LOCADOR: {{owner_name}}\n\n'
  '___________________________________\n'
  'LOCATÁRIO: {{tenant_name}}\n',
  true
),
(
  'a1b2c3d4-0000-0000-0000-000000000002',
  NULL,
  'Contrato Comercial Padrão',
  E'CONTRATO DE LOCAÇÃO COMERCIAL\n\n'
  'Pelo presente instrumento particular, as partes abaixo identificadas celebram\n'
  'o presente Contrato de Locação Comercial, regido pela Lei nº 8.245/91.\n\n'
  '1. PARTES\n\n'
  'LOCADOR: {{owner_name}}, CPF nº {{owner_cpf}},\n'
  'residente e domiciliado em {{owner_address}}.\n\n'
  'LOCATÁRIO: {{tenant_name}}, CPF nº {{tenant_cpf}}, RG nº {{tenant_rg}},\n'
  'residente e domiciliado em {{tenant_address}}.\n\n'
  '2. IMÓVEL\n\n'
  'O LOCADOR cede ao LOCATÁRIO, para fins comerciais,\n'
  'o imóvel localizado em {{property_address}}.\n\n'
  '3. PRAZO\n\n'
  'O prazo da locação é de {{contract_duration_months}} meses,\n'
  'com início em {{start_date}} e término em {{end_date}}.\n\n'
  '4. ALUGUEL\n\n'
  'O valor do aluguel mensal é de {{rent_amount}}, com vencimento todo\n'
  'dia {{due_day}} de cada mês.\n\n'
  '5. CAUÇÃO\n\n'
  'Fica estipulada a caução no valor de {{deposit_amount}}.\n\n'
  '6. ENCARGOS\n\n'
  'Todos os encargos relativos ao imóvel (IPTU, condomínio, água, luz)\n'
  'são de exclusiva responsabilidade do LOCATÁRIO.\n\n'
  'IPTU mensal: {{iptu_monthly}} | Condomínio: {{condo_monthly}}\n\n'
  '7. DISPOSIÇÕES GERAIS\n\n'
  'Fica eleito o foro da comarca de {{property_city}}.\n\n'
  'Local e data: {{property_city}}, {{contract_date}}.\n\n'
  '___________________________________\n'
  'LOCADOR: {{owner_name}}\n\n'
  '___________________________________\n'
  'LOCATÁRIO: {{tenant_name}}\n',
  true
)
ON CONFLICT (id) DO NOTHING;
