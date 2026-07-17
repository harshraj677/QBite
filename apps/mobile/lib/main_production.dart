import 'bootstrap.dart';
import 'config/env.dart';

/// Production flavor entrypoint: `flutter run -t lib/main_production.dart`
/// (and what release builds submitted to the Play Store should target).
void main() => bootstrap(Environment.production);
