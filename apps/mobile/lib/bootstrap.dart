import 'package:flutter/widgets.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'config/env.dart';
import 'config/providers.dart';
import 'core/errors/global_error_handler.dart';
import 'core/logging/app_logger.dart';

/// Shared startup sequence for every flavor. Each `main_*.dart`
/// entrypoint does nothing but call this with its [Environment] —
/// keeping the three entrypoints trivial and putting all real
/// bootstrap logic in exactly one place.
Future<void> bootstrap(Environment environment) async {
  WidgetsFlutterBinding.ensureInitialized();

  await dotenv.load(fileName: environment.envFileName);
  final envConfig = EnvConfig.fromDotEnv(environment);

  final logger = AppLogger(isProduction: envConfig.isProduction);
  configureGlobalErrorHandling(logger);

  logger.info('QBite starting — environment: ${environment.name}');

  runApp(
    ProviderScope(
      overrides: [
        envConfigProvider.overrideWithValue(envConfig),
        loggerProvider.overrideWithValue(logger),
      ],
      child: const QBiteApp(),
    ),
  );
}
