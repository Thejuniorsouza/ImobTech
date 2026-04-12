import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/supabase_client.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/owner/dashboard/owner_dashboard_screen.dart';
import '../features/owner/properties/properties_screen.dart';
import '../features/owner/properties/property_detail_screen.dart';
import '../features/owner/contracts/contracts_screen.dart';
import '../features/owner/contracts/contract_detail_screen.dart';
import '../features/owner/inspections/inspection_screen.dart';
import '../features/owner/documents/documents_screen.dart';
import '../features/owner/templates/templates_screen.dart';
import '../features/owner/ads/ad_generator_screen.dart';
import '../features/tenant/dashboard/tenant_dashboard_screen.dart';
import '../features/tenant/contracts/tenant_contract_detail_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final session = supabase.auth.currentSession;
      final isAuthRoute = state.matchedLocation.startsWith('/login') ||
          state.matchedLocation.startsWith('/register');

      if (session == null && !isAuthRoute) return '/login';
      return null;
    },
    routes: [
      // ── Auth ────────────────────────────────────────────────────────────
      GoRoute(path: '/login', builder: (ctx, _) => const LoginScreen()),
      GoRoute(path: '/register', builder: (ctx, _) => const RegisterScreen()),

      // ── Owner shell ──────────────────────────────────────────────────────
      ShellRoute(
        builder: (ctx, state, child) => _OwnerShell(child: child),
        routes: [
          GoRoute(
            path: '/owner/dashboard',
            builder: (ctx, _) => const OwnerDashboardScreen(),
          ),
          GoRoute(
            path: '/owner/properties',
            builder: (ctx, _) => const PropertiesScreen(),
          ),
          GoRoute(
            path: '/owner/properties/:id',
            builder: (ctx, state) =>
                PropertyDetailScreen(propertyId: state.pathParameters['id']),
          ),
          GoRoute(
            path: '/owner/contracts',
            builder: (ctx, _) => const ContractsScreen(),
          ),
          GoRoute(
            path: '/owner/contracts/:id',
            builder: (ctx, state) =>
                ContractDetailScreen(contractId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/owner/contracts/:id/inspection',
            builder: (ctx, state) =>
                InspectionScreen(contractId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/owner/contracts/:id/documents',
            builder: (ctx, state) =>
                DocumentsScreen(contractId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/owner/templates',
            builder: (ctx, _) => const TemplatesScreen(),
          ),
          GoRoute(
            path: '/owner/properties/:id/ad',
            builder: (ctx, state) =>
                AdGeneratorScreen(propertyId: state.pathParameters['id']!),
          ),
        ],
      ),

      // ── Tenant shell ─────────────────────────────────────────────────────
      ShellRoute(
        builder: (ctx, state, child) => _TenantShell(child: child),
        routes: [
          GoRoute(
            path: '/tenant/dashboard',
            builder: (ctx, _) => const TenantDashboardScreen(),
          ),
          GoRoute(
            path: '/tenant/contracts/:id',
            builder: (ctx, state) => TenantContractDetailScreen(
              contractId: state.pathParameters['id']!,
            ),
          ),
        ],
      ),
    ],
    errorBuilder: (ctx, state) => Scaffold(
      body: Center(child: Text('Página não encontrada: ${state.uri}')),
    ),
  );
});

// ── Shell wrappers ────────────────────────────────────────────────────────

class _OwnerShell extends StatelessWidget {
  const _OwnerShell({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: Builder(
        builder: (ctx) {
          final location = GoRouterState.of(ctx).matchedLocation;
          int idx = 0;
          if (location.startsWith('/owner/properties')) idx = 1;
          if (location.startsWith('/owner/contracts')) idx = 2;

          return BottomNavigationBar(
            currentIndex: idx,
            onTap: (i) {
              switch (i) {
                case 0: ctx.go('/owner/dashboard');
                case 1: ctx.go('/owner/properties');
                case 2: ctx.go('/owner/contracts');
              }
            },
            items: const [
              BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: 'Painel'),
              BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Imóveis'),
              BottomNavigationBarItem(icon: Icon(Icons.description), label: 'Contratos'),
            ],
          );
        },
      ),
    );
  }
}

class _TenantShell extends StatelessWidget {
  const _TenantShell({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('ImobTech'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sair',
            onPressed: () async {
              await supabase.auth.signOut();
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
      body: child,
    );
  }
}
