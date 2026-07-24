import { useState } from "react";
import { PortInfo, PortConfig, BAUD_RATES, PARITY_OPTIONS, FLOW_CONTROL_OPTIONS } from "../types";

interface PortPanelProps {
  ports: PortInfo[];
  selectedPort: string;
  config: PortConfig;
  connected: boolean;
  onPortSelect: (port: string) => void;
  onConfigChange: (config: PortConfig) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
}

export function PortPanel({
  ports,
  selectedPort,
  config,
  connected,
  onPortSelect,
  onConfigChange,
  onConnect,
  onDisconnect,
  onRefresh,
}: PortPanelProps) {
  const updateConfig = (key: keyof PortConfig, value: string | number) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border-b border-bg-tertiary">
      <div className="flex items-center gap-1">
        <label className="text-text-secondary text-xs">端口:</label>
        <select
          value={selectedPort}
          onChange={(e) => onPortSelect(e.target.value)}
          disabled={connected}
          className="bg-bg-tertiary text-text-primary text-sm rounded px-2 py-1 border-0 min-w-[140px] disabled:opacity-50"
        >
          <option value="">选择串口</option>
          {ports.map((p) => (
            <option key={p.port_name} value={p.port_name}>
              {p.port_name} {p.product ? `(${p.product})` : ""}
            </option>
          ))}
        </select>
        <button
          onClick={onRefresh}
          className="text-text-secondary hover:text-text-primary text-sm px-1"
          title="刷新串口列表"
        >
          ↻
        </button>
      </div>

      <div className="flex items-center gap-1">
        <label className="text-text-secondary text-xs">波特率:</label>
        <select
          value={config.baud_rate}
          onChange={(e) => updateConfig("baud_rate", Number(e.target.value))}
          disabled={connected}
          className="bg-bg-tertiary text-text-primary text-sm rounded px-2 py-1 border-0 disabled:opacity-50"
        >
          {BAUD_RATES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <label className="text-text-secondary text-xs">数据位:</label>
        <select
          value={config.data_bits}
          onChange={(e) => updateConfig("data_bits", e.target.value)}
          disabled={connected}
          className="bg-bg-tertiary text-text-primary text-sm rounded px-2 py-1 border-0 w-14 disabled:opacity-50"
        >
          {["5", "6", "7", "8"].map((d) => (
            <option key={d} value={d === "5" ? "Five" : d === "6" ? "Six" : d === "7" ? "Seven" : "Eight"}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <label className="text-text-secondary text-xs">停止位:</label>
        <select
          value={config.stop_bits}
          onChange={(e) => updateConfig("stop_bits", e.target.value)}
          disabled={connected}
          className="bg-bg-tertiary text-text-primary text-sm rounded px-2 py-1 border-0 w-12 disabled:opacity-50"
        >
          <option value="One">1</option>
          <option value="Two">2</option>
        </select>
      </div>

      <div className="flex items-center gap-1">
        <label className="text-text-secondary text-xs">校验:</label>
        <select
          value={config.parity}
          onChange={(e) => updateConfig("parity", e.target.value)}
          disabled={connected}
          className="bg-bg-tertiary text-text-primary text-sm rounded px-2 py-1 border-0 w-16 disabled:opacity-50"
        >
          {PARITY_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <label className="text-text-secondary text-xs">流控:</label>
        <select
          value={config.flow_control}
          onChange={(e) => updateConfig("flow_control", e.target.value)}
          disabled={connected}
          className="bg-bg-tertiary text-text-primary text-sm rounded px-2 py-1 border-0 w-20 disabled:opacity-50"
        >
          {FLOW_CONTROL_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="ml-auto">
        {!connected ? (
          <button
            onClick={onConnect}
            disabled={!selectedPort}
            className="bg-accent-green hover:bg-green-600 text-white text-sm px-4 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            连接
          </button>
        ) : (
          <button
            onClick={onDisconnect}
            className="bg-accent-red hover:bg-red-600 text-white text-sm px-4 py-1 rounded"
          >
            断开
          </button>
        )}
      </div>
    </div>
  );
}
