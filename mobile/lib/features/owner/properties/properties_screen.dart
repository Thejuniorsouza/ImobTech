import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/supabase_client.dart';
import '../../../core/models/domain_models.dart';
import '../../../core/models/constants.dart';
import '../../../core/utils/currency.dart';

// ── Provider ──────────────────────────────────────────────────────────────

final propertiesProvider = FutureProvider.autoDispose<List<Property>>((ref) async {
  final user = supabase.auth.currentUser;
  if (user == null) return [];

  final response = await supabase
      .from('properties')
      .select()
      .eq('owner_id', user.id)
      .order('created_at', ascending: false);

  return (response as List)
      .map((e) => Property.fromJson(e as Map<String, dynamic>))
      .toList();
});

// ── Screen ────────────────────────────────────────────────────────────────

class PropertiesScreen extends ConsumerWidget {
  const PropertiesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final propertiesAsync = ref.watch(propertiesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Meus Imóveis'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'Novo imóvel',
            onPressed: () => context.go('/owner/properties/new'),
          ),
        ],
      ),
      body: propertiesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erro: $e')),
        data: (properties) {
          if (properties.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.home_outlined, size: 64, color: Colors.grey),
                  const SizedBox(height: 12),
                  const Text('Nenhum imóvel cadastrado.', style: TextStyle(color: Colors.grey)),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: () => context.go('/owner/properties/new'),
                    icon: const Icon(Icons.add),
                    label: const Text('Adicionar imóvel'),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(propertiesProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: properties.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (ctx, i) => _PropertyCard(property: properties[i]),
            ),
          );
        },
      ),
    );
  }
}

class _PropertyCard extends StatelessWidget {
  const _PropertyCard({required this.property});
  final Property property;

  @override
  Widget build(BuildContext context) {
    final isRented = property.status == PropertyStatus.rented;

    return Card(
      clipBehavior: Clip.hardEdge,
      child: InkWell(
        onTap: () => context.go('/owner/properties/${property.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      property.fullAddress,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Chip(
                    label: Text(
                      propertyStatusLabels[property.status] ?? '',
                      style: const TextStyle(fontSize: 11),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    backgroundColor: isRented
                        ? Colors.green.shade100
                        : Colors.blue.shade100,
                    labelStyle: TextStyle(
                      color: isRented ? Colors.green.shade800 : Colors.blue.shade800,
                    ),
                    side: BorderSide.none,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  _InfoPill(Icons.bed, '${property.bedrooms}'),
                  const SizedBox(width: 8),
                  _InfoPill(Icons.bathroom, '${property.bathrooms}'),
                  const SizedBox(width: 8),
                  _InfoPill(Icons.directions_car, '${property.parkingSpaces}'),
                  const Spacer(),
                  Text(
                    propertyTypeLabels[property.propertyType] ?? '',
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill(this.icon, this.label);
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: Colors.grey),
        const SizedBox(width: 2),
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
      ],
    );
  }
}
