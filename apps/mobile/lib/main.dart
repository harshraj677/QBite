import 'bootstrap.dart';
import 'config/env.dart';

/// Default entrypoint — what `flutter run`/the IDE "Run" button uses
/// with no explicit target. Mirrors `main_development.dart` so the
/// zero-config path is still the development flavor; CI/release builds
/// should target `main_staging.dart` / `main_production.dart`
/// explicitly via `-t`.
void main() => bootstrap(Environment.development);
