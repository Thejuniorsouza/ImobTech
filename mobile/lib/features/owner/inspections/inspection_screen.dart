import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/supabase_client.dart';
import '../../../core/models/domain_models.dart';

// ── Providers ─────────────────────────────────────────────────────────────

final inspectionsProvider = FutureProvider.autoDispose
    .family<List<Inspection>, String>((ref, contractId) async {
      final response = await supabase
          .from('inspections')
          .select()
          .eq('contract_id', contractId)
          .order('created_at', ascending: false);
      return (response as List)
          .map((e) => Inspection.fromJson(e as Map<String, dynamic>))
          .toList();
    });

final inspectionPhotosProvider = FutureProvider.autoDispose
    .family<List<InspectionPhoto>, String>((ref, inspectionId) async {
      final response = await supabase
          .from('inspection_photos')
          .select()
          .eq('inspection_id', inspectionId)
          .order('room_name');
      return (response as List)
          .map((e) => InspectionPhoto.fromJson(e as Map<String, dynamic>))
          .toList();
    });

// ── Screen ────────────────────────────────────────────────────────────────

class InspectionScreen extends ConsumerStatefulWidget {
  const InspectionScreen({super.key, required this.contractId});
  final String contractId;

  @override
  ConsumerState<InspectionScreen> createState() => _InspectionScreenState();
}

class _InspectionScreenState extends ConsumerState<InspectionScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final inspectionsAsync = ref.watch(inspectionsProvider(widget.contractId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Vistorias'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Entrada'),
            Tab(text: 'Saída'),
          ],
        ),
      ),
      body: inspectionsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erro: $e')),
        data: (inspections) {
          final entry = inspections
              .where((i) => i.type == InspectionType.entry)
              .toList();
          final exit = inspections
              .where((i) => i.type == InspectionType.exit)
              .toList();

          return TabBarView(
            controller: _tabs,
            children: [
              _InspectionTab(
                contractId: widget.contractId,
                type: InspectionType.entry,
                inspections: entry,
                onCreated: () =>
                    ref.invalidate(inspectionsProvider(widget.contractId)),
              ),
              _InspectionTab(
                contractId: widget.contractId,
                type: InspectionType.exit,
                inspections: exit,
                onCreated: () =>
                    ref.invalidate(inspectionsProvider(widget.contractId)),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ── Tab ───────────────────────────────────────────────────────────────────

class _InspectionTab extends ConsumerStatefulWidget {
  const _InspectionTab({
    required this.contractId,
    required this.type,
    required this.inspections,
    required this.onCreated,
  });

  final String contractId;
  final InspectionType type;
  final List<Inspection> inspections;
  final VoidCallback onCreated;

  @override
  ConsumerState<_InspectionTab> createState() => _InspectionTabState();
}

class _InspectionTabState extends ConsumerState<_InspectionTab> {
  bool _creating = false;
  final _descCtrl = TextEditingController();

  @override
  void dispose() {
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    if (_descCtrl.text.trim().isEmpty) return;
    setState(() => _creating = true);
    try {
      await supabase.from('inspections').insert({
        'contract_id': widget.contractId,
        'type': widget.type.name,
        'description': _descCtrl.text.trim(),
      });
      _descCtrl.clear();
      widget.onCreated();
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Create form
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Nova vistoria',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _descCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    hintText: 'Descrição geral da vistoria…',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: _creating ? null : _create,
                  child: _creating
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Registrar vistoria'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        if (widget.inspections.isEmpty)
          const Center(
            child: Text(
              'Nenhuma vistoria registrada.',
              style: TextStyle(color: Colors.grey),
            ),
          ),
        ...widget.inspections.map(
          (i) => _InspectionCard(inspection: i, onPhotoAdded: widget.onCreated),
        ),
      ],
    );
  }
}

class _InspectionCard extends ConsumerWidget {
  const _InspectionCard({required this.inspection, required this.onPhotoAdded});
  final Inspection inspection;
  final VoidCallback onPhotoAdded;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final photosAsync = ref.watch(inspectionPhotosProvider(inspection.id));

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              inspection.description ?? '',
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 8),
            // Upload button
            OutlinedButton.icon(
              onPressed: () => _pickAndUpload(context, ref),
              icon: const Icon(Icons.add_a_photo_outlined),
              label: const Text('Adicionar foto'),
            ),
            const SizedBox(height: 8),
            photosAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text('Erro: $e'),
              data: (photos) => photos.isEmpty
                  ? const Text(
                      'Sem fotos ainda.',
                      style: TextStyle(color: Colors.grey, fontSize: 12),
                    )
                  : _PhotoGrid(photos: photos),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickAndUpload(BuildContext context, WidgetRef ref) async {
    final picker = ImagePicker();
    final xFile = await picker.pickImage(source: ImageSource.gallery);
    if (xFile == null) return;

    try {
      final bytes = await xFile.readAsBytes();
      final path = 'inspections/${inspection.id}/${xFile.name}';
      await supabase.storage
          .from('inspection-photos')
          .uploadBinary(path, bytes, fileOptions: FileOptions(upsert: true));

      await supabase.from('inspection_photos').insert({
        'inspection_id': inspection.id,
        'storage_path': path,
        'room_name': 'Geral',
        'description': xFile.name,
      });

      ref.invalidate(inspectionPhotosProvider(inspection.id));
      onPhotoAdded();
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Erro ao enviar foto: $e')));
    }
  }
}

class _PhotoGrid extends StatelessWidget {
  const _PhotoGrid({required this.photos});
  final List<InspectionPhoto> photos;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 6,
        mainAxisSpacing: 6,
      ),
      itemCount: photos.length,
      itemBuilder: (_, i) => _PhotoTile(photo: photos[i]),
    );
  }
}

class _PhotoTile extends StatefulWidget {
  const _PhotoTile({required this.photo});
  final InspectionPhoto photo;

  @override
  State<_PhotoTile> createState() => _PhotoTileState();
}

class _PhotoTileState extends State<_PhotoTile> {
  String? _url;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final url = await supabase.storage
          .from('inspection-photos')
          .createSignedUrl(widget.photo.storagePath, 600);
      if (mounted) setState(() => _url = url);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_url == null) {
      return Container(
        decoration: BoxDecoration(
          color: Colors.grey.shade200,
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Icon(Icons.image_outlined, color: Colors.grey),
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Image.network(_url!, fit: BoxFit.cover),
    );
  }
}
