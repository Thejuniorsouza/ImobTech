import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/supabase_client.dart';

// ── Provider ──────────────────────────────────────────────────────────────

final adGeneratorProvider = FutureProvider.autoDispose
    .family<Map<String, String>, String>((ref, propertyId) async {
      final response = await supabase.functions.invoke(
        'generate-ad',
        body: {'property_id': propertyId},
      );
      final data = response.data as Map<String, dynamic>;
      return {
        'olx': data['olx'] as String? ?? '',
        'zap': data['zap'] as String? ?? '',
        'vivareal': data['vivareal'] as String? ?? '',
      };
    });

// ── Screen ────────────────────────────────────────────────────────────────

class AdGeneratorScreen extends ConsumerStatefulWidget {
  const AdGeneratorScreen({super.key, required this.propertyId});
  final String propertyId;

  @override
  ConsumerState<AdGeneratorScreen> createState() => _AdGeneratorScreenState();
}

class _AdGeneratorScreenState extends ConsumerState<AdGeneratorScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  static const _platforms = ['OLX', 'ZAP Imóveis', 'Viva Real'];
  static const _keys = ['olx', 'zap', 'vivareal'];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: _platforms.length, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final adAsync = ref.watch(adGeneratorProvider(widget.propertyId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Gerar Anúncio'),
        bottom: TabBar(
          controller: _tabs,
          tabs: _platforms.map((p) => Tab(text: p)).toList(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Gerar novamente',
            onPressed: () =>
                ref.invalidate(adGeneratorProvider(widget.propertyId)),
          ),
        ],
      ),
      body: adAsync.when(
        loading: () => const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 12),
              Text(
                'Gerando anúncios com IA…',
                style: TextStyle(color: Colors.grey),
              ),
            ],
          ),
        ),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 8),
              Text('Erro: $e', textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () =>
                    ref.invalidate(adGeneratorProvider(widget.propertyId)),
                child: const Text('Tentar novamente'),
              ),
            ],
          ),
        ),
        data: (ads) => TabBarView(
          controller: _tabs,
          children: List.generate(
            _platforms.length,
            (i) => _AdTab(platform: _platforms[i], text: ads[_keys[i]] ?? ''),
          ),
        ),
      ),
    );
  }
}

// ── Tab ───────────────────────────────────────────────────────────────────

class _AdTab extends StatefulWidget {
  const _AdTab({required this.platform, required this.text});
  final String platform;
  final String text;

  @override
  State<_AdTab> createState() => _AdTabState();
}

class _AdTabState extends State<_AdTab> {
  late final TextEditingController _ctrl;
  bool _copied = false;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.text);
  }

  @override
  void didUpdateWidget(_AdTab old) {
    super.didUpdateWidget(old);
    if (old.text != widget.text) {
      _ctrl.text = widget.text;
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: _ctrl.text));
    setState(() => _copied = true);
    await Future<void>.delayed(const Duration(seconds: 2));
    if (mounted) setState(() => _copied = false);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.platform, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Expanded(
            child: TextField(
              controller: _ctrl,
              maxLines: null,
              expands: true,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'Texto do anúncio…',
                alignLabelWithHint: true,
              ),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _copy,
            icon: Icon(_copied ? Icons.check : Icons.copy),
            label: Text(_copied ? 'Copiado!' : 'Copiar texto'),
          ),
        ],
      ),
    );
  }
}
