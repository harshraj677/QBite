/// Spacing scale for the QBite design system — a 4pt grid.
///
/// Every margin/padding/gap in the app should reference one of these
/// constants rather than a literal number, so spacing stays visually
/// consistent across features built by different people at different
/// times.
abstract final class AppSpacing {
  AppSpacing._();

  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;
  static const double xxxl = 48;
  static const double huge = 64;
}
