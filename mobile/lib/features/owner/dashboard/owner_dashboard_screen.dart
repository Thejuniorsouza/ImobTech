import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/supabase_client.dart';
import '../../../core/utils/currency.dart';

// ── Model ─────────────────────────────────────────────────────────────────

class _DashboardMetrics {
  final int totalActiveContracts;
  final int totalReceivableCents;
  final int totalReceivedCents;
  final int contractsExpiringSoon;
  final List<_DueDayGroup> propertiesByDueDay;

  /// Revenue totals by period: key = months (3, 6, 12) or null = all-time
  final Map<int?, int> receivedByPeriod;

  const _DashboardMetrics({
    required this.totalActiveContracts,
    required this.totalReceivableCents,
    required this.totalReceivedCents,
    required this.contractsExpiringSoon,
    required this.propertiesByDueDay,
    required this.receivedByPeriod,
  });
}

class _DueDayGroup {
  final int dueDay;
  final List<String> propertyAddresses;
  const _DueDayGroup({required this.dueDay, required this.propertyAddresses});
}

// ── Provider ──────────────────────────────────────────────────────────────

final dashboardMetricsProvider = FutureProvider.autoDispose<_DashboardMetrics>((
  ref,
) async {
  final user = supabase.auth.currentUser;
  if (user == null) throw Exception('Usuário não autenticado.');

  final now = DateTime.now();
  final monthStart = '${now.year}-${now.month.toString().padLeft(2, '0')}-01';
  final thirtyDaysLater = now.add(const Duration(days: 30));
  final thirtyDaysStr =
      '${thirtyDaysLater.year}-${thirtyDaysLater.month.toString().padLeft(2, '0')}-${thirtyDaysLater.day.toString().padLeft(2, '0')}';

  final contractsRaw = await supabase
      .from('contracts')
      .select('id, due_day, property_id')
      .eq('owner_id', user.id)
      .eq('status', 'active');

  final contracts = (contractsRaw as List).cast<Map<String, dynamic>>();
  final contractIds = contracts.map((c) => c['id'] as String).toList();

  final expiring = await supabase
      .from('contracts')
      .select('id')
      .eq('owner_id', user.id)
      .eq('status', 'active')
      .lte('end_date', thirtyDaysStr);
  final expiringSoon = (expiring as List).length;

  int receivableCents = 0;
  int receivedCents = 0;
  final dueDayMap = <int, List<String>>{};
  var receivedByPeriod = <int?, int>{3: 0, 6: 0, 12: 0, null: 0};

  if (contractIds.isNotEmpty) {
    // Receivable: rent invoices NOT yet paid for the current billing period
    final receivableRaw = await supabase
        .from('invoices')
        .select('amount_cents, status')
        .inFilter('contract_id', contractIds)
        .eq('invoice_type', 'rent')
        .eq('competencia_month', monthStart)
        .neq('status', 'paid')
        .neq('status', 'cancelled');

    for (final inv in (receivableRaw as List).cast<Map<String, dynamic>>()) {
      receivableCents += (inv['amount_cents'] as int?) ?? 0;
    }

    // Received: invoices with paid_at in the current calendar month (cash flow)
    final monthEndStr =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${DateTime(now.year, now.month + 1, 0).day}';
    final receivedRaw = await supabase
        .from('invoices')
        .select('amount_cents, paid_at')
        .inFilter('contract_id', contractIds)
        .eq('status', 'paid')
        .not('paid_at', 'is', null);

    final allPaid = (receivedRaw as List).cast<Map<String, dynamic>>();

    // Current month received
    for (final inv in allPaid) {
      final paidAt = inv['paid_at'] as String?;
      if (paidAt == null) continue;
      if (paidAt.compareTo(monthStart) >= 0 &&
          paidAt.compareTo('${monthEndStr}T23:59:59') <= 0) {
        receivedCents += (inv['amount_cents'] as int?) ?? 0;
      }
    }

    // Period totals (3m, 6m, 12m, all)
    int periodTotal(int? months) {
      final cutoff = months == null
          ? null
          : DateTime(
              now.year,
              now.month - months + 1,
              1,
            ).toIso8601String().substring(0, 10);
      int total = 0;
      for (final inv in allPaid) {
        final paidAt = inv['paid_at'] as String?;
        if (paidAt == null) continue;
        if (cutoff == null || paidAt.compareTo(cutoff) >= 0) {
          total += (inv['amount_cents'] as int?) ?? 0;
        }
      }
      return total;
    }

    receivedByPeriod = <int?, int>{
      3: periodTotal(3),
      6: periodTotal(6),
      12: periodTotal(12),
      null: periodTotal(null),
    };

    final propIds = contracts
        .map((c) => c['property_id'] as String)
        .toSet()
        .toList();
    final propsRaw = await supabase
        .from('properties')
        .select('id, address_street, address_number')
        .inFilter('id', propIds);
    final propMap = {
      for (final p in (propsRaw as List).cast<Map<String, dynamic>>())
        p['id'] as String: '${p['address_street']}, ${p['address_number']}',
    };

    for (final c in contracts) {
      final dueDay = (c['due_day'] as int?) ?? 0;
      final addr = propMap[c['property_id'] as String] ?? '';
      dueDayMap.putIfAbsent(dueDay, () => []).add(addr);
    }
  }

  final groups =
      dueDayMap.entries
          .map((e) => _DueDayGroup(dueDay: e.key, propertyAddresses: e.value))
          .toList()
        ..sort((a, b) => a.dueDay.compareTo(b.dueDay));

  return _DashboardMetrics(
    totalActiveContracts: contracts.length,
    totalReceivableCents: receivableCents,
    totalReceivedCents: receivedCents,
    contractsExpiringSoon: expiringSoon,
    propertiesByDueDay: groups,
    receivedByPeriod: receivedByPeriod,
  );
});

