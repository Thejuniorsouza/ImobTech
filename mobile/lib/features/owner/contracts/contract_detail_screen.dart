import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/supabase_client.dart';
import '../../../core/models/domain_models.dart';
import '../../../core/models/constants.dart';
import '../../../core/utils/currency.dart';

// ── Providers ─────────────────────────────────────────────────────────────

final contractDetailProvider =
    FutureProvider.autoDispose.family<Contract, String>((ref, id) async {
  final response = await supabase
      .from('contracts')
      .select()
      .eq('id', id)
      .single();
  return Contract.fromJson(response as Map<String, dynamic>);
});

final contractInvoicesProvider =
    FutureProvider.autoDispose.family<List<Invoice>, String>((ref, contractId) async {
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
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Link do PDF'),
          content: SelectableText(signedUrl, style: const TextStyle(fontSize: 12)),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Fechar'))
          ],
        ),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erro ao gerar link: $e')),
      );
    }
  }

  void _confirmTerminate(BuildContext context, WidgetRef ref, Contract contract) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Rescindir Contrato'),
        content: const Text(
          'Deseja rescindir este contrato? Faturas pendentes futuras serão excluídas.',
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancelar')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () async {
              Navigator.of(context).pop();
              await _terminate(context, ref, contract);
            },
            child: const Text('Rescindir'),
          ),
        ],
      ),
    );
  }

  Future<void> _terminate(BuildContext context, WidgetRef ref, Contract contract) async {
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
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erro: $e')),
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
                _Row(label: 'Aluguel', value: centsToDisplay(contract.rentAmountCents)),
                _Row(label: 'Dia de vencimento', value: 'Dia ${contract.dueDay}'),
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
                ? const Text('Nenhuma fatura gerada.',
                    style: TextStyle(color: Colors.grey))
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
            child: Text(label, style: const TextStyle(color: Colors.grey, fontSize: 13)),
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
