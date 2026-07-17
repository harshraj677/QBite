import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qbite/l10n/generated/app_localizations.dart';
import 'package:qbite/shared_widgets/feedback/app_async_value_view.dart';
import 'package:qbite/shared_widgets/feedback/app_empty_view.dart';
import 'package:qbite/shared_widgets/feedback/app_error_view.dart';
import 'package:qbite/shared_widgets/feedback/app_loading_view.dart';

void main() {
  Widget wrap(Widget child) => MaterialApp(
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(body: child),
  );

  testWidgets('renders AppLoadingView for loading state', (tester) async {
    await tester.pumpWidget(
      wrap(
        AppAsyncValueView<int>(
          value: const AsyncLoading<int>(),
          data: (context, value) => Text('$value'),
        ),
      ),
    );

    expect(find.byType(AppLoadingView), findsOneWidget);
  });

  testWidgets('renders AppErrorView for error state', (tester) async {
    await tester.pumpWidget(
      wrap(
        AppAsyncValueView<int>(
          value: AsyncError<int>(Exception('boom'), StackTrace.empty),
          data: (context, value) => Text('$value'),
        ),
      ),
    );

    expect(find.byType(AppErrorView), findsOneWidget);
  });

  testWidgets('renders data builder for data state', (tester) async {
    await tester.pumpWidget(
      wrap(
        AppAsyncValueView<int>(
          value: const AsyncData<int>(42),
          data: (context, value) => Text('$value'),
        ),
      ),
    );

    expect(find.text('42'), findsOneWidget);
  });

  testWidgets('renders AppEmptyView when isEmpty matches', (tester) async {
    await tester.pumpWidget(
      wrap(
        AppAsyncValueView<List<int>>(
          value: const AsyncData<List<int>>([]),
          isEmpty: (value) => value.isEmpty,
          data: (context, value) => Text('${value.length}'),
        ),
      ),
    );

    expect(find.byType(AppEmptyView), findsOneWidget);
  });
}
