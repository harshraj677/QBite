import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Build flavor. Determines which `.env.*` file is loaded and is
/// threaded through the app for anything that needs to branch on
/// environment (e.g. disabling verbose logging in production).
enum Environment {
  development,
  staging,
  production;

  String get envFileName => '.env.$name';
}

/// Typed access to environment variables loaded from the active
/// flavor's `.env.*` file (see `lib/main_*.dart` and `bootstrap.dart`).
///
/// This is infrastructure only — it exposes configuration values, it
/// does not use them (no network calls, no SDK initialization). Wiring
/// `apiBaseUrl` into a real Dio instance happens in `config/providers.dart`;
/// consuming `razorpayKeyId`/`googleMapsApiKey` happens once the
/// relevant feature is implemented.
class EnvConfig {
  const EnvConfig._({
    required this.environment,
    required this.apiBaseUrl,
    required this.socketUrl,
    required this.razorpayKeyId,
    required this.googleMapsApiKey,
  });

  final Environment environment;
  final String apiBaseUrl;
  final String socketUrl;
  final String razorpayKeyId;
  final String googleMapsApiKey;

  bool get isProduction => environment == Environment.production;

  /// Reads the already-loaded `dotenv` instance (see `bootstrap.dart`,
  /// which calls `dotenv.load` before this is constructed) into a typed,
  /// immutable config object.
  factory EnvConfig.fromDotEnv(Environment environment) {
    return EnvConfig._(
      environment: environment,
      apiBaseUrl: dotenv.get('API_BASE_URL', fallback: ''),
      socketUrl: dotenv.get('SOCKET_URL', fallback: ''),
      razorpayKeyId: dotenv.get('RAZORPAY_KEY_ID', fallback: ''),
      googleMapsApiKey: dotenv.get('GOOGLE_MAPS_API_KEY', fallback: ''),
    );
  }
}
