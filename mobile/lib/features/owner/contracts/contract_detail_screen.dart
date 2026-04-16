import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show FunctionException;

import '../../../core/supabase_client.dart';
import '../../../core/models/domain_models.dart';
import '../../../core/models/constants.dart';
import '../../../core/utils/currency.dart';

// ── Providers ─────────────────────────────────────────────────────────────

final contractDetailProvider = FutureProvider.autoDispose
    .family<Contract, String>((ref, id) async {
      final response = await supabase
          .from('contracts')
          .select()
          .eq('id', id)
          .single();
      return Contract.fromJson(response);
    });

final contractInvoicesProvider = FutureProvider.autoDispose
    .family<List<Invoice>, String>((ref, contractId) async {
      final response = await supabase
          .from('invoices')
          .select()
          .eq('contract_id', contractId)
          .neq('status', 'cancelled')
          .order('due_date', ascending: false);
      return (response as List)
          .map((e) => Invoice.fromJson(e as Map<String, dynamic>))
          .toList();
    });

// ── Screen ────────────────────────────────────────────────────────────────

class ContractDetailScreen extends ConsumerWidget {
  const ContractDetailScreen({super.key, required this.contractId});
  final String contractId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contractAsync = ref.watch(contractDetailProvider(contractId));
    final invoicesAsync = ref.watch(contractInvoicesProvider(contractId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Contrato'),
        actions: [
          contractAsync.maybeWhen(
            data: (c) => c.status == ContractStatus.active
                ? IconButton(
                    icon: const Icon(Icons.cancel_outlined),
                    tooltip: 'Rescindir',
                    onPressed: () => _confirmTerminate(context, ref, c),
                  )
                : const SizedBox.shrink(),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: contractAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erro: $e')),
        data: (contract) => _ContractBody(
          contract: contract,
          invoicesAsync: invoicesAsync,
          onDownloadPdf: () => _downloadPdf(context, contract),
          onOpenInspection: () =>
              context.go('/owner/contracts/${contract.id}/inspection'),
          onOpenDocuments: () =>
              context.go('/owner/contracts/${contract.id}/documents'),
        ),
      ),
    );
  }

  Future<void> _downloadPdf(BuildContext context, Contract contract) async {
    if (contract.pdfStoragePath == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('PDF não disponível ainda.')),
      );
      return;
    }

    try {
      final signedUrl = await supabase.storage
          .from('contract-pdfs')
          .createSignedUrl(contract.pdfStoragePath!, 300);

      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('URL do PDF copiada para uso no navegador.'),
          action: SnackBarAction(label: 'OK', onPressed: () {}),
        ),
      );
      // In a full app, launch the URL with url_launcher.
      // For now we show a dialog with the URL.
      showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Link do PDF'),
          content: SelectableText(
            signedUrl,
            style: const TextStyle(fontSize: 12),
          ),
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
      ).showSnackBar(SnackBar(content: Text('Erro ao gerar link: $e')));
    }
  }

  void _confirmTerminate(
    BuildContext context,
    WidgetRef ref,
    Contract contract,
  ) {
    // Pre-calculate penalty using months
    final today = DateTime.now();
    final end = DateTime.parse(contract.endDate);
    final start = DateTime.parse(contract.startDate);
    final totalMonths =
        ((end.year - start.year) * 12 + (end.month - start.month)).clamp(
          1,
          9999,
        );
    final rawRemaining =
        (end.year - today.year) * 12 + (end.month - today.month);
    final remainingMonths = rawRemaining.clamp(0, totalMonths);
    final fineCents =
        (3 * contract.rentAmountCents * remainingMonths / totalMonths).round();

    bool confirmed = false;

    showDialog<void>(
      context: context,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.red, size: 20),
              SizedBox(width: 8),
              Text('Rescindir Contrato'),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Text(
                    'Esta ação não pode ser desfeita. O contrato de ${contract.tenantName} será rescindido e o imóvel voltará a ficar vago.',
                    style: TextStyle(color: Colors.red.shade700, fontSize: 13),
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Multa rescisória',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _CalcRow(
                        label: 'Aluguel mensal',
                        value: centsToDisplay(contract.rentAmountCents),
                      ),
                      _CalcRow(
                        label: 'Meses restantes',
                        value: '$remainingMonths de $totalMonths meses',
                      ),
                      const Divider(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Total da multa',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                          Text(
                            centsToDisplay(fineCents),
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.red,
                              fontSize: 15,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                CheckboxListTile(
                  value: confirmed,
                  onChanged: (v) => setState(() => confirmed = v ?? false),
                  title: const Text(
                    'Confirmo que desejo rescindir este contrato',
                    style: TextStyle(fontSize: 13),
                  ),
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  activeColor: Colors.red,
                ),
              ],
            ),
          ),
          actions: [
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.grey.shade700,
                side: BorderSide(color: Colors.grey.shade400),
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onPressed: () => Navigator.of(dialogCtx).pop(),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.red),
              onPressed: confirmed
                  ? () async {
                      Navigator.of(dialogCtx).pop();
                      await _terminate(context, ref, contract);
                    }
                  : null,
              child: const Text('Confirmar Rescisão'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _terminate(
    BuildContext context,
    WidgetRef ref,
    Contract contract,
  ) async {
    try {
      await supabase.functions.invoke(
        'terminate-contract',
        body: {'contract_id': contract.id},
      );
      ref.invalidate(contractDetailProvider(contractId));
      ref.invalidate(contractInvoicesProvider(contractId));

      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Contrato rescindido com sucesso.')),
      );
      context.pop();
    } on FunctionException catch (e) {
      if (!context.mounted) return;
      String message = 'Erro ao rescindir contrato.';
      final details = e.details;
      if (details is Map && details['error'] != null) {
        message = details['error'].toString();
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: Colors.red),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erro: $e'), backgroundColor: Colors.red),
      );
    }
  }
}

