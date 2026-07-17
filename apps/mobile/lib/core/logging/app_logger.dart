import 'package:logger/logger.dart';

/// Central logging facade.
///
/// A thin wrapper around `package:logger` rather than direct calls
/// scattered through the app — this is the one seam that will forward
/// to a crash-reporting service (Crashlytics/Sentry) once one is wired
/// up, without changing any call site.
class AppLogger {
  AppLogger._(this._logger);

  factory AppLogger({required bool isProduction}) {
    return AppLogger._(
      Logger(
        level: isProduction ? Level.warning : Level.trace,
        printer: PrettyPrinter(
          methodCount: isProduction ? 0 : 2,
          errorMethodCount: 8,
          colors: !isProduction,
          printEmojis: !isProduction,
          dateTimeFormat: DateTimeFormat.onlyTimeAndSinceStart,
        ),
      ),
    );
  }

  final Logger _logger;

  void debug(String message, [Object? data]) => _logger.d(message, error: data);

  void info(String message, [Object? data]) => _logger.i(message, error: data);

  void warning(String message, [Object? data]) =>
      _logger.w(message, error: data);

  /// [error] and [stackTrace] are forwarded to crash reporting once
  /// that integration exists (TODO: Phase 10 hardening, per
  /// docs/DEVELOPMENT_ROADMAP.md) — logged locally for now.
  void error(String message, {Object? error, StackTrace? stackTrace}) {
    _logger.e(message, error: error, stackTrace: stackTrace);
  }
}
