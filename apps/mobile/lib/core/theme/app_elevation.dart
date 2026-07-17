/// Elevation tokens for the QBite design system.
///
/// Material 3 favors tonal elevation (surface color shifts) over deep
/// shadows, but a small numeric scale is still needed wherever a
/// component takes an explicit `elevation:` value (e.g. `Card`,
/// `Material`) — this is that scale, kept short and named by role
/// rather than by raw pixel value.
abstract final class AppElevation {
  AppElevation._();

  static const double flat = 0;
  static const double resting = 1;
  static const double raised = 3;
  static const double overlay = 6;
  static const double modal = 12;
}
