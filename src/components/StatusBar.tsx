import { PortConfig } from "../types";
import { Activity, ArrowUp, ArrowDown } from "lucide-react";

interface StatusBarProps {
  connected: boolean;
  portName: string;
  config: PortConfig;
  stats: { sent: number; received: number };
}

export function StatusBar({ connected, portName, config, stats }: StatusBarProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-bg-secondary border-t border-border text-xs text-text-muted">
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${connected ? "bg-accent-green animate-pulse-slow" : "bg-accent-red"}`} />
        <span className={connected ? "text-accent-green" : "text-accent-red"}>
          {connected ? "已连接" : "未连接"}
        </span>
      </div>

      {connected && (
        <>
          <span className="text-border">│</span>
          <span className="font-mono text-text-secondary">{portName}</span>
          <span className="badge badge-blue text-[10px]">
            {config.baud_rate} {config.data_bits}{config.parity[0]}{config.stop_bits === "One" ? "1" : "2"}
          </span>
          <span className="text-border">│</span>
          <span className="flex items-center gap-1 text-tx">
            <ArrowUp className="w-3 h-3" />
            {formatBytes(stats.sent)}
          </span>
          <span className="flex items-center gap-1 text-rx">
            <ArrowDown className="w-3 h-3" />
            {formatBytes(stats.received)}
          </span>
        </>
      )}

      <span className="ml-auto flex items-center gap-1 text-text-muted">
        <Activity className="w-3 h-3" />
        SerialPilot v0.1.0
      </span>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
