import 'package:flutter/material.dart';

/// Raw color tokens for the QBite design system.
///
/// [ColorScheme.fromSeed] (see `app_theme.dart`) derives the full
/// Material 3 palette from [seed] — these constants are for the small
/// set of *semantic* colors Material 3 doesn't model (success/warning)
/// and for the seed itself. Everything else should be read from
/// `Theme.of(context).colorScheme`, never hard-coded at a call site.
abstract final class AppColors {
  /// Brand seed color — QBite orange. Drives the entire Material 3
  /// palette (light + dark) via [ColorScheme.fromSeed].
  static const Color seed = Color(0xFFEA580C);

  // Semantic status colors — not part of Material 3's ColorScheme, but
  // needed for order-status and form-validation UI across every
  // feature, so they're defined once here rather than per-feature.
  static const Color success = Color(0xFF16A34A);
  static const Color onSuccess = Color(0xFFFFFFFF);
  static const Color warning = Color(0xFFD97706);
  static const Color onWarning = Color(0xFFFFFFFF);

  const AppColors._();
}
