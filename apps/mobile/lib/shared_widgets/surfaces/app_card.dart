import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';

/// Themed surface container. Styling (radius, color, elevation) comes
/// from `CardThemeData` (see `core/theme/app_theme.dart`) — this widget
/// exists to give call sites a consistent default padding and an
/// optional tap target, not to redefine card styling itself.
class AppCard extends StatelessWidget {
  const AppCard({
    required this.child,
    super.key,
    this.onTap,
    this.padding = const EdgeInsets.all(AppSpacing.lg),
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final content = Padding(padding: padding, child: child);

    if (onTap == null) {
      return Card(margin: EdgeInsets.zero, child: content);
    }

    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(onTap: onTap, child: content),
    );
  }
}