// ── Body ──────────────────────────────────────────────────────────────────

class _ContractBody extends StatelessWidget {
  const _ContractBody({
    required this.contract,
    required this.invoicesAsync,
    required this.onDownloadPdf,
    required this.onOpenInspection,
    required this.onOpenDocuments,
  });

  final Contract contract;
  final AsyncValue<List<Invoice>> invoicesAsync;
  final VoidCallback onDownloadPdf;
  final VoidCallback onOpenInspection;
  final VoidCallback onOpenDocuments;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionCard(
            title: 'Detalhes do Contrato',
            child: Column(
              children: [
                _Row(label: 'Inquilino', value: contract.tenantName),
                _Row(
                  label: 'Aluguel',
                  value: centsToDisplay(contract.rentAmountCents),
                ),
                _Row(
                  label: 'Dia de vencimento',
                  value: 'Dia ${contract.dueDay}',
                ),
                _Row(
                  label: 'Período',
                  value:
                      '${_fmtDate(contract.startDate)} – ${_fmtDate(contract.endDate)}',
                ),
                _Row(
                  label: 'Status',
                  value: contractStatusLabels[contract.status] ?? '',
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (contract.pdfStoragePath != null)
            OutlinedButton.icon(
              onPressed: onDownloadPdf,
              icon: const Icon(Icons.picture_as_pdf_outlined),
              label: const Text('Visualizar PDF'),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onOpenInspection,
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: const Text('Vistorias'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onOpenDocuments,
                  icon: const Icon(Icons.folder_outlined),
                  label: const Text('Documentos'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text('Faturas', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          invoicesAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Text('Erro: $e'),
            data: (invoices) => invoices.isEmpty
                ? const Text(
                    'Nenhuma fatura gerada.',
                    style: TextStyle(color: Colors.grey),
                  )
                : Column(
                    children: invoices
                        .map((inv) => _InvoiceRow(invoice: inv))
                        .toList(),
                  ),
          ),
        ],
      ),
    );
  }

  String _fmtDate(String iso) {
    final parts = iso.split('-');
    if (parts.length < 3) return iso;
    return '${parts[2]}/${parts[1]}/${parts[0]}';
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});
  final String title;
  final Widget child;

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
            child,
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: const TextStyle(color: Colors.grey, fontSize: 13),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(value, style: const TextStyle(fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

class _InvoiceRow extends StatelessWidget {
  const _InvoiceRow({required this.invoice});
  final Invoice invoice;

  @override
  Widget build(BuildContext context) {
    final isPaid = invoice.status == InvoiceStatus.paid;
    final isOverdue = invoice.status == InvoiceStatus.overdue;
    final isCancelled = invoice.status == InvoiceStatus.cancelled;
    final isFine = invoice.invoiceType == InvoiceType.fine;

    return Opacity(
      opacity: isCancelled ? 0.45 : 1.0,
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        title: Row(
          children: [
            Text(
              _fmtDate(invoice.dueDate),
              style: TextStyle(
                fontSize: 13,
                decoration: isCancelled ? TextDecoration.lineThrough : null,
                color: isCancelled ? Colors.grey : null,
              ),
            ),
            if (isFine) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  'Multa',
                  style: TextStyle(
                    fontSize: 10,
                    color: Colors.red.shade700,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ],
        ),
        subtitle: Text(
          '${invoiceTypeLabels[invoice.invoiceType] ?? ''} · ${centsToDisplay(invoice.amountCents)}',
          style: TextStyle(
            fontSize: 12,
            color: isCancelled ? Colors.grey : null,
          ),
        ),
        trailing: Chip(
          label: Text(
            invoiceStatusLabels[invoice.status] ?? '',
            style: const TextStyle(fontSize: 11),
          ),
          backgroundColor: isCancelled
              ? Colors.grey.shade200
              : isPaid
              ? Colors.green.shade100
              : isOverdue
              ? Colors.red.shade100
              : Colors.orange.shade100,
          side: BorderSide.none,
          padding: const EdgeInsets.symmetric(horizontal: 4),
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

class _CalcRow extends StatelessWidget {
  const _CalcRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
