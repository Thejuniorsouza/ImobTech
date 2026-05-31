import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/supabase_client.dart';
import '../../../core/models/domain_models.dart';
import '../../../core/models/constants.dart';
import '../../../core/utils/currency.dart';
import 'properties_screen.dart';

class PropertyDetailScreen extends ConsumerStatefulWidget {
  const PropertyDetailScreen({super.key, this.propertyId});
  final String? propertyId;

  @override
  ConsumerState<PropertyDetailScreen> createState() =>
      _PropertyDetailScreenState();
}

class _PropertyDetailScreenState extends ConsumerState<PropertyDetailScreen> {
  final _formKey = GlobalKey<FormState>();
  bool get _isNew => widget.propertyId == null || widget.propertyId == 'new';

  final _streetCtrl = TextEditingController();
  final _numberCtrl = TextEditingController();
  final _neighborhoodCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _stateCtrl = TextEditingController();
  final _zipCtrl = TextEditingController();
  final _iptuCtrl = TextEditingController();
  final _condoCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  PropertyType _propertyType = PropertyType.house;
  PropertyStatus _propertyStatus = PropertyStatus.vacant;
  int _bedrooms = 0;
  int _bathrooms = 0;
  int _parkingSpaces = 0;

  bool _loading = false;
  bool _fetching = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (!_isNew) _fetchProperty();
  }

  Future<void> _fetchProperty() async {
    setState(() => _fetching = true);
    try {
      final data = await supabase
          .from('properties')
          .select()
          .eq('id', widget.propertyId!)
          .single();
      final p = Property.fromJson(data);
      _streetCtrl.text = p.addressStreet;
      _numberCtrl.text = p.addressNumber;
      _neighborhoodCtrl.text = p.addressNeighborhood;
      _cityCtrl.text = p.addressCity;
      _stateCtrl.text = p.addressState;
      _zipCtrl.text = p.addressZip;
      _iptuCtrl.text = centsToDisplay(
        p.iptuMonthlyCents,
      ).replaceAll(RegExp(r'[R$\s]'), '');
      _condoCtrl.text = centsToDisplay(
        p.condoMonthlyCents,
      ).replaceAll(RegExp(r'[R$\s]'), '');
      _descCtrl.text = p.description ?? '';
      setState(() {
        _propertyType = p.propertyType;
        _propertyStatus = p.status;
        _bedrooms = p.bedrooms;
        _bathrooms = p.bathrooms;
        _parkingSpaces = p.parkingSpaces;
      });
    } catch (e) {
      setState(() => _error = 'Erro ao carregar imóvel.');
    } finally {
      if (mounted) setState(() => _fetching = false);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    final payload = {
      'address_street': _streetCtrl.text.trim(),
      'address_number': _numberCtrl.text.trim(),
      'address_neighborhood': _neighborhoodCtrl.text.trim(),
      'address_city': _cityCtrl.text.trim(),
      'address_state': _stateCtrl.text.trim().toUpperCase(),
      'address_zip': _zipCtrl.text.replaceAll(RegExp(r'\D'), ''),
      'property_type': _propertyType.name,
      'bedrooms': _bedrooms,
      'bathrooms': _bathrooms,
      'parking_spaces': _parkingSpaces,
      'iptu_monthly_cents': displayToCents(_iptuCtrl.text),
      'condo_monthly_cents': displayToCents(_condoCtrl.text),
      'description': _descCtrl.text.trim().isEmpty
          ? null
          : _descCtrl.text.trim(),
    };

    try {
      if (_isNew) {
        final user = supabase.auth.currentUser;
        if (user == null) throw Exception('Não autorizado.');
        await supabase.from('properties').insert({
          ...payload,
          'owner_id': user.id,
          'status': 'vacant',
        });
      } else {
        await supabase
            .from('properties')
            .update(payload)
            .eq('id', widget.propertyId!);
      }
      if (!mounted) return;
      ref.invalidate(propertiesProvider);
      context.go('/owner/properties');
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir imóvel?'),
        content: const Text('Esta ação não pode ser desfeita.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Excluir', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _loading = true);
    try {
      await supabase.from('properties').delete().eq('id', widget.propertyId!);
      if (!mounted) return;
      ref.invalidate(propertiesProvider);
      context.go('/owner/properties');
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  void dispose() {
    _streetCtrl.dispose();
    _numberCtrl.dispose();
    _neighborhoodCtrl.dispose();
    _cityCtrl.dispose();
    _stateCtrl.dispose();
    _zipCtrl.dispose();
    _iptuCtrl.dispose();
    _condoCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Widget _field(
    String label,
    TextEditingController ctrl, {
    TextInputType? keyboard,
    bool required = true,
    int maxLines = 1,
  }) {
    return TextFormField(
      controller: ctrl,
      keyboardType: keyboard,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
      validator: required
          ? (v) => (v == null || v.isEmpty) ? 'Campo obrigatório.' : null
          : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_fetching) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_isNew ? 'Novo Imóvel' : 'Editar Imóvel'),
        actions: [
          if (!_isNew && _propertyStatus == PropertyStatus.vacant)
            IconButton(
              icon: const Icon(Icons.campaign_outlined),
              tooltip: 'Gerar Anúncio',
              onPressed: () =>
                  context.go('/owner/properties/${widget.propertyId}/ad'),
            ),
          if (!_isNew)
            IconButton(
              icon: const Icon(Icons.delete_outline, color: Colors.red),
              onPressed: _loading ? null : _delete,
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _error!,
                    style: TextStyle(color: Colors.red.shade700),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              _field('Logradouro', _streetCtrl),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _field(
                      'Número',
                      _numberCtrl,
                      keyboard: TextInputType.number,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: _field('Bairro', _neighborhoodCtrl)),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(flex: 2, child: _field('Cidade', _cityCtrl)),
                  const SizedBox(width: 12),
                  Expanded(child: _field('UF', _stateCtrl)),
                ],
              ),
              const SizedBox(height: 12),
              _field(
                'CEP (somente números)',
                _zipCtrl,
                keyboard: TextInputType.number,
              ),
              const SizedBox(height: 16),

              // Type dropdown
              DropdownButtonFormField<PropertyType>(
                initialValue: _propertyType,
                decoration: const InputDecoration(
                  labelText: 'Tipo',
                  border: OutlineInputBorder(),
                ),
                items: PropertyType.values
                    .map(
                      (t) => DropdownMenuItem(
                        value: t,
                        child: Text(propertyTypeLabels[t] ?? t.name),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setState(() => _propertyType = v!),
              ),
              const SizedBox(height: 12),

              // Counter row
              Row(
                children: [
                  _Counter(
                    'Quartos',
                    _bedrooms,
                    (v) => setState(() => _bedrooms = v),
                  ),
                  const SizedBox(width: 12),
                  _Counter(
                    'Banheiros',
                    _bathrooms,
                    (v) => setState(() => _bathrooms = v),
                  ),
                  const SizedBox(width: 12),
                  _Counter(
                    'Vagas',
                    _parkingSpaces,
                    (v) => setState(() => _parkingSpaces = v),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              Row(
                children: [
                  Expanded(
                    child: _field(
                      'IPTU mensal (R\$)',
                      _iptuCtrl,
                      keyboard: TextInputType.number,
                      required: false,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _field(
                      'Condomínio (R\$)',
                      _condoCtrl,
                      keyboard: TextInputType.number,
                      required: false,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _field('Descrição', _descCtrl, required: false, maxLines: 3),
              const SizedBox(height: 24),

              FilledButton(
                onPressed: _loading ? null : _save,
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(_isNew ? 'Salvar imóvel' : 'Atualizar'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Counter extends StatelessWidget {
  const _Counter(this.label, this.value, this.onChanged);
  final String label;
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(label, style: const TextStyle(fontSize: 12)),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.remove_circle_outline, size: 20),
                onPressed: value > 0 ? () => onChanged(value - 1) : null,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Text(
                  '$value',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.add_circle_outline, size: 20),
                onPressed: () => onChanged(value + 1),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
