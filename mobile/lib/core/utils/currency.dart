import 'package:intl/intl.dart';

/// Brazilian Real formatter. Displays centavos as "R$ X,XX".
final _brlFormat = NumberFormat.currency(
  locale: 'pt_BR',
  symbol: 'R\$',
  decimalDigits: 2,
);

/// Convert centavos [int] to a display [String], e.g. 150000 → "R$ 1.500,00".
String centsToDisplay(int cents) =>
    _brlFormat.format(cents / 100.0);

/// Convert a display string (from a masked text field) back to cents.
/// Strips "R$", ".", and replaces "," with ".".
int displayToCents(String display) {
  if (display.isEmpty) return 0;
  final cleaned = display
      .replaceAll(RegExp(r'[R$\s]'), '')
      .replaceAll('.', '')
      .replaceAll(',', '.');
  final parsed = double.tryParse(cleaned) ?? 0.0;
  return (parsed * 100).round();
}
