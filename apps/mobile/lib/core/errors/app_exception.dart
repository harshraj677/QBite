/// Base type for infrastructure-level failures (network, cache,
/// serialization). This is a generic taxonomy, not business rules —
/// feature-specific failure types (e.g. `InvalidCouponException`) are
/// defined within their own feature's `domain` layer when that feature
/// is implemented, extending these where it makes sense.
sealed class AppException implements Exception {
  const AppException(this.message, {this.cause});

  final String message;
  final Object? cause;

  @override
  String toString() => '$runtimeType: $message';
}

/// Request failed at the transport layer (no connectivity, timeout,
/// DNS failure) — distinct from a successful response carrying an
/// error payload, which is a `ServerException`.
final class NetworkException extends AppException {
  const NetworkException(super.message, {super.cause});
}

/// Server responded, but with an error (matches the error envelope in
/// docs/API_SPECIFICATION.md §5 once the API client is implemented).
final class ServerException extends AppException {
  const ServerException(super.message, {this.code, super.cause});

  /// Machine-readable error code from the API's error envelope
  /// (e.g. `ORDER_ALREADY_ACCEPTED`), when available.
  final String? code;
}

/// Local persistence (secure storage, cache) failed.
final class CacheException extends AppException {
  const CacheException(super.message, {super.cause});
}

/// Anything that doesn't fit the above — deliberately last-resort, not
/// a catch-all to reach for by default.
final class UnexpectedException extends AppException {
  const UnexpectedException(super.message, {super.cause});
}
