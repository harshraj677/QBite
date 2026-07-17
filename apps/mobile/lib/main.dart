import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'config/router.dart';
import 'config/theme.dart';

/// App entry point.
///
/// This is bootstrap wiring only (DI container, theme, routing) — no
/// feature or business logic. Feature screens are added to
/// config/router.dart as they are implemented.
void main() {
  runApp(const ProviderScope(child: QBiteApp()));
}

class QBiteApp extends StatelessWidget {
  const QBiteApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'QBite',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      routerConfig: appRouter,
    );
  }
}
