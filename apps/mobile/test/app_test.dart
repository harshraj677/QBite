import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qbite/app.dart';
import 'package:qbite/config/env.dart';
import 'package:qbite/config/providers.dart';
import 'package:qbite/core/logging/app_logger.dart';

void main() {
  testWidgets('QBiteApp boots and renders the bootstrap placeholder', (
    tester,
  ) async {
    // dotenv.testLoad bypasses asset-bundle loading (used by
    // EnvConfig.fromDotEnv via bootstrap.dart in a real run) — the
    // point of this test is to prove the app shell (theme, router,
    // localization, DI overrides) wires together, not to re-test
    // flutter_dotenv itself.
    dotenv.testLoad(
      fileInput: 'API_BASE_URL=http://localhost\nSOCKET_URL=ws://localhost',
    );
    final envConfig = EnvConfig.fromDotEnv(Environment.development);
    final logger = AppLogger(isProduction: false);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          envConfigProvider.overrideWithValue(envConfig),
          loggerProvider.overrideWithValue(logger),
        ],
        child: const QBiteApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('QBite'), findsOneWidget);
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
