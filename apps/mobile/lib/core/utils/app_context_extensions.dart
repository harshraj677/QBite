import 'package:flutter/material.dart';

import 'app_breakpoints.dart';

/// Convenience shortcuts on [BuildContext] for the two things nearly
/// every widget needs: theme values and screen-size-aware layout.
/// Keeps call sites as `context.colorScheme` / `context.isMobile`
/// instead of repeating `Theme.of(context).colorScheme` and manual
/// `MediaQuery` width comparisons throughout every feature.
extension AppContextX on BuildContext {
  ThemeData get theme => Theme.of(this);

  ColorScheme get colors => theme.colorScheme;

  TextTheme get textStyles => theme.textTheme;

  Size get screenSize => MediaQuery.sizeOf(this);

  double get screenWidth => screenSize.width;

  double get screenHeight => screenSize.height;

  bool get isMobile => screenWidth < AppBreakpoints.compact;

  bool get isTablet =>
      screenWidth >= AppBreakpoints.compact &&
      screenWidth < AppBreakpoints.expanded;

  bool get isDesktop => screenWidth >= AppBreakpoints.expanded;

  /// Picks a value based on the current width class. [mobile] is
  /// required as the baseline; [tablet]/[desktop] fall back to it (and
  /// to each other) when not supplied, so callers only override the
  /// breakpoints they actually care about.
  T responsive<T>({required T mobile, T? tablet, T? desktop}) {
    if (isDesktop) return desktop ?? tablet ?? mobile;
    if (isTablet) return tablet ?? mobile;
    return mobile;
  }
}
