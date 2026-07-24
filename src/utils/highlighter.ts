export interface HighlightSegment {
  text: string;
  className: string;
}

const RULES: { pattern: RegExp; className: string }[] = [
  // AT commands
  { pattern: /^(AT(\+[A-Z_]+)?)(\r?\n)?$/gm, className: 'hl-at-command' },
  // Error keywords
  { pattern: /\b(ERROR|FAIL|FAILURE|TIMEOUT|EXCEPTION|FAULT)\b/gi, className: 'hl-error' },
  // Success keywords
  { pattern: /\b(OK|SUCCESS|READY|DONE|PASS|CONNECTED|ACK)\b/gi, className: 'hl-success' },
  // Warning keywords
  { pattern: /\b(WARN|WARNING|CAUTION|NOTICE)\b/gi, className: 'hl-warning' },
  // Hex values (0xNN or standalone hex pairs)
  { pattern: /\b0x[0-9A-Fa-f]{2,}\b/g, className: 'hl-hex' },
  // Hex data sequences (2+ hex bytes)
  { pattern: /\b[0-9A-Fa-f]{2}(?:\s[0-9A-Fa-f]{2}){1,}\b/g, className: 'hl-hex-data' },
  // Modbus function codes
  { pattern: /\b(Read (Holding|Input) Registers?|Write Single (Register|Coil)|Read Coils?|Read Discrete Inputs?)\b/gi, className: 'hl-modbus-fc' },
  // Baud rates and numeric values
  { pattern: /\b(\d{4,6})\s*(bps|baud|Hz|kHz|MHz)?\b/gi, className: 'hl-number' },
  // IP addresses
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, className: 'hl-ip' },
  // MAC addresses
  { pattern: /\b[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5}\b/g, className: 'hl-mac' },
  // GPIO/Pin references
  { pattern: /\b(GPIO|PA|PB|PC|PD)\d{1,2}\b/gi, className: 'hl-pin' },
  // Register addresses
  { pattern: /\b(0x[0-9A-Fa-f]{4,8})\b/g, className: 'hl-address' },
  // String values in quotes
  { pattern: /"[^"]*"/g, className: 'hl-string' },
  // CRLF
  { pattern: /(\r\n|\r|\n)/g, className: 'hl-crlf' },
];

export function highlightData(data: string): HighlightSegment[] {
  if (!data) return [{ text: '', className: '' }];

  const segments: HighlightSegment[] = [];
  let remaining = data;
  let lastIndex = 0;

  // Find all matches with their positions
  const allMatches: { start: number; end: number; text: string; className: string }[] = [];

  for (const rule of RULES) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match;
    while ((match = regex.exec(data)) !== null) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        className: rule.className,
      });
    }
  }

  // Sort by start position, longer matches first for same start
  allMatches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  // Remove overlapping matches (keep first/longest)
  const filtered: typeof allMatches = [];
  for (const match of allMatches) {
    const overlaps = filtered.some(
      (f) => !(match.end <= f.start || match.start >= f.end)
    );
    if (!overlaps) {
      filtered.push(match);
    }
  }

  filtered.sort((a, b) => a.start - b.start);

  // Build segments
  for (const match of filtered) {
    if (match.start > lastIndex) {
      segments.push({ text: data.slice(lastIndex, match.start), className: '' });
    }
    segments.push({ text: match.text, className: match.className });
    lastIndex = match.end;
  }

  if (lastIndex < data.length) {
    segments.push({ text: data.slice(lastIndex), className: '' });
  }

  return segments;
}

export function highlightTimestamp(ts: string): HighlightSegment[] {
  // Colorize milliseconds differently from seconds
  const parts = ts.split('.');
  if (parts.length === 2) {
    return [
      { text: parts[0], className: 'hl-time-sec' },
      { text: '.', className: 'hl-time-dot' },
      { text: parts[1], className: 'hl-time-ms' },
    ];
  }
  return [{ text: ts, className: 'hl-time-sec' }];
}
