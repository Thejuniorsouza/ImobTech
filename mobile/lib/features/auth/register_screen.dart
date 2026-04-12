import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase_client.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _cpfCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  String _role = 'owner';
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _cpfCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  bool _isValidCpf(String cpf) {
    if (cpf.length != 11) return false;
    if (RegExp(r'^(\d)\1{10}$').hasMatch(cpf)) return false;

    int calcDigit(String digits, int factor) {
      int sum = 0;
      for (final d in digits.split('')) {
        sum += int.parse(d) * factor--;
      }
      final remainder = (sum * 10) % 11;
      return remainder >= 10 ? 0 : remainder;
    }

    final first = calcDigit(cpf.substring(0, 9), 10);
    if (first != int.parse(cpf[9])) return false;
    final second = calcDigit(cpf.substring(0, 10), 11);
    return second == int.parse(cpf[10]);
  }

  Future<void> _register() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });

    try {
      final response = await supabase.auth.signUp(
        email: _emailCtrl.text.trim(),
        password: _passwordCtrl.text,
        data: {
          'full_name': _nameCtrl.text.trim(),
          'cpf': _cpfCtrl.text.trim(),
          'role': _role,
        },
      );

      if (!mounted) return;

      if (response.user != null && response.session == null) {
        // Email confirmation required
        _showVerificationDialog();
      } else if (response.user != null) {
        context.go(_role == 'owner' ? '/owner/dashboard' : '/tenant/dashboard');
      }
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Erro ao criar conta. Tente novamente.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showVerificationDialog() {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirme seu e-mail'),
        content: const Text(
          'Enviamos um link de confirmação para o seu e-mail. Acesse-o antes de entrar.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              context.go('/login');
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Criar conta')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Text(
                      _error!,
                      style: TextStyle(color: Colors.red.shade700, fontSize: 13),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                TextFormField(
                  controller: _nameCtrl,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(labelText: 'Nome completo', border: OutlineInputBorder()),
                  validator: (v) => (v == null || v.length < 2) ? 'Nome deve ter pelo menos 2 caracteres.' : null,
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(labelText: 'E-mail', border: OutlineInputBorder()),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Informe o e-mail.';
                    if (!v.contains('@')) return 'E-mail inválido.';
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _cpfCtrl,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'CPF (somente números)',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Informe o CPF.';
                    if (!_isValidCpf(v.replaceAll(RegExp(r'\D'), ''))) return 'CPF inválido.';
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _passwordCtrl,
                  obscureText: true,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _register(),
                  decoration: const InputDecoration(labelText: 'Senha (mín. 8 caracteres)', border: OutlineInputBorder()),
                  validator: (v) => (v == null || v.length < 8) ? 'Mínimo 8 caracteres.' : null,
                ),
                const SizedBox(height: 16),

                // Role selector
                const Text('Perfil', style: TextStyle(fontWeight: FontWeight.w500)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: RadioListTile<String>(
                        title: const Text('Proprietário'),
                        value: 'owner',
                        groupValue: _role,
                        onChanged: (v) => setState(() => _role = v!),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                    Expanded(
                      child: RadioListTile<String>(
                        title: const Text('Inquilino'),
                        value: 'tenant',
                        groupValue: _role,
                        onChanged: (v) => setState(() => _role = v!),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                FilledButton(
                  onPressed: _loading ? null : _register,
                  child: _loading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Criar conta'),
                ),
                const SizedBox(height: 12),

                TextButton(
                  onPressed: () => context.go('/login'),
                  child: const Text('Já tem conta? Entrar'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