// ── Screen ────────────────────────────────────────────────────────────────

const _primary = Color(0xFF1C6147);
const _primaryLight = Color(0xFFDCFCE7);
const _surface = Color(0xFFF9FAFB);

class OwnerDashboardScreen extends ConsumerStatefulWidget {
  const OwnerDashboardScreen({super.key});

  @override
  ConsumerState<OwnerDashboardScreen> createState() =>
      _OwnerDashboardScreenState();
}

class _OwnerDashboardScreenState extends ConsumerState<OwnerDashboardScreen> {
  // null = all-time
  int? _revenuePeriod = 6;

  @override
  Widget build(BuildContext context) {
    final metricsAsync = ref.watch(dashboardMetricsProvider);
    final user = supabase.auth.currentUser;
    final name = user?.userMetadata?['full_name'] as String? ?? 'Proprietário';
    final initials = name
        .split(' ')
        .take(2)
        .map((w) => w.isNotEmpty ? w[0].toUpperCase() : '')
        .join();
    final now = DateTime.now();
    final months = [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ];
    final monthLabel = '${months[now.month - 1]}/${now.year}';

    return Scaffold(
      backgroundColor: _surface,
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ──────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Olá, ${name.split(' ').first} 👋',
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF6B7280),
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Dashboard',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF111827),
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Avatar + logout
                  PopupMenuButton<String>(
                    position: PopupMenuPosition.under,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    onSelected: (v) async {
                      if (v == 'logout') {
                        await supabase.auth.signOut();
                        if (context.mounted) context.go('/login');
                      }
                    },
                    itemBuilder: (_) => [
                      const PopupMenuItem(
                        value: 'logout',
                        child: Row(
                          children: [
                            Icon(
                              Icons.logout_rounded,
                              size: 18,
                              color: Colors.red,
                            ),
                            SizedBox(width: 8),
                            Text('Sair', style: TextStyle(color: Colors.red)),
                          ],
                        ),
                      ),
                    ],
                    child: CircleAvatar(
                      radius: 20,
                      backgroundColor: _primary,
                      child: Text(
                        initials,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Body ────────────────────────────────────────────────────
            Expanded(
              child: metricsAsync.when(
                loading: () => const Center(
                  child: CircularProgressIndicator(color: _primary),
                ),
                error: (e, _) => Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.error_outline,
                          size: 48,
                          color: Colors.red,
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Não foi possível carregar o painel',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 16,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          e.toString(),
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.grey,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 20),
                        FilledButton.icon(
                          onPressed: () =>
                              ref.invalidate(dashboardMetricsProvider),
                          icon: const Icon(Icons.refresh),
                          label: const Text('Tentar novamente'),
                        ),
                      ],
                    ),
                  ),
                ),
                data: (m) => RefreshIndicator(
                  color: _primary,
                  onRefresh: () async =>
                      ref.invalidate(dashboardMetricsProvider),
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                    children: [
                      // ── Período ───────────────────────────────────────
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: const Color(0xFFE5E7EB),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.calendar_today_outlined,
                                  size: 14,
                                  color: Color(0xFF6B7280),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  monthLabel,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: Color(0xFF374151),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // ── KPI Cards 2x2 ─────────────────────────────────
                      GridView.count(
                        crossAxisCount: 2,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 1.55,
                        children: [
                          _KpiCard(
                            icon: Icons.description_rounded,
                            label: 'Contratos ativos',
                            value: '${m.totalActiveContracts}',
                            subtitle: 'contratos vigentes',
                            iconBg: const Color(0xFFEFF6FF),
                            iconColor: const Color(0xFF3B82F6),
                          ),
                          _KpiCard(
                            icon: Icons.schedule_rounded,
                            label: 'Expirando em 30d',
                            value: '${m.contractsExpiringSoon}',
                            subtitle: m.contractsExpiringSoon > 0
                                ? 'requer atenção'
                                : 'tudo em dia',
                            iconBg: m.contractsExpiringSoon > 0
                                ? const Color(0xFFFFFBEB)
                                : const Color(0xFFF0FDF4),
                            iconColor: m.contractsExpiringSoon > 0
                                ? const Color(0xFFF59E0B)
                                : _primary,
                            subtitleColor: m.contractsExpiringSoon > 0
                                ? const Color(0xFFF59E0B)
                                : _primary,
                          ),
                          _KpiCard(
                            icon: Icons.account_balance_wallet_rounded,
                            label: 'A receber',
                            value: centsToDisplay(m.totalReceivableCents),
                            subtitle: 'este mês',
                            iconBg: const Color(0xFFFFF7ED),
                            iconColor: const Color(0xFFF97316),
                            valueColor: const Color(0xFFF97316),
                          ),
                          _KpiCard(
                            icon: Icons.check_circle_rounded,
                            label: 'Recebido',
                            value: centsToDisplay(m.totalReceivedCents),
                            subtitle: 'este mês',
                            iconBg: _primaryLight,
                            iconColor: _primary,
                            valueColor: _primary,
                            subtitleColor: _primary,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // ── Receita por período ────────────────────────────
                      _RevenuePeriodCard(
                        receivedByPeriod: m.receivedByPeriod,
                        selectedPeriod: _revenuePeriod,
                        onPeriodChanged: (p) =>
                            setState(() => _revenuePeriod = p),
                      ),
                      const SizedBox(height: 24),

                      // ── Vencimentos por dia ────────────────────────────
                      if (m.propertiesByDueDay.isNotEmpty) ...[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'Vencimentos do mês',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF111827),
                              ),
                            ),
                            Text(
                              '${m.propertiesByDueDay.fold(0, (s, g) => s + g.propertyAddresses.length)} imóveis',
                              style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xFF6B7280),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFE5E7EB)),
                          ),
                          child: Column(
                            children: [
                              for (
                                int i = 0;
                                i < m.propertiesByDueDay.length;
                                i++
                              ) ...[
                                if (i > 0) const Divider(height: 1, indent: 16),
                                _DueDayRow(group: m.propertiesByDueDay[i]),
                              ],
                            ],
                          ),
                        ),
                      ] else ...[
                        // Empty state
                        Container(
                          padding: const EdgeInsets.all(32),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFE5E7EB)),
                          ),
                          child: Column(
                            children: [
                              Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  color: _primaryLight,
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: const Icon(
                                  Icons.home_outlined,
                                  color: _primary,
                                  size: 28,
                                ),
                              ),
                              const SizedBox(height: 12),
                              const Text(
                                'Nenhum contrato ativo',
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 15,
                                  color: Color(0xFF374151),
                                ),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                'Cadastre imóveis e contratos\npara ver seu painel.',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Color(0xFF9CA3AF),
                                ),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 16),
                              OutlinedButton.icon(
                                onPressed: () =>
                                    context.go('/owner/properties'),
                                icon: const Icon(Icons.add, size: 16),
                                label: const Text('Adicionar imóvel'),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: _primary,
                                  side: const BorderSide(color: _primary),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────

class _RevenuePeriodCard extends StatelessWidget {
  const _RevenuePeriodCard({
    required this.receivedByPeriod,
    required this.selectedPeriod,
    required this.onPeriodChanged,
  });

  final Map<int?, int> receivedByPeriod;
  final int? selectedPeriod;
  final ValueChanged<int?> onPeriodChanged;

  static const _periods = <int?, String>{
    3: '3m',
    6: '6m',
    12: '12m',
    null: 'Tudo',
  };

  @override
  Widget build(BuildContext context) {
    final amount = receivedByPeriod[selectedPeriod] ?? 0;
    final label = selectedPeriod == null
        ? 'todo o período'
        : 'últimos ${selectedPeriod}m';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: _primaryLight,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.show_chart_rounded,
                      color: _primary,
                      size: 16,
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'Receita recebida',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF374151),
                    ),
                  ),
                ],
              ),
              // Period chips
              Row(
                children: _periods.entries.map((e) {
                  final selected = e.key == selectedPeriod;
                  return GestureDetector(
                    onTap: () => onPeriodChanged(e.key),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      margin: const EdgeInsets.only(left: 4),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: selected ? _primary : const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        e.value,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: selected
                              ? Colors.white
                              : const Color(0xFF6B7280),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            centsToDisplay(amount),
            style: const TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w700,
              color: _primary,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
          ),
        ],
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.iconBg,
    required this.iconColor,
    this.subtitle,
    this.valueColor,
    this.subtitleColor,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color iconBg;
  final Color iconColor;
  final String? subtitle;
  final Color? valueColor;
  final Color? subtitleColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Top row: label + icon
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF9CA3AF),
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: iconColor, size: 16),
              ),
            ],
          ),
          // Value + subtitle
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 20,
                  color: valueColor ?? const Color(0xFF111827),
                  letterSpacing: -0.5,
                  height: 1.1,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 3),
                Row(
                  children: [
                    Icon(
                      Icons.trending_flat_rounded,
                      size: 12,
                      color: subtitleColor ?? const Color(0xFF9CA3AF),
                    ),
                    const SizedBox(width: 3),
                    Text(
                      subtitle!,
                      style: TextStyle(
                        fontSize: 10,
                        color: subtitleColor ?? const Color(0xFF9CA3AF),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _DueDayRow extends StatelessWidget {
  const _DueDayRow({required this.group});
  final _DueDayGroup group;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: _primaryLight,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(
                '${group.dueDay}',
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                  color: _primary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Dia ${group.dueDay}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  group.propertyAddresses.join(' · '),
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF6B7280),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: _primaryLight,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              '${group.propertyAddresses.length} imóvel${group.propertyAddresses.length > 1 ? 'is' : ''}',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: _primary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
