import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';

/// Visual weight of an [AppButton]. Maps to the corresponding Material
/// button type so theming (see `core/theme/app_theme.dart`) stays in
/// one place rather than each call site picking its own widget.
enum AppButtonVariant { primary, secondary, outline, text, destructive }

/// The single button widget for the app. One configurable widget
/// rather than five near-duplicate ones (`AppPrimaryButton`,
/// `AppSecondaryButton`, ...) — the variants share all their layout
/// and loading/disabled behavior, and only differ in style, which
/// [variant] already parameterizes.
class AppButton extends StatelessWidget {
  const AppButton({
    required this.label,
    required this.onPressed,
    super.key,
    this.variant = AppButtonVariant.primary,
    this.isLoading = false,
    this.leadingIcon,
    this.expand = false,
  });

  final String label;

  /// `null` disables the button (also forced while [isLoading]).
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final bool isLoading;
  final IconData? leadingIcon;

  /// Whether the button fills the width available to it.
  final bool expand;

  bool get _isDisabled => onPressed == null || isLoading;

  @override
  Widget build(BuildContext context) {
    final child = isLoading
        ? SizedBox(
            height: 18,
            width: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: _progressColor(context),
            ),
          )
        : _ButtonContent(label: label, icon: leadingIcon);

    final button = switch (variant) {
      AppButtonVariant.primary => ElevatedButton(
        onPressed: _isDisabled ? null : onPressed,
        child: child,
      ),
      AppButtonVariant.secondary => FilledButton.tonal(
        onPressed: _isDisabled ? null : onPressed,
        child: child,
      ),
      AppButtonVariant.outline => OutlinedButton(
        onPressed: _isDisabled ? null : onPressed,
        child: child,
      ),
      AppButtonVariant.text => TextButton(
        onPressed: _isDisabled ? null : onPressed,
        child: child,
      ),
      AppButtonVariant.destructive => ElevatedButton(
        onPressed: _isDisabled ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: Theme.of(context).colorScheme.error,
          foregroundColor: Theme.of(context).colorScheme.onError,
        ),
        child: child,
      ),
    };

    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }

  Color _progressColor(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return switch (variant) {
      AppButtonVariant.primary ||
      AppButtonVariant.destructive => colors.onPrimary,
      AppButtonVariant.secondary => colors.onSecondaryContainer,
      AppButtonVariant.outline || AppButtonVariant.text => colors.primary,
    };
  }
}

class _ButtonContent extends StatelessWidget {
  const _ButtonContent({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    if (icon == null) return Text(label);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 18),
        const SizedBox(width: AppSpacing.sm),
        Text(label),
      ],
    );
  }
}
