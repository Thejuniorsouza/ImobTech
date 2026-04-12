import 'domain_models.dart';

const Map<UserRole, String> roleLabels = {
  UserRole.owner: 'Proprietário',
  UserRole.tenant: 'Inquilino',
};

const Map<PropertyType, String> propertyTypeLabels = {
  PropertyType.house: 'Casa',
  PropertyType.apartment: 'Apartamento',
  PropertyType.commercial: 'Comercial',
};

const Map<PropertyStatus, String> propertyStatusLabels = {
  PropertyStatus.vacant: 'Vago',
  PropertyStatus.rented: 'Alugado',
};

const Map<ContractStatus, String> contractStatusLabels = {
  ContractStatus.active: 'Ativo',
  ContractStatus.terminated: 'Encerrado',
};

const Map<InvoiceStatus, String> invoiceStatusLabels = {
  InvoiceStatus.pending: 'Pendente',
  InvoiceStatus.paid: 'Pago',
  InvoiceStatus.overdue: 'Atrasado',
};

const Map<InvoiceType, String> invoiceTypeLabels = {
  InvoiceType.rent: 'Aluguel',
  InvoiceType.deposit: 'Caução',
  InvoiceType.iptu: 'IPTU',
  InvoiceType.condo: 'Condomínio',
};

const Map<InspectionType, String> inspectionTypeLabels = {
  InspectionType.entry: 'Entrada',
  InspectionType.exit: 'Saída',
};

/// Max photo size: 10 MB
const int maxPhotoSizeBytes = 10 * 1024 * 1024;

/// Max document size: 50 MB
const int maxDocumentSizeBytes = 50 * 1024 * 1024;
