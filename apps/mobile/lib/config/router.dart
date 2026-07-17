import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Root route table.
///
/// Intentionally contains a single bootstrap placeholder route. Feature
/// routes (auth, discovery, cart, checkout, tracking, etc.) are added
/// here as each feature is implemented — this file is infrastructure,
/// not a place for screen/business logic.
final GoRouter appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const _BootstrapPlaceholder(),
    ),
  ],
);

class _BootstrapPlaceholder extends StatelessWidget {
  const _BootstrapPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Text('QBite'),
      ),
    );
  }
}
