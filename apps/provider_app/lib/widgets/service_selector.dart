import 'package:flutter/material.dart';

class ServiceSelector extends StatelessWidget {
  final List<dynamic> services;
  final List<String> selected;
  final void Function(String, bool) onChanged;
  const ServiceSelector(
      {super.key,
      required this.services,
      required this.selected,
      required this.onChanged});
  @override
  Widget build(BuildContext context) => ListView(children: [
        Text(
            '${selected.length} services selected · Select all that you provide',
            style: const TextStyle(color: Colors.white70)),
        ...services.map((service) => CheckboxListTile(
              title: Text(service['name'],
                  style: const TextStyle(color: Colors.white)),
              subtitle: Text(service['description'] ?? '',
                  style: const TextStyle(color: Colors.white54)),
              activeColor: Colors.lightBlueAccent,
              side: const BorderSide(color: Colors.white54),
              value: selected.contains(service['id']),
              onChanged: (value) => onChanged(service['id'], value == true),
            )),
      ]);
}
