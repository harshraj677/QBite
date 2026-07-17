import 'dart:async' show unawaited;

import 'package:flutter/material.dart';

import '../../core/theme/app_motion.dart';

/// Fades and gently slides [child] in on first build.
///
/// A generic entrance animation for list items / cards appearing
/// on-screen — parameterized by [delay] so a list can stagger each
/// item rather than every widget importing its own `AnimationController`
/// boilerplate.
class FadeIn extends StatefulWidget {
  const FadeIn({
    required this.child,
    super.key,
    this.delay = Duration.zero,
    this.duration = AppMotion.normal,
    this.offset = const Offset(0, 0.04),
  });

  final Widget child;
  final Duration delay;
  final Duration duration;

  /// Fractional slide offset (relative to the widget's own size) the
  /// content travels from as it fades in.
  final Offset offset;

  @override
  State<FadeIn> createState() => _FadeInState();
}

class _FadeInState extends State<FadeIn> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  );
  late final Animation<double> _opacity = CurvedAnimation(
    parent: _controller,
    curve: AppMotion.enter,
  );
  late final Animation<Offset> _slide = Tween(
    begin: widget.offset,
    end: Offset.zero,
  ).animate(_opacity);

  @override
  void initState() {
    super.initState();
    if (widget.delay == Duration.zero) {
      unawaited(_controller.forward());
    } else {
      Future.delayed(widget.delay, () {
        if (mounted) unawaited(_controller.forward());
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(position: _slide, child: widget.child),
    );
  }
}
