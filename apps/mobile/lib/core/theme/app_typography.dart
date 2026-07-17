import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Typography tokens for the QBite design system.
///
/// Wraps [GoogleFonts.interTextTheme] rather than exposing raw
/// [TextStyle]s — this is the single place that decides the app's
/// typeface, so swapping fonts later touches one file.
abstract final class AppTypography {
  AppTypography._();

  static TextTheme textTheme(TextTheme base) =>
      GoogleFonts.interTextTheme(base);
}
