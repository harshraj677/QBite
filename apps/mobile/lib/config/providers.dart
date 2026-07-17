import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../core/logging/app_logger.dart';
import '../core/network/dio_client.dart';
import 'env.dart';

/// Central Riverpod providers for cross-cutting infrastructure.
///
/// This is QBite's dependency injection layer — per ARCHITECTURE.md
/// §2.2 / §9, Riverpod's provider graph *is* the DI mechanism, so
/// there is no separate service-locator package. Feature-level
/// providers (repositories, use cases, screen state) live inside each
/// feature's own `presentation/providers/` once that feature is
/// implemented; only infrastructure shared by every feature belongs
/// here.

/// [EnvConfig] cannot be constructed until `dotenv.load` has resolved
/// (see `bootstrap.dart`), which happens before `runApp` — so this
/// provider has no body of its own and is overridden with the real
/// value via `ProviderScope(overrides: [...])` at startup. Reading it
/// without that override is a programming error, not a runtime one to
/// handle gracefully.
final envConfigProvider = Provider<EnvConfig>((ref) {
  throw UnimplementedError(
    'envConfigProvider must be overridden in bootstrap.dart',
  );
});

/// Same pattern as [envConfigProvider]: constructed once in
/// `bootstrap.dart` (so global error handling can use it before
/// `runApp`) and shared into the provider graph via override, rather
/// than built twice.
final loggerProvider = Provider<AppLogger>((ref) {
  throw UnimplementedError(
    'loggerProvider must be overridden in bootstrap.dart',
  );
});

/// Base HTTP client, configured from [envConfigProvider]. No
/// interceptors are attached yet (auth-token injection, refresh-on-401
/// — see ARCHITECTURE.md §2.4) — those are added once the auth feature
/// is implemented.
final dioClientProvider = Provider<DioClient>((ref) {
  final env = ref.watch(envConfigProvider);
  return DioClient(baseUrl: env.apiBaseUrl);
});

/// Secure local storage instance. Exposed here so any feature can
/// depend on it without constructing its own; storing/reading actual
/// tokens is auth-feature business logic, out of scope for this
/// provider.
final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage();
});
