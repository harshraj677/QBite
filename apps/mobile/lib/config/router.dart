import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/logging/app_navigator_observer.dart';
import '../l10n/generated/app_localizations.dart';
import '../shared_widgets/animations/app_page_transition.dart';
import '../shared_widgets/feedback/app_error_view.dart';
import 'providers.dart';

/// Root route table.
///
/// A Riverpod provider (not a bare top-level `GoRouter`) so it can
/// depend on [loggerProvider] for navigation logging, and — once the
/// auth feature exists — so its `redirect` can depend on auth-state
/// providers for route guards, per ARCHITECTURE.md §2.3. Feature
/// routes are added to `routes` as each feature is implemented; this
/// intentionally contains only a bootstrap placeholder route today.
final routerProvider = Provider<GoRouter>((ref) {
  final logger = ref.watch(loggerProvider);

  return GoRouter(
    initialLocation: '/',
    observers: [AppNavigatorObserver(logger)],
    routes: [
      GoRoute(
        path: '/',
        name: 'bootstrap',
        pageBuilder: (context, state) => appPageTransition(
          key: state.pageKey,
          name: state.name,
          child: const _BootstrapPlaceholder(),
        ),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      appBar: AppBar(
        title: Text(AppLocalizations.of(context).pageNotFoundTitle),
      ),
      body: AppErrorView(
        title: AppLocalizations.of(context).pageNotFoundTitle,
        message: state.uri.toString(),
      ),
    ),
  );
});

class _BootstrapPlaceholder extends StatelessWidget {
  const _BootstrapPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: Text('QBite')));
  }
}
