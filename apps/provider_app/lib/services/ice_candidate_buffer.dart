/// Holds remote candidates until SDP has been applied, then drains serially.
class IceCandidateBuffer<T> {
  final List<T> _pending = [];
  Future<void>? _draining;
  int _generation = 0;
  void add(T candidate) => _pending.add(candidate);
  void clear() {
    _generation++;
    _pending.clear();
    _draining = null;
  }

  Future<void> drain(Future<void> Function(T) apply) {
    if (_draining != null) return _draining!;
    final generation = _generation;
    Future<void> run() async {
      try {
        while (generation == _generation && _pending.isNotEmpty) {
          await apply(_pending.removeAt(0));
        }
      } finally {
        if (generation == _generation) _draining = null;
      }
    }

    if (_pending.isEmpty) return Future.value();
    return _draining = run();
  }
}
