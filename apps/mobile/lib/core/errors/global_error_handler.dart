import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../logging/app_logger.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

/// Wires framework-level and platform-level error hooks to [logger],
/// and installs a graceful fallback UI in place of Flutter's red error
/// box.
///
/// Called once from `bootstrap.dart`, before `runApp`. This is the
/// seam where crash-reporting (Crashlytics/Sentry) gets attached in a
/// later phase (see docs/DEVELOPMENT_ROADMAP.md, Phase 10 hardening) —
/// both callbacks below are marked with a TODO for that, and neither
/// does anything beyond logging + a fallback widget today.
void configureGlobalErrorHandling(AppLogger logger) {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (FlutterErrorDetails details) {
    logger.error(
      'Uncaught Flutter framework error',
      error: details.exception,
      stackTrace: details.stack,
    );
    // TODO(Phase 10): forward `details` to crash reporting.
    originalOnError?.call(details);
  };

  PlatformDispatcher.instance.onError = (Object error, StackTrace stackTrace) {
    logger.error('Uncaught async error', error: error, stackTrace: stackTrace);
    // TODO(Phase 10): forward to crash reporting.
    return true; // handled — prevents the platform from also printing it.
  };

  ErrorWidget.builder = (FlutterErrorDetails details) =>
      _ErrorFallback(details: details);
}

/// Release-mode fallback shown in place of a crashed widget subtree.
///
/// Deliberately built from raw design tokens rather than
/// `shared_widgets/feedback/app_error_view.dart` — `core/` sits below
/// `shared_widgets/` in the dependency graph (see ARCHITECTURE.md
/// §9.6), so this stays self-contained rather than reaching upward.
///
/// Also deliberately does NOT read `AppLocalizations.of(context)`: this
/// widget can replace a subtree that failed *before* a `Localizations`
/// ancestor exists (e.g. an error during early app bootstrap), and the
/// error fallback must never itself throw. The string below is
/// intentionally hardcoded English, not a localization gap.
class _ErrorFallback extends StatelessWidget {
  const _ErrorFallback({required this.details});

  final FlutterErrorDetails details;

  @override
  Widget build(BuildContext context) {
    if (kDebugMode) {
      // In debug builds, the original red error box is more useful for
      // diagnosing the failure than a friendly fallback would be.
      return ErrorWidget(details.exception);
    }

    return ColoredBox(
      color: AppColors.warning.withValues(alpha: 0.08),
      child: const Center(
        child: Padding(
          padding: EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, color: AppColors.warning, size: 40),
              SizedBox(height: AppSpacing.md),
              Text('Unexpected error', textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}
