import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../buttons/app_button.dart';

/// Generic error state: icon + message + retry action.
///
/// Used both standalone (a feature screen's error branch) and by
/// `AppAsyncValueView`'s error case. [onRetry] is optional — omit it
/// for errors that genuinely can't be retried (e.g. a permanent 403).
class AppErrorView extends StatelessWidget {
  const AppErrorView({super.key, this.title, this.message, this.onRetry});

  /// Defaults to the localized generic "Something went wrong" string.
  final String? title;
  final String? message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 48, color: colors.error),
            const SizedBox(height: AppSpacing.lg),
            Text(
              title ?? l10n.somethingWentWrong,
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            if (message != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                message!,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: colors.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
            ],
            if (onRetry != null) ...[
              const SizedBox(height: AppSpacing.lg),
              AppButton(label: l10n.retry, onPressed: onRetry),
            ],
          ],
        ),
      ),
    );
  }
}
