import 'bootstrap.dart';
import 'config/env.dart';

/// Staging flavor entrypoint: `flutter run -t lib/main_staging.dart`.
void main() => bootstrap(Environment.staging);
