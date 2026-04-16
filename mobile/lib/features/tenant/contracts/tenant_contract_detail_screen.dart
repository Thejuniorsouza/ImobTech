import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/supabase_client.dart';
import '../../../core/models/domain_models.dart';
import '../../../core/models/constants.dart';
import '../../../core/utils/currency.dart';

// ── Providers ─────────────────────────────────────────────────────────────

final tenantContractDetailProvider = FutureProvider.autoDispose
    .family<Contract, String>((ref, id) async {
      final response = await supabase
          .from('contracts')
          .select()
          .eq('id', id)
          .single();
      return Contract.fromJson(response);
    });

final tenantContractInvoicesProvider = FutureProvider.autoDispose
    .family<List<Invoice>, String>((ref, contractId) async {
      final response = await supabase
          .from('invoices')
          .select()
          .eq('contract_id', contractId)
          .order('due_date', ascending: false);
      return (response as List)
          .map((e) => Invoice.fromJson(e as Map<String, dynamic>))
          .toList();
    });

// ── Screen ────────────────────────────────────────────────────────────────

class TenantContractDetailScreen extends ConsumerWidget {
  const TenantContractDetailScreen({super.key, required this.contractId});
  final String contractId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contractAsync = ref.watch(tenantContractDetailProvider(contractId));
    final invoicesAsync = ref.watch(tenantContractInvoicesProvider(contractId));

    return Scaffold(
      appBar: AppBar(title: const Text('Detalhes do Contrato')),
      body: contractAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erro: $e')),
        data: (contract) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Contract info ──────────────────────
              _InfoCard(
                title: 'Dados do Contrato',
                rows: [
                  _InfoRow('Aluguel', centsToDisplay(contract.rentAmountCents)),
                  _InfoRow(
                    'Caução',
                    centsToDisplay(contract.depositAmountCents),
                  ),
                  _InfoRow('Dia de vencimento', 'Dia ${contract.dueDay}'),
                  _InfoRow(
                    'Período',
                    '${_fmtDate(contract.startDate)} – ${_fmtDate(contract.endDate)}',
                  ),
                  _InfoRow(
                    'Status',
                    contractStatusLabels[contract.status] ?? '',
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // ── PDF link ───────────────────────────
              if (contract.pdfStoragePath != null)
                OutlinedButton.icon(
                  onPressed: () => _showPdf(context, contract.pdfStoragePath!),
                  icon: const Icon(Icons.picture_as_pdf_outlined),
                  label: const Text('Visualizar Contrato (PDF)'),
                ),
              const SizedBox(height: 24),

              // ── Invoices ───────────────────────────
              Text('Faturas', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              invoicesAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Text('Erro: $e'),
                data: (invoices) => invoices.isEmpty
                    ? const Text(
                        'Nenhuma fatura.',
                        style: TextStyle(color: Colors.grey),
                      )
                    : Column(
                        children: invoices
                            .map((inv) => _InvoiceTile(invoice: inv))
                            .toList(),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showPdf(BuildContext context, String path) async {
    try {
      final url = await supabase.storage
          .from('contract-pdfs')
          .createSignedUrl(path, 300);
      if (!context.mounted) return;
      showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Link do PDF do Contrato'),
          content: SelectableText(url, style: const TextStyle(fontSize: 12)),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Fechar'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Erro: $e')));
    }
  }

  String _fmtDate(String iso) {
    final parts = iso.split('-');
    if (parts.length < 3) return iso;
    return '${parts[2]}/${parts[1]}/${parts[0]}';
  }
}

// ── Shared sub-widgets ────────────────────────────────────────────────────

class _InfoRow {
  const _InfoRow(this.label, this.value);
  final String label;
  final String value;
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.title, required this.rows});
  final String title;
  final List<_InfoRow> rows;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleSmall),
            const Divider(height: 16),
            ...rows.map(
              (r) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: Text(
                        r.label,
                        style: const TextStyle(
                          color: Colors.grey,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    Expanded(
                      flex: 3,
                      child: Text(
                        r.value,
                        style: const TextStyle(fontSize: 13),
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

class _InvoiceTile extends StatelessWidget {
  const _InvoiceTile({required this.invoice});
  final Invoice invoice;

  @override
  Widget build(BuildContext context) {
    final isPaid = invoice.status == InvoiceStatus.paid;
    final isOverdue = invoice.status == InvoiceStatus.overdue;

    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(
        _fmtDate(invoice.dueDate),
        style: const TextStyle(fontSize: 13),
      ),
      subtitle: Text(centsToDisplay(invoice.amountCents)),
      trailing: Chip(
        label: Text(
          invoiceStatusLabels[invoice.status] ?? '',
          style: const TextStyle(fontSize: 11),
        ),
        backgroundColor: isPaid
            ? Colors.green.shade100
            : isOverdue
            ? Colors.red.shade100
            : Colors.orange.shade100,
        side: BorderSide.none,
        padding: const EdgeInsets.symmetric(horizontal: 4),
      ),
    );
  }

  String _fmtDate(String iso) {
    final parts = iso.split('-');
    if (parts.length < 3) return iso;
    return '${parts[2]}/${parts[1]}/${parts[0]}';
  }
}
