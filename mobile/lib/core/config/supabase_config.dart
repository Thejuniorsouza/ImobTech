/// Supabase configuration constants.
/// Values are injected via --dart-define at build time or via
/// a flavored .env loading mechanism in CI.
abstract final class SupabaseConfig {
  static const String url = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://YOUR_PROJECT_REF.supabase.co',
  );

  static const String anonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'YOUR_ANON_KEY_HERE',
  );
}
