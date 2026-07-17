/// Width breakpoints for adapting layout across phones, tablets, and
/// (a QBite web/desktop surface is not currently in scope, but the
/// scale costs nothing to define correctly now) larger screens.
///
/// Values follow Material 3's window size class guidance. Prefer the
/// `context.isMobile` / `context.isTablet` extensions in
/// `app_context_extensions.dart` over comparing against these directly.
abstract final class AppBreakpoints {
  AppBreakpoints._();

  static const double compact = 600;
  static const double medium = 840;
  static const double expanded = 1200;
}
