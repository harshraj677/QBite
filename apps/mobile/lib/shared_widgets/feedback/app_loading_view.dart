import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';

/// Generic loading state: centered spinner with an optional label.
/// Used directly by `AppAsyncValueView` (see `app_async_value_view.dart`)
/// and available standalone wherever a screen needs a loading state
/// outside of an `AsyncValue`.
class AppLoadingView extends StatelessWidget {
  const AppLoadingView({super.key, this.message});

  /// Defaults to the localized generic "Loading…" string.
  final String? message;

  @override
  Widget build(BuildContext context) {
    final label = message ?? AppLocalizations.of(context).loading;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: AppSpacing.md),
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}
