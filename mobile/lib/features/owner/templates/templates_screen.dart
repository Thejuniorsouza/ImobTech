import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/supabase_client.dart';
import '../../../core/models/domain_models.dart';

// ── Provider ──────────────────────────────────────────────────────────────

final templatesProvider = FutureProvider.autoDispose<List<ContractTemplate>>((
  ref,
) async {
  final user = supabase.auth.currentUser;
  if (user == null) return [];

  final response = await supabase
      .from('contract_templates')
      .select('id, owner_id, title, is_system, created_at')
      .or('is_system.eq.true,owner_id.eq.${user.id}')
      .order('is_system', ascending: false)
      .order('created_at', ascending: false);

  return (response as List)
      .map((e) => ContractTemplate.fromJson(e as Map<String, dynamic>))
      .toList();
});

// ── Screen ────────────────────────────────────────────────────────────────

class TemplatesScreen extends ConsumerStatefulWidget {
  const TemplatesScreen({super.key});

  @override
  ConsumerState<TemplatesScreen> createState() => _TemplatesScreenState();
}

class _TemplatesScreenState extends ConsumerState<TemplatesScreen> {
  // ignore: unused_field
  String? _expandedId;

  @override
  Widget build(BuildContext context) {
    final templatesAsync = ref.watch(templatesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Modelos de Contrato'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'Novo modelo',
            onPressed: () => _showCreateDialog(context),
          ),
        ],
      ),
      body: templatesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erro: $e')),
        data: (templates) {
          if (templates.isEmpty) {
            return const Center(
              child: Text(
                'Nenhum modelo disponível.',
                style: TextStyle(color: Colors.grey),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(templatesProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: templates.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (ctx, i) {
                final t = templates[i];
                final isOwn =
                    !t.isSystem && t.ownerId == supabase.auth.currentUser?.id;

                return Card(
                  child: Column(
                    children: [
                      ListTile(
                        leading: Icon(
                          t.isSystem
                              ? Icons.star_outlined
                              : Icons.description_outlined,
                          color: t.isSystem
                              ? Colors.amber.shade700
                              : Theme.of(context).colorScheme.primary,
                        ),
                        title: Text(
                          t.title,
                          style: const TextStyle(fontSize: 14),
                        ),
                        subtitle: Text(
                          t.isSystem ? 'Modelo do sistema' : 'Meu modelo',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.grey,
                          ),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (isOwn)
                              IconButton(
                                icon: const Icon(
                                  Icons.delete_outline,
                                  color: Colors.red,
                                  size: 20,
                                ),
                                tooltip: 'Excluir',
                                onPressed: () => _confirmDelete(context, t),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }

  Future<void> _showCreateDialog(BuildContext context) async {
    final titleCtrl = TextEditingController();
    final bodyCtrl = TextEditingController();

    final created = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Novo Modelo'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleCtrl,
                decoration: const InputDecoration(
                  labelText: 'Título',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: bodyCtrl,
                maxLines: 8,
                decoration: const InputDecoration(
                  labelText: 'Corpo do modelo',
                  hintText:
                      'Use {{TENANT_NAME}}, {{RENT_AMOUNT}}, {{START_DATE}}…',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () async {
              if (titleCtrl.text.trim().isEmpty || bodyCtrl.text.trim().isEmpty) {
                return;
              }
              try {
                await supabase.from('contract_templates').insert({
                  'title': titleCtrl.text.trim(),
                  'body': bodyCtrl.text.trim(),
                  'owner_id': supabase.auth.currentUser!.id,
                  'is_system': false,
                });
                if (context.mounted) Navigator.of(context).pop(true);
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(SnackBar(content: Text('Erro: $e')));
                }
              }
            },
            child: const Text('Criar'),
          ),
        ],
      ),
    );

    if (created == true) ref.invalidate(templatesProvider);
  }

  Future<void> _confirmDelete(BuildContext context, ContractTemplate t) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Excluir modelo'),
        content: Text('Excluir "${t.title}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    try {
      await supabase.from('contract_templates').delete().eq('id', t.id);
      ref.invalidate(templatesProvider);
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Erro: $e')));
    }
  }
}
