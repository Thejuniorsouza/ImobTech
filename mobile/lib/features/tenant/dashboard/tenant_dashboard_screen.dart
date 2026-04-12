import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/supabase_client.dart';
import '../../../core/models/domain_models.dart';
import '../../../core/models/constants.dart';
import '../../../core/utils/currency.dart';

// ── Providers ─────────────────────────────────────────────────────────────

final tenantContractsProvider = FutureProvider.autoDispose<List<Contract>>((ref) async {
  final user = supabase.auth.currentUser;
  if (user == null) return [];

  final response = await supabase
      .from('contracts')
      .select()
      .eq('tenant_id', user.id)
      .order('created_at', ascending: false);

  return (response as List)
      .map((e) => Contract.fromJson(e as Map<String, dynamic>))
      .toList();
});

final tenantInvoicesCurrentMonthProvider =
    FutureProvider.autoDispose<List<Invoice>>((ref) async {
  final user = supabase.auth.currentUser;
  if (user == null) return [];

  // Get contract ids for this tenant.
  final contractsRaw = await supabase
      .from('contracts')
      .select('id')
      .eq('tenant_id', user.id);

  final ids = (contractsRaw as List).map((e) => e['id'] as String).toList();
  if (ids.isEmpty) return [];

  final now = DateTime.now();
  final monthPrefix = '${now.year}-${now.month.toString().padLeft(2, '0')}';

  final response = await supabase
      .from('invoices')
      .select()
      .inFilter('contract_id', ids)
      .like('competencia_month', '$monthPrefix%')
      .order('due_date');

  return (response as List)
      .map((e) => Invoice.fromJson(e as Map<String, dynamic>))
      .toList();
});

// ── Screen ────────────────────────────────────────────────────────────────

class TenantDashboardScreen extends ConsumerWidget {
  const TenantDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contractsAsync = ref.watch(tenantContractsProvider);
    final invoicesAsync = ref.watch(tenantInvoicesCurrentMonthProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Minha Área')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Month invoices alert ──────────────────
          invoicesAsync.maybeWhen(
            data: (invoices) {
              final pendingTotal = invoices
                  .where((inv) =>
                      inv.status == InvoiceStatus.pending ||
                      inv.status == InvoiceStatus.overdue)
                  .fold<int>(0, (sum, inv) => sum + inv.amountCents);

              if (pendingTotal == 0) return const SizedBox.shrink();

              return Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.orange.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning_amber_rounded,
                        color: Colors.orange.shade700),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Saldo pendente este mês: ${centsToDisplay(pendingTotal)}',
                        style: TextStyle(
                          color: Colors.orange.shade800,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
            orElse: () => const SizedBox.shrink(),
          ),

          // ── Active contracts ──────────────────────
          Text('Meus Contratos', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          contractsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Text('Erro: $e'),
            data: (contracts) {
              final active = contracts
                  .where((c) => c.status == ContractStatus.active)
                  .toList();

              if (active.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(
                    child: Text(
                      'Nenhum contrato ativo.',
                      style: TextStyle(color: Colors.grey),
                    ),
                  ),
                );
              }

              return Column(
                children: active
                    .map((c) => _TenantContractCard(contract: c))
                    .toList(),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _TenantContractCard extends StatelessWidget {
  const _TenantContractCard({required this.contract});
  final Contract contract;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      clipBehavior: Clip.hardEdge,
      child: InkWell(
        onTap: () => context.go('/tenant/contracts/${contract.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Aluguel: ${centsToDisplay(contract.rentAmountCents)}/mês',
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
              ),
              const SizedBox(height: 4),
              Text(
                'Vencimento: Dia ${contract.dueDay}',
                style: const TextStyle(color: Colors.grey, fontSize: 13),
              ),
              const SizedBox(height: 2),
              Text(
                '${_fmtDate(contract.startDate)} – ${_fmtDate(contract.endDate)}',
                style: const TextStyle(color: Colors.grey, fontSize: 12),
              ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => context.go('/tenant/contracts/${contract.id}'),
                  child: const Text('Ver detalhes →'),
                ),
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
