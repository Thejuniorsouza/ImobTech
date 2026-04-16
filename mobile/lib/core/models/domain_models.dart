// Domain models mirroring the PostgreSQL schema.
// All monetary fields are in centavos (int). Never use double for money.

enum UserRole { owner, tenant }

enum PropertyType { house, apartment, commercial }

enum PropertyStatus { vacant, rented }

enum ContractStatus { active, terminated, expired }

enum InvoiceStatus { pending, paid, overdue, cancelled }

enum InvoiceType { rent, deposit, iptu, condo, fine, other }

enum InspectionType { entry, exit }

enum DocumentType { comprovante, ordemServico, comunicado, laudo, outro }

class Profile {
  final String id;
  final UserRole role;
  final String fullName;
  final String cpf;
  final String email;
  final String? phone;
  final String? rg;
  final String? address;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Profile({
    required this.id,
    required this.role,
    required this.fullName,
    required this.cpf,
    required this.email,
    this.phone,
    this.rg,
    this.address,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Profile.fromJson(Map<String, dynamic> json) => Profile(
    id: json['id'] as String,
    role: UserRole.values.firstWhere((e) => e.name == json['role']),
    fullName: json['full_name'] as String,
    cpf: json['cpf'] as String,
    email: json['email'] as String,
    phone: json['phone'] as String?,
    rg: json['rg'] as String?,
    address: json['address'] as String?,
    createdAt: DateTime.parse(json['created_at'] as String),
    updatedAt: DateTime.parse(json['updated_at'] as String),
  );
}

class Property {
  final String id;
  final String ownerId;
  final String addressStreet;
  final String addressNumber;
  final String? addressComplement;
  final String addressNeighborhood;
  final String addressCity;
  final String addressState;
  final String addressZip;
  final PropertyType propertyType;
  final double? areaSqm;
  final int bedrooms;
  final int bathrooms;
  final int parkingSpaces;

  /// IPTU mensal em centavos
  final int iptuMonthlyCents;

  /// Condomínio mensal em centavos
  final int condoMonthlyCents;
  final PropertyStatus status;
  final String? description;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Property({
    required this.id,
    required this.ownerId,
    required this.addressStreet,
    required this.addressNumber,
    this.addressComplement,
    required this.addressNeighborhood,
    required this.addressCity,
    required this.addressState,
    required this.addressZip,
    required this.propertyType,
    this.areaSqm,
    required this.bedrooms,
    required this.bathrooms,
    required this.parkingSpaces,
    required this.iptuMonthlyCents,
    required this.condoMonthlyCents,
    required this.status,
    this.description,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Property.fromJson(Map<String, dynamic> json) => Property(
    id: json['id'] as String,
    ownerId: json['owner_id'] as String,
    addressStreet: json['address_street'] as String,
    addressNumber: json['address_number'] as String,
    addressComplement: json['address_complement'] as String?,
    addressNeighborhood: json['address_neighborhood'] as String,
    addressCity: json['address_city'] as String,
    addressState: json['address_state'] as String,
    addressZip: json['address_zip'] as String,
    propertyType: PropertyType.values.firstWhere(
      (e) => e.name == json['property_type'],
    ),
    areaSqm: (json['area_sqm'] as num?)?.toDouble(),
    bedrooms: json['bedrooms'] as int,
    bathrooms: json['bathrooms'] as int,
    parkingSpaces: json['parking_spaces'] as int,
    iptuMonthlyCents: json['iptu_monthly_cents'] as int,
    condoMonthlyCents: json['condo_monthly_cents'] as int,
    status: PropertyStatus.values.firstWhere((e) => e.name == json['status']),
    description: json['description'] as String?,
    createdAt: DateTime.parse(json['created_at'] as String),
    updatedAt: DateTime.parse(json['updated_at'] as String),
  );

  String get fullAddress =>
      '$addressStreet, $addressNumber${addressComplement != null ? ' $addressComplement' : ''} — $addressCity/$addressState';
}

class Contract {
  final String id;
  final String propertyId;
  final String ownerId;
  final String tenantId;
  final String? templateId;

  /// Aluguel mensal em centavos
  final int rentAmountCents;

  /// Caução em centavos
  final int depositAmountCents;
  final int dueDay;
  final String startDate;
  final String endDate;
  final ContractStatus status;
  final String? pdfStoragePath;
  final String tenantName;
  final String tenantCpf;
  final String? tenantRg;
  final String? tenantAddress;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Contract({
    required this.id,
    required this.propertyId,
    required this.ownerId,
    required this.tenantId,
    this.templateId,
    required this.rentAmountCents,
    required this.depositAmountCents,
    required this.dueDay,
    required this.startDate,
    required this.endDate,
    required this.status,
    this.pdfStoragePath,
    required this.tenantName,
    required this.tenantCpf,
    this.tenantRg,
    this.tenantAddress,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Contract.fromJson(Map<String, dynamic> json) => Contract(
    id: json['id'] as String,
    propertyId: json['property_id'] as String,
    ownerId: json['owner_id'] as String,
    tenantId: json['tenant_id'] as String,
    templateId: json['template_id'] as String?,
    rentAmountCents: json['rent_amount_cents'] as int,
    depositAmountCents: json['deposit_amount_cents'] as int,
    dueDay: json['due_day'] as int,
    startDate: json['start_date'] as String,
    endDate: json['end_date'] as String,
    status: ContractStatus.values.firstWhere((e) => e.name == json['status']),
    pdfStoragePath: json['pdf_storage_path'] as String?,
    tenantName: json['tenant_name'] as String,
    tenantCpf: json['tenant_cpf'] as String,
    tenantRg: json['tenant_rg'] as String?,
    tenantAddress: json['tenant_address'] as String?,
    createdAt: DateTime.parse(json['created_at'] as String),
    updatedAt: DateTime.parse(json['updated_at'] as String),
  );
}

class Invoice {
  final String id;
  final String contractId;
  final String competenciaMonth;
  final InvoiceType invoiceType;

  /// Valor em centavos
  final int amountCents;
  final String dueDate;
  final InvoiceStatus status;
  final DateTime? paidAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Invoice({
    required this.id,
    required this.contractId,
    required this.competenciaMonth,
    required this.invoiceType,
    required this.amountCents,
    required this.dueDate,
    required this.status,
    this.paidAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Invoice.fromJson(Map<String, dynamic> json) => Invoice(
    id: json['id'] as String,
    contractId: json['contract_id'] as String,
    competenciaMonth: json['competencia_month'] as String,
    invoiceType: InvoiceType.values.firstWhere(
      (e) => e.name == json['invoice_type'],
    ),
    amountCents: json['amount_cents'] as int,
    dueDate: json['due_date'] as String,
    status: InvoiceStatus.values.firstWhere((e) => e.name == json['status']),
    paidAt: json['paid_at'] != null
        ? DateTime.parse(json['paid_at'] as String)
        : null,
    createdAt: DateTime.parse(json['created_at'] as String),
    updatedAt: DateTime.parse(json['updated_at'] as String),
  );
}

class Inspection {
  final String id;
  final String contractId;
  final InspectionType type;
  final String? description;
  final DateTime createdAt;

  const Inspection({
    required this.id,
    required this.contractId,
    required this.type,
    this.description,
    required this.createdAt,
  });

  factory Inspection.fromJson(Map<String, dynamic> json) => Inspection(
    id: json['id'] as String,
    contractId: json['contract_id'] as String,
    type: InspectionType.values.firstWhere((e) => e.name == json['type']),
    description: json['description'] as String?,
    createdAt: DateTime.parse(json['created_at'] as String),
  );
}

class InspectionPhoto {
  final String id;
  final String inspectionId;
  final String storagePath;
  final String? roomName;
  final String? description;
  final DateTime createdAt;

  const InspectionPhoto({
    required this.id,
    required this.inspectionId,
    required this.storagePath,
    this.roomName,
    this.description,
    required this.createdAt,
  });

  factory InspectionPhoto.fromJson(Map<String, dynamic> json) =>
      InspectionPhoto(
        id: json['id'] as String,
        inspectionId: json['inspection_id'] as String,
        storagePath: json['storage_path'] as String,
        roomName: json['room_name'] as String?,
        description: json['description'] as String?,
        createdAt: DateTime.parse(json['created_at'] as String),
      );
}

class ContractTemplate {
  final String id;
  final String? ownerId;
  final String title;
  final bool isSystem;
  final DateTime createdAt;

  const ContractTemplate({
    required this.id,
    this.ownerId,
    required this.title,
    required this.isSystem,
    required this.createdAt,
  });

  factory ContractTemplate.fromJson(Map<String, dynamic> json) =>
      ContractTemplate(
        id: json['id'] as String,
        ownerId: json['owner_id'] as String?,
        title: json['title'] as String,
        isSystem: json['is_system'] as bool? ?? false,
        createdAt: DateTime.parse(json['created_at'] as String),
      );
}

class SharedDocument {
  final String id;
  final String contractId;
  final String storagePath;
  final String fileName;
  final String documentType;
  final DateTime createdAt;

  const SharedDocument({
    required this.id,
    required this.contractId,
    required this.storagePath,
    required this.fileName,
    required this.documentType,
    required this.createdAt,
  });

  factory SharedDocument.fromJson(Map<String, dynamic> json) => SharedDocument(
    id: json['id'] as String,
    contractId: json['contract_id'] as String,
    storagePath: json['storage_path'] as String,
    fileName: json['file_name'] as String,
    documentType: json['document_type'] as String,
    createdAt: DateTime.parse(json['created_at'] as String),
  );
}
