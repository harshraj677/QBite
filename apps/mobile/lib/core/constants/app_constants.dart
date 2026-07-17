import 'package:flutter/widgets.dart' show Locale;

/// App-wide constants that aren't design tokens (see `core/theme/`) and
/// aren't environment-specific (see `config/env.dart`).
///
/// Deliberately narrow: only values genuinely shared across features.
/// Feature-specific constants belong inside that feature's own folder
/// once the feature exists, not here.
abstract final class AppConstants {
  AppConstants._();

  static const String appName = 'QBite';

  /// Matches the pagination defaults in docs/API_SPECIFICATION.md §8.
  static const int defaultPageSize = 20;
  static const int maxPageSize = 50;

  static const Locale defaultLocale = Locale('en');
  static const List<Locale> supportedLocales = [defaultLocale];
}
