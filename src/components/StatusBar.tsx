import { PortConfig } from "../types";

interface StatusBarProps {
  connected: boolean;
  portName: string;
  config: PortConfig;
  stats: { sent: number; received: number };
}

export function StatusBar({ connected, portName, config, stats }: StatusBarProps) {
  return (
    <div className="flex items-center gap-4 px-3 py-1 bg-bg-secondary border-t border-bg-tertiary text-xs text-text-secondary">
      <span className="flex items-center gap-1">
        <span
          className={`w-2 h-2 rounded-full ${
            connected ? "bg-accent-green animate-pulse" : "bg-accent-red"
          }`}
        />
        {connected ? "已连接" : "未连接"}
      </span>
      {connected && (
        <>
          <span>{portName}</span>
          <span>
            {config.baud_rate} {config.data_bits}
            {config.parity[0]}
            {config.stop_bits === "One" ? "1" : "2"}
          </span>
          <span>↑ {formatBytes(stats.sent)}</span>
          <span>↓ {formatBytes(stats.received)}</span>
        </>
      )}
      <span className="ml-auto text-text-muted">SerialPilot v0.1.0</span>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
