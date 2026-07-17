import 'package:flutter/animation.dart';

/// Motion tokens (durations + curves) for the QBite design system.
///
/// Used by `shared_widgets/animations/*` and by the router's page
/// transitions — centralized so every animation in the app feels like
/// it belongs to the same product rather than each screen inventing
/// its own timing.
abstract final class AppMotion {
  AppMotion._();

  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 250);
  static const Duration slow = Duration(milliseconds: 400);

  static const Curve standard = Curves.easeInOutCubic;
  static const Curve enter = Curves.easeOut;
  static const Curve exit = Curves.easeIn;
}
