import 'package:flutter/widgets.dart';

import 'app_logger.dart';

/// Logs navigation events (push/pop/replace) at debug level.
///
/// Purely observational — no analytics/business logic. Useful during
/// development to see the route stack change, and a natural place to
/// attach screen-view analytics later without touching route
/// definitions themselves.
class AppNavigatorObserver extends NavigatorObserver {
  AppNavigatorObserver(this._logger);

  final AppLogger _logger;

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _logger.debug(
      'Navigated to ${_nameOf(route)} (from ${_nameOf(previousRoute)})',
    );
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _logger.debug(
      'Popped ${_nameOf(route)} (back to ${_nameOf(previousRoute)})',
    );
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    _logger.debug('Replaced ${_nameOf(oldRoute)} with ${_nameOf(newRoute)}');
  }

  String _nameOf(Route<dynamic>? route) =>
      route?.settings.name ?? route?.settings.toString() ?? 'unknown';
}
