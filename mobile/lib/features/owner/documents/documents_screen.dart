import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/supabase_client.dart';
import '../../../core/models/domain_models.dart';

// ── Providers ─────────────────────────────────────────────────────────────

final contractDocumentsProvider =
    FutureProvider.autoDispose.family<List<SharedDocument>, String>((ref, contractId) async {
  final response = await supabase
      .from('shared_documents')
      .select()
      .eq('contract_id', contractId)
      .order('created_at', ascending: false);
  return (response as List)
      .map((e) => SharedDocument.fromJson(e as Map<String, dynamic>))
      .toList();
});

// ── Screen ────────────────────────────────────────────────────────────────

class DocumentsScreen extends ConsumerStatefulWidget {
  const DocumentsScreen({super.key, required this.contractId});
  final String contractId;

  @override
  ConsumerState<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends ConsumerState<DocumentsScreen> {
  bool _uploading = false;
  static const _docTypes = [
    'Identidade',
    'CPF',
    'Comprovante de Renda',
    'Comprovante de Residência',
    'Contrato',
    'Outros',
  ];
  String _selectedType = 'Outros';

  @override
  Widget build(BuildContext context) {
    final docsAsync = ref.watch(contractDocumentsProvider(widget.contractId));

    return Scaffold(
      appBar: AppBar(title: const Text('Documentos')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Upload section ────────────────────────
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Enviar documento',
                      style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: _selectedType,
                    decoration: const InputDecoration(
                      labelText: 'Tipo de documento',
                      border: OutlineInputBorder(),
                    ),
                    items: _docTypes
                        .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                        .toList(),
                    onChanged: (v) {
                      if (v != null) setState(() => _selectedType = v);
                    },
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: _uploading ? null : () => _pickAndUpload(context),
                    icon: _uploading
                        ? const SizedBox(
                            height: 16,
                            width: 16,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.upload_file_outlined),
                    label: const Text('Selecionar arquivo'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text('Documentos enviados',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          docsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Text('Erro: $e'),
            data: (docs) => docs.isEmpty
                ? const Text('Nenhum documento enviado ainda.',
                    style: TextStyle(color: Colors.grey))
                : Column(
                    children: docs.map((d) => _DocumentTile(
                      doc: d,
                      onDeleted: () =>
                          ref.invalidate(contractDocumentsProvider(widget.contractId)),
                    )).toList(),
                  ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickAndUpload(BuildContext context) async {
    // Use file_picker if available; for now we show a snackbar as placeholder
    // since file_picker is a separate package not yet in pubspec.
    // The upload logic would go here in a full integration.
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text(
            'Para enviar documentos, adicione o package file_picker ao pubspec.yaml.'),
        action: SnackBarAction(label: 'OK', onPressed: () {}),
      ),
    );
  }
}

// ── Document tile ─────────────────────────────────────────────────────────

class _DocumentTile extends ConsumerStatefulWidget {
  const _DocumentTile({required this.doc, required this.onDeleted});
  final SharedDocument doc;
  final VoidCallback onDeleted;

  @override
  ConsumerState<_DocumentTile> createState() => _DocumentTileState();
}

class _DocumentTileState extends ConsumerState<_DocumentTile> {
  bool _busy = false;

  Future<void> _download(BuildContext context) async {
    try {
      final url = await supabase.storage
          .from('shared-documents')
          .createSignedUrl(widget.doc.storagePath, 300);
      if (!context.mounted) return;
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Link do Documento'),
          content: SelectableText(url, style: const TextStyle(fontSize: 12)),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Fechar')),
          ],
        ),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Erro: $e')));
    }
  }

  Future<void> _delete(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Excluir documento'),
        content: Text('Excluir "${widget.doc.fileName}"?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancelar')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    setState(() => _busy = true);
    try {
      await supabase.storage
          .from('shared-documents')
          .remove([widget.doc.storagePath]);
      await supabase
          .from('shared_documents')
          .delete()
          .eq('id', widget.doc.id);
      widget.onDeleted();
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Erro: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const Icon(Icons.insert_drive_file_outlined),
        title: Text(widget.doc.fileName,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 13)),
        subtitle: Text(widget.doc.documentType,
            style: const TextStyle(fontSize: 12, color: Colors.grey)),
        trailing: _busy
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2))
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.download_outlined),
                    tooltip: 'Baixar',
                    onPressed: () => _download(context),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                    tooltip: 'Excluir',
                    onPressed: () => _delete(context),
                  ),
                ],
              ),
      ),
    );
  }
}
