import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_empty_view.dart';
import 'app_error_view.dart';
import 'app_loading_view.dart';

/// Renders an [AsyncValue] as loading / error / empty / data,
/// operationalizing the rule in docs/CODING_STANDARDS.md §2 that every
/// async-backed screen must handle all four states explicitly — one
/// reusable widget instead of every feature screen re-deriving the
/// same `when(...)` branching by hand.
///
/// [isEmpty] lets a feature define what "no data" means for its own
/// data shape (e.g. an empty list) — by default, nothing is ever
/// treated as empty and [data] always renders once loaded.
class AppAsyncValueView<T> extends StatelessWidget {
  const AppAsyncValueView({
    required this.value,
    required this.data,
    super.key,
    this.isEmpty,
    this.emptyBuilder,
    this.onRetry,
  });

  final AsyncValue<T> value;
  final Widget Function(BuildContext context, T data) data;
  final bool Function(T data)? isEmpty;
  final WidgetBuilder? emptyBuilder;

  /// Called from the error state's retry action, and — when [isEmpty]
  /// is used — also available to an `emptyBuilder` that wants a retry
  /// affordance (e.g. "no results — try again").
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return value.when(
      loading: () => const AppLoadingView(),
      error: (error, stackTrace) => AppErrorView(onRetry: onRetry),
      data: (value) {
        if (isEmpty != null && isEmpty!(value)) {
          return emptyBuilder?.call(context) ?? const AppEmptyView();
        }
        return data(context, value);
      },
    );
  }
}
