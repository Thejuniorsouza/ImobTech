import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/supabase_client.dart';
import '../../../core/utils/currency.dart';

// ── Provider ─────────────────────────────────────────────────────────────────

final ownerInvoicesProvider = FutureProvider<List<Map<String, dynamic>>>((
  ref,
) async {
  final user = supabase.auth.currentUser;
  if (user == null) return [];
  final data = await supabase
      .from('invoices')
      .select('*, contract:contracts!inner(id, tenant_name, owner_id)')
      .eq('contract.owner_id', user.id)
      .order('due_date', ascending: true);
  return List<Map<String, dynamic>>.from(data as List);
});

// ── Screen ────────────────────────────────────────────────────────────────────

class InvoicesScreen extends ConsumerStatefulWidget {
  const InvoicesScreen({super.key});

  @override
  ConsumerState<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends ConsumerState<InvoicesScreen> {
  static const _primary = Color(0xFF1C6147);
  static const _surface = Color(0xFFF9FAFB);
  static const _border = Color(0xFFE5E7EB);

  String _filter = 'all'; // all | pending | overdue | paid

  // ── Helpers ──────────────────────────────────────────────────────────────

  Color _statusColor(String status) => switch (status) {
    'paid' => const Color(0xFF059669),
    'pending' => const Color(0xFFD97706),
    'overdue' => const Color(0xFFDC2626),
    _ => const Color(0xFF6B7280),
  };

  Color _statusBg(String status) => switch (status) {
    'paid' => const Color(0xFFD1FAE5),
    'pending' => const Color(0xFFFEF3C7),
    'overdue' => const Color(0xFFFEE2E2),
    _ => const Color(0xFFF3F4F6),
  };

  String _statusLabel(String status) => switch (status) {
    'paid' => 'Pago',
    'pending' => 'Pendente',
    'overdue' => 'Em atraso',
    'cancelled' => 'Cancelado',
    _ => status,
  };

  String _typeLabel(String type) => switch (type) {
    'rent' => 'Aluguel',
    'deposit' => 'Caução',
    'iptu' => 'IPTU',
    'condo' => 'Condomínio',
    _ => type,
  };

  bool _isPastDue(Map<String, dynamic> inv) {
    final status = inv['status'] as String;
    if (status == 'paid' || status == 'cancelled') return false;
    final due = DateTime.tryParse(inv['due_date'] as String? ?? '');
    if (due == null) return false;
    final today = DateTime.now();
    return due.isBefore(DateTime(today.year, today.month, today.day));
  }

  List<Map<String, dynamic>> _applyFilter(List<Map<String, dynamic>> list) {
    return switch (_filter) {
      'pending' =>
        list.where((i) => i['status'] == 'pending' && !_isPastDue(i)).toList(),
      'overdue' => list.where(_isPastDue).toList(),
      'paid' => list.where((i) => i['status'] == 'paid').toList(),
      _ => list,
    };
  }

  // ── Mark as paid bottom sheet ─────────────────────────────────────────────

  Future<void> _showMarkPaidSheet(Map<String, dynamic> invoice) async {
    // Default to the invoice's due date so the payment month is correct
    DateTime selectedDate =
        DateTime.tryParse(invoice['due_date'] as String? ?? '') ??
        DateTime.now();

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: _border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const Text(
                  'Confirmar Pagamento',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Informe a data em que o pagamento foi recebido.',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                ),
                const SizedBox(height: 20),

                // Invoice summary
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: _surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _border),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _typeLabel(
                              invoice['invoice_type'] as String? ?? '',
                            ),
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            centsToDisplay(invoice['amount_cents'] as int),
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF111827),
                            ),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text(
                            'Vencimento',
                            style: TextStyle(
                              fontSize: 11,
                              color: Color(0xFF9CA3AF),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _formatDate(invoice['due_date'] as String? ?? ''),
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF374151),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Date picker row
                const Text(
                  'Data do pagamento',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF374151),
                  ),
                ),
                const SizedBox(height: 8),
                InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: selectedDate,
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now(),
                    );
                    if (picked != null) {
                      setSheetState(() => selectedDate = picked);
                    }
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 13,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: _border),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.calendar_today_outlined,
                          size: 16,
                          color: Color(0xFF6B7280),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          _formatDate(
                            selectedDate.toIso8601String().split('T')[0],
                          ),
                          style: const TextStyle(
                            fontSize: 14,
                            color: Color(0xFF111827),
                          ),
                        ),
                        const Spacer(),
                        const Icon(
                          Icons.chevron_right,
                          size: 18,
                          color: Color(0xFF9CA3AF),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Buttons
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: _border),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                        ),
                        child: const Text(
                          'Cancelar',
                          style: TextStyle(color: Color(0xFF374151)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () =>
                            _confirmPayment(ctx, invoice, selectedDate),
                        style: FilledButton.styleFrom(
                          backgroundColor: _primary,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                        ),
                        child: const Text('Confirmar'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _confirmPayment(
    BuildContext sheetCtx,
    Map<String, dynamic> invoice,
    DateTime paidAt,
  ) async {
    try {
      await supabase
          .from('invoices')
          .update({'status': 'paid', 'paid_at': paidAt.toIso8601String()})
          .eq('id', invoice['id'] as String);
      if (mounted) {
        Navigator.pop(sheetCtx);
        ref.invalidate(ownerInvoicesProvider);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Fatura marcada como paga!'),
            backgroundColor: Color(0xFF059669),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  // ── Edit bottom sheet ─────────────────────────────────────────────────────

  Future<void> _showEditSheet(Map<String, dynamic> invoice) async {
    String status = invoice['status'] as String;
    DateTime? paidAt = invoice['paid_at'] != null
        ? DateTime.tryParse(invoice['paid_at'] as String)
        : null;
    paidAt ??= status == 'paid' ? DateTime.now() : null;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: _border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const Text(
                  'Editar Fatura',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 20),

                // Status picker
                const Text(
                  'Status',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF374151),
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _border),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: status,
                      isExpanded: true,
                      items: const [
                        DropdownMenuItem(
                          value: 'pending',
                          child: Text('Pendente'),
                        ),
                        DropdownMenuItem(value: 'paid', child: Text('Pago')),
                        DropdownMenuItem(
                          value: 'overdue',
                          child: Text('Em atraso'),
                        ),
                        DropdownMenuItem(
                          value: 'cancelled',
                          child: Text('Cancelado'),
                        ),
                      ],
                      onChanged: (v) {
                        if (v == null) return;
                        setSheetState(() {
                          status = v;
                          if (v == 'paid') {
                            paidAt ??= DateTime.now();
                          } else {
                            paidAt = null;
                          }
                        });
                      },
                    ),
                  ),
                ),

                // paid_at date picker (shown when status == paid)
                if (status == 'paid') ...[
                  const SizedBox(height: 16),
                  const Text(
                    'Data do pagamento',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF374151),
                    ),
                  ),
                  const SizedBox(height: 8),
                  InkWell(
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: ctx,
                        initialDate: paidAt ?? DateTime.now(),
                        firstDate: DateTime(2020),
                        lastDate: DateTime(2100),
                        locale: const Locale('pt', 'BR'),
                      );
                      if (picked != null) {
                        setSheetState(() => paidAt = picked);
                      }
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 13,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: _border),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.calendar_today_outlined,
                            size: 16,
                            color: Color(0xFF6B7280),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            paidAt != null
                                ? _formatDate(
                                    paidAt!.toIso8601String().split('T')[0],
                                  )
                                : 'Selecionar data',
                            style: TextStyle(
                              fontSize: 14,
                              color: paidAt != null
                                  ? const Color(0xFF111827)
                                  : Colors.grey.shade400,
                            ),
                          ),
                          const Spacer(),
                          const Icon(
                            Icons.chevron_right,
                            size: 18,
                            color: Color(0xFF9CA3AF),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],

                const SizedBox(height: 24),

                // Buttons
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: _border),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                        ),
                        child: const Text(
                          'Cancelar',
                          style: TextStyle(color: Color(0xFF374151)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () =>
                            _saveEdit(ctx, invoice, status, paidAt),
                        style: FilledButton.styleFrom(
                          backgroundColor: _primary,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                        ),
                        child: const Text('Salvar'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _saveEdit(
    BuildContext sheetCtx,
    Map<String, dynamic> invoice,
    String status,
    DateTime? paidAt,
  ) async {
    try {
      await supabase
          .from('invoices')
          .update({
            'status': status,
            'paid_at': status == 'paid'
                ? (paidAt ?? DateTime.now()).toIso8601String()
                : null,
          })
          .eq('id', invoice['id'] as String);
      if (mounted) {
        Navigator.pop(sheetCtx);
        ref.invalidate(ownerInvoicesProvider);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Fatura atualizada!'),
            backgroundColor: Color(0xFF1C6147),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  // ── Date formatter ────────────────────────────────────────────────────────

  String _formatDate(String iso) {
    try {
      final d = DateTime.parse(iso);
      return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
    } catch (_) {
      return iso;
    }
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final asyncInvoices = ref.watch(ownerInvoicesProvider);

    return Scaffold(
      backgroundColor: _surface,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Faturas',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF111827),
          ),
        ),
        centerTitle: false,
        actions: [
          IconButton(
            icon: const Icon(
              Icons.refresh_outlined,
              color: Color(0xFF6B7280),
              size: 20,
            ),
            onPressed: () => ref.refresh(ownerInvoicesProvider),
          ),
        ],
      ),
      body: asyncInvoices.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: _primary)),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline,
                size: 40,
                color: Color(0xFFDC2626),
              ),
              const SizedBox(height: 12),
              Text(
                'Erro ao carregar faturas',
                style: TextStyle(color: Colors.grey.shade600),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => ref.refresh(ownerInvoicesProvider),
                child: const Text('Tentar novamente'),
              ),
            ],
          ),
        ),
        data: (allInvoices) {
          final invoices = _applyFilter(allInvoices);
          final pendingCount = allInvoices
              .where((i) => i['status'] == 'pending' && !_isPastDue(i))
              .length;
          final overdueCount = allInvoices.where(_isPastDue).length;
          final paidCount = allInvoices
              .where((i) => i['status'] == 'paid')
              .length;

          return Column(
            children: [
              // ── Summary strip ─────────────────────────────────────────
              Container(
                color: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                child: Row(
                  children: [
                    _SummaryChip(
                      label: 'Total',
                      value: '${allInvoices.length}',
                      color: const Color(0xFF1C6147),
                    ),
                    const SizedBox(width: 8),
                    _SummaryChip(
                      label: 'Pendentes',
                      value: '$pendingCount',
                      color: const Color(0xFFD97706),
                    ),
                    const SizedBox(width: 8),
                    _SummaryChip(
                      label: 'Em atraso',
                      value: '$overdueCount',
                      color: const Color(0xFFDC2626),
                    ),
                    const SizedBox(width: 8),
                    _SummaryChip(
                      label: 'Pagas',
                      value: '$paidCount',
                      color: const Color(0xFF059669),
                    ),
                  ],
                ),
              ),

              // ── Filter chips ──────────────────────────────────────────
              Container(
                color: Colors.white,
                padding: const EdgeInsets.only(left: 16, right: 16, bottom: 12),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _FilterChip(
                        label: 'Todas',
                        selected: _filter == 'all',
                        onTap: () => setState(() => _filter = 'all'),
                      ),
                      const SizedBox(width: 8),
                      _FilterChip(
                        label: 'Pendentes',
                        selected: _filter == 'pending',
                        onTap: () => setState(() => _filter = 'pending'),
                      ),
                      const SizedBox(width: 8),
                      _FilterChip(
                        label: 'Em atraso',
                        selected: _filter == 'overdue',
                        activeColor: const Color(0xFFDC2626),
                        onTap: () => setState(() => _filter = 'overdue'),
                        badge: overdueCount > 0 ? '$overdueCount' : null,
                      ),
                      const SizedBox(width: 8),
                      _FilterChip(
                        label: 'Pagas',
                        selected: _filter == 'paid',
                        onTap: () => setState(() => _filter = 'paid'),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 8),

              // ── List ──────────────────────────────────────────────────
              Expanded(
                child: invoices.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.receipt_long_outlined,
                              size: 48,
                              color: Colors.grey.shade300,
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'Nenhuma fatura encontrada',
                              style: TextStyle(
                                fontSize: 15,
                                color: Colors.grey.shade500,
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 4,
                        ),
                        itemCount: invoices.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) {
                          final inv = invoices[i];
                          final status = inv['status'] as String;
                          final isPast = _isPastDue(inv);
                          final tenantName =
                              (inv['contract'] as Map?)?['tenant_name']
                                  as String? ??
                              '—';
                          final paidAt = inv['paid_at'] != null
                              ? DateTime.tryParse(inv['paid_at'] as String)
                              : null;

                          return Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: isPast
                                    ? const Color(0xFFFCA5A5)
                                    : _border,
                              ),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Row 1: tenant + amount
                                  Row(
                                    children: [
                                      // Avatar
                                      Container(
                                        width: 36,
                                        height: 36,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFDCFCE7),
                                          borderRadius: BorderRadius.circular(
                                            18,
                                          ),
                                        ),
                                        alignment: Alignment.center,
                                        child: Text(
                                          tenantName.isNotEmpty
                                              ? tenantName[0].toUpperCase()
                                              : '?',
                                          style: const TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w700,
                                            color: Color(0xFF1C6147),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              tenantName,
                                              style: const TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w600,
                                                color: Color(0xFF111827),
                                              ),
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            Text(
                                              _typeLabel(
                                                inv['invoice_type']
                                                        as String? ??
                                                    '',
                                              ),
                                              style: const TextStyle(
                                                fontSize: 11,
                                                color: Color(0xFF9CA3AF),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Text(
                                        centsToDisplay(
                                          inv['amount_cents'] as int,
                                        ),
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF111827),
                                        ),
                                      ),
                                    ],
                                  ),

                                  const SizedBox(height: 10),
                                  const Divider(height: 1),
                                  const SizedBox(height: 10),

                                  // Row 2: due date + status + actions
                                  Row(
                                    children: [
                                      // Due date
                                      Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'Vencimento',
                                            style: TextStyle(
                                              fontSize: 10,
                                              color: Color(0xFF9CA3AF),
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            _formatDate(
                                              inv['due_date'] as String? ?? '',
                                            ),
                                            style: TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w500,
                                              color: isPast
                                                  ? const Color(0xFFDC2626)
                                                  : const Color(0xFF374151),
                                            ),
                                          ),
                                          if (paidAt != null) ...[
                                            const SizedBox(height: 2),
                                            Text(
                                              'Pago em: ${_formatDate(paidAt.toIso8601String().split('T')[0])}',
                                              style: const TextStyle(
                                                fontSize: 10,
                                                color: Color(0xFF059669),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),

                                      const SizedBox(width: 12),

                                      // Status badge
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          color: _statusBg(status),
                                          borderRadius: BorderRadius.circular(
                                            8,
                                          ),
                                        ),
                                        child: Text(
                                          _statusLabel(status),
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: _statusColor(status),
                                          ),
                                        ),
                                      ),

                                      if (isPast) ...[
                                        const SizedBox(width: 6),
                                        const Icon(
                                          Icons.warning_amber_rounded,
                                          size: 14,
                                          color: Color(0xFFDC2626),
                                        ),
                                      ],

                                      const Spacer(),

                                      // Action buttons
                                      if (status == 'pending' ||
                                          status == 'overdue')
                                        TextButton(
                                          onPressed: () =>
                                              _showMarkPaidSheet(inv),
                                          style: TextButton.styleFrom(
                                            backgroundColor: const Color(
                                              0xFF1C6147,
                                            ),
                                            foregroundColor: Colors.white,
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 10,
                                              vertical: 6,
                                            ),
                                            minimumSize: Size.zero,
                                            tapTargetSize: MaterialTapTargetSize
                                                .shrinkWrap,
                                            shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                            ),
                                          ),
                                          child: const Text(
                                            'Marcar pago',
                                            style: TextStyle(fontSize: 11),
                                          ),
                                        ),

                                      const SizedBox(width: 6),

                                      // Edit button (always shown)
                                      GestureDetector(
                                        onTap: () => _showEditSheet(inv),
                                        child: Container(
                                          width: 30,
                                          height: 30,
                                          decoration: BoxDecoration(
                                            color: _surface,
                                            borderRadius: BorderRadius.circular(
                                              8,
                                            ),
                                            border: Border.all(color: _border),
                                          ),
                                          child: const Icon(
                                            Icons.edit_outlined,
                                            size: 14,
                                            color: Color(0xFF6B7280),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ── Helper widgets ────────────────────────────────────────────────────────────

class _SummaryChip extends StatelessWidget {
  const _SummaryChip({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(fontSize: 9, color: Color(0xFF6B7280)),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.activeColor = const Color(0xFF1C6147),
    this.badge,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Color activeColor;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? activeColor : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? activeColor : const Color(0xFFE5E7EB),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: selected ? Colors.white : const Color(0xFF374151),
              ),
            ),
            if (badge != null) ...[
              const SizedBox(width: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: selected
                      ? Colors.white.withOpacity(0.3)
                      : activeColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  badge!,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: selected ? Colors.white : activeColor,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
