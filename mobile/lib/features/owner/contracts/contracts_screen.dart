import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/supabase_client.dart';
import '../../../core/models/domain_models.dart';
import '../../../core/models/constants.dart';
import '../../../core/utils/currency.dart';

// ── Provider ──────────────────────────────────────────────────────────────

final ownerContractsProvider = FutureProvider.autoDispose<List<Contract>>((ref) async {
  final user = supabase.auth.currentUser;
  if (user == null) return [];

  final response = await supabase
      .from('contracts')
      .select()
      .eq('owner_id', user.id)
      .order('created_at', ascending: false);

  return (response as List)
      .map((e) => Contract.fromJson(e as Map<String, dynamic>))
      .toList();
});

// ── Screen ────────────────────────────────────────────────────────────────

class ContractsScreen extends ConsumerWidget {
  const ContractsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contractsAsync = ref.watch(ownerContractsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Contratos')),
      body: contractsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erro: $e')),
        data: (contracts) {
          if (contracts.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.description_outlined, size: 64, color: Colors.grey),
                  SizedBox(height: 12),
                  Text('Nenhum contrato cadastrado.', style: TextStyle(color: Colors.grey)),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(ownerContractsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: contracts.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (ctx, i) => _ContractCard(contract: contracts[i]),
            ),
          );
        },
      ),
    );
  }
}

class _ContractCard extends StatelessWidget {
  const _ContractCard({required this.contract});
  final Contract contract;

  @override
  Widget build(BuildContext context) {
    final isActive = contract.status == ContractStatus.active;

    return Card(
      clipBehavior: Clip.hardEdge,
      child: InkWell(
        onTap: () => context.go('/owner/contracts/${contract.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      contract.tenantName,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                  ),
                  Chip(
                    label: Text(
                      contractStatusLabels[contract.status] ?? '',
                      style: const TextStyle(fontSize: 11),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    backgroundColor: isActive ? Colors.green.shade100 : Colors.grey.shade200,
                    labelStyle: TextStyle(
                      color: isActive ? Colors.green.shade800 : Colors.grey.shade600,
                    ),
                    side: BorderSide.none,
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                '${centsToDisplay(contract.rentAmountCents)}/mês · Dia ${contract.dueDay}',
                style: const TextStyle(color: Colors.grey, fontSize: 13),
              ),
              const SizedBox(height: 4),
              Text(
                '${_fmtDate(contract.startDate)} – ${_fmtDate(contract.endDate)}',
                style: const TextStyle(color: Colors.grey, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _fmtDate(String iso) {
    final parts = iso.split('-');
    if (parts.length < 3) return iso;
    return '${parts[2]}/${parts[1]}/${parts[0]}';
  }
}
