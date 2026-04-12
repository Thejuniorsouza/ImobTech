import 'package:supabase_flutter/supabase_flutter.dart';

/// Global Supabase client accessor.
/// Initialise once in [main] via [Supabase.initialize].
SupabaseClient get supabase => Supabase.instance.client;
