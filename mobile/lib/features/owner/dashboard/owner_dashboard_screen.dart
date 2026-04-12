import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/supabase_client.dart';
import '../../../core/utils/currency.dart';

// ── Model ─────────────────────────────────────────────────────────────────

class _DashboardMetrics {
  final int totalActiveContracts;
  final int totalReceivableCents;
  final int totalReceivedCents;
  final int contractsExpiringSoon;
  final List<_DueDayGroup> propertiesByDueDay;

  const _DashboardMetrics({
    required this.totalActiveContracts,
    required this.totalReceivableCents,
    required this.totalReceivedCents,
    required this.contractsExpiringSoon,
    required this.propertiesByDueDay,
  });

  factory _DashboardMetrics.fromJson(Map<String, dynamic> json) {
    final groups = (json['properties_by_due_day'] as List? ?? [])
        .map((g) => _DueDayGroup.fromJson(g as Map<String, dynamic>))
        .toList();
    return _DashboardMetrics(
      totalActiveContracts: json['total_active_contracts'] as int? ?? 0,
      totalReceivableCents: json['total_receivable_cents'] as int? ?? 0,
      totalReceivedCents: json['total_received_cents'] as int? ?? 0,
      contractsExpiringSoon: json['contracts_expiring_soon'] as int? ?? 0,
      propertiesByDueDay: groups,
    );
  }
}

class _DueDayGroup {
  final int dueDay;
  final List<String> propertyAddresses;

  const _DueDayGroup({required this.dueDay, required this.propertyAddresses});

  factory _DueDayGroup.fromJson(Map<String, dynamic> json) {
    final props = (json['properties'] as List? ?? [])
        .map((p) => (p as Map<String, dynamic>)['address'] as String? ?? '')
        .toList();
    return _DueDayGroup(dueDay: json['due_day'] as int, propertyAddresses: props);
  }
}

// ── Provider ──────────────────────────────────────────────────────────────

final dashboardMetricsProvider =
    FutureProvider.autoDispose<_DashboardMetrics>((ref) async {
  final response = await supabase.functions.invoke('dashboard-metrics');
  final data = response.data as Map<String, dynamic>;
  return _DashboardMetrics.fromJson(data);
});

// ── Screen ────────────────────────────────────────────────────────────────

class OwnerDashboardScreen extends ConsumerWidget {
  const OwnerDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metricsAsync = ref.watch(dashboardMetricsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Meu Painel')),
      body: metricsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erro: $e')),
        data: (m) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(dashboardMetricsProvider),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // ── KPI grid ─────────────────────────────
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.35,
                children: [
                  _KpiCard(
                    icon: Icons.description_outlined,
                    label: 'Contratos ativos',
                    value: '${m.totalActiveContracts}',
                  ),
                  _KpiCard(
                    icon: Icons.warning_amber_rounded,
                    label: 'Expirando em breve',
                    value: '${m.contractsExpiringSoon}',
                    color: m.contractsExpiringSoon > 0 ? Colors.orange : null,
                  ),
                  _KpiCard(
                    icon: Icons.attach_money,
                    label: 'A receber (mês)',
                    value: centsToDisplay(m.totalReceivableCents),
                  ),
                  _KpiCard(
                    icon: Icons.check_circle_outline,
                    label: 'Recebido (mês)',
                    value: centsToDisplay(m.totalReceivedCents),
                    color: Colors.green,
                  ),
                ],
              ),
              const SizedBox(height: 24),
              // ── Due-day timeline ──────────────────────
              if (m.propertiesByDueDay.isNotEmpty) ...[
                Text(
                  'Vencimentos por dia',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                ...m.propertiesByDueDay.map(
                  (g) => _DueDayTile(group: g),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.icon,
    required this.label,
    required this.value,
    this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color ?? scheme.primary, size: 22),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 20,
                color: color ?? scheme.onSurface,
              ),
            ),
            const SizedBox(height: 2),
            Text(label,
                style: const TextStyle(fontSize: 12, color: Colors.grey),
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}

class _DueDayTile extends StatelessWidget {
  const _DueDayTile({required this.group});
  final _DueDayGroup group;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Dia ${group.dueDay}',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            ...group.propertyAddresses.map(
              (addr) => Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Row(
                  children: [
                    const Icon(Icons.home_outlined, size: 14, color: Colors.grey),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        addr,
                        style: const TextStyle(fontSize: 13, color: Colors.grey),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
