import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qbite/shared_widgets/buttons/app_button.dart';

void main() {
  Widget wrap(Widget child) => MaterialApp(
    home: Scaffold(body: Center(child: child)),
  );

  testWidgets('invokes onPressed when tapped', (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      wrap(AppButton(label: 'Continue', onPressed: () => tapped = true)),
    );

    await tester.tap(find.text('Continue'));
    expect(tapped, isTrue);
  });

  testWidgets('is disabled and shows a spinner while isLoading', (
    tester,
  ) async {
    var tapped = false;
    await tester.pumpWidget(
      wrap(
        AppButton(
          label: 'Continue',
          isLoading: true,
          onPressed: () => tapped = true,
        ),
      ),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.tap(find.byType(AppButton), warnIfMissed: false);
    expect(tapped, isFalse);
  });

  testWidgets('is disabled when onPressed is null', (tester) async {
    await tester.pumpWidget(
      wrap(const AppButton(label: 'Continue', onPressed: null)),
    );

    final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
    expect(button.onPressed, isNull);
  });
}
