import 'package:dio/dio.dart';

/// Base Dio client configuration.
///
/// This is transport-layer setup only — base URL, timeouts, and the
/// interceptor chain slot. No interceptors (auth injection, error
/// normalization, refresh-on-401) are wired yet; see ARCHITECTURE.md
/// §2.4 for the interceptor order they will be added in.
class DioClient {
  DioClient({required String baseUrl})
    : dio = Dio(
        BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 15),
          headers: const {'Content-Type': 'application/json'},
        ),
      );

  final Dio dio;
}
