import { LogEntry } from '../types';

export interface LogSession {
  id: string;
  timestamp: number;
  portName: string;
  config: {
    baud_rate: number;
    data_bits: string;
    stop_bits: string;
    parity: string;
    flow_control: string;
  };
  entries: LogEntry[];
  metadata: {
    totalTxBytes: number;
    totalRxBytes: number;
    duration: number;
    errorCount: number;
  };
}

export function exportToTxt(entries: LogEntry[], portName: string): string {
  const header = `SerialPilot Log Export\nPort: ${portName}\nDate: ${new Date().toISOString()}\n${'='.repeat(60)}\n\n`;
  const body = entries
    .map((e) => `[${e.timestamp}] ${e.direction}> ${e.data}`)
    .join('\n');
  return header + body;
}

export function exportToCsv(entries: LogEntry[]): string {
  const header = 'Timestamp,Direction,Data\n';
  const body = entries
    .map((e) => {
      const escaped = e.data.replace(/"/g, '""');
      return `"${e.timestamp}","${e.direction}","${escaped}"`;
    })
    .join('\n');
  return header + body;
}

export function exportToJson(session: LogSession): string {
  return JSON.stringify(session, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateFilename(extension: string): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `serialpilot-log-${ts}.${extension}`;
}

export function parseLogText(text: string): LogEntry[] {
  const entries: LogEntry[] = [];
  const lines = text.split('\n');
  const regex = /^\[(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(TX|RX)>\s*(.*)$/;

  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      entries.push({
        timestamp: match[1],
        direction: match[2] as 'TX' | 'RX',
        data: match[3],
        is_hex: false,
      });
    }
  }
  return entries;
}

export function parseLogJson(text: string): LogEntry[] {
  try {
    const session = JSON.parse(text);
    if (session.entries && Array.isArray(session.entries)) {
      return session.entries;
    }
  } catch {
    // fall through
  }
  return [];
}

export function calculateSessionMetadata(entries: LogEntry[], startTime?: number): LogSession['metadata'] {
  let totalTxBytes = 0;
  let totalRxBytes = 0;
  let errorCount = 0;

  for (const entry of entries) {
    const byteLen = new TextEncoder().encode(entry.data).length;
    if (entry.direction === 'TX') {
      totalTxBytes += byteLen;
    } else {
      totalRxBytes += byteLen;
    }
    if (entry.data.includes('ERROR') || entry.data.includes('error')) {
      errorCount++;
    }
  }

  const duration = entries.length >= 2
    ? entries[entries.length - 1].timestamp > entries[0].timestamp
      ? parseTime(entries[entries.length - 1].timestamp) - parseTime(entries[0].timestamp)
      : 0
    : 0;

  return { totalTxBytes, totalRxBytes, duration, errorCount };
}

function parseTime(ts: string): number {
  const parts = ts.split(':');
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
  }
  return 0;
}

export interface ReplayState {
  isPlaying: boolean;
  currentIndex: number;
  speed: number;
  entries: LogEntry[];
}
