import { PortInfo, PortConfig, BAUD_RATES, PARITY_OPTIONS, FLOW_CONTROL_OPTIONS } from "../types";
import { Cable, RefreshCw } from "lucide-react";

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
    <div className="flex items-center gap-3 flex-wrap">
      {/* Port Selection */}
      <div className="flex items-center gap-1.5">
        <Cable className="w-3.5 h-3.5 text-text-muted" />
        <select
          value={selectedPort}
          onChange={(e) => onPortSelect(e.target.value)}
          disabled={connected}
          className="select-field min-w-[130px] py-1 text-xs"
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
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          title="刷新串口列表"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Baud Rate */}
      <div className="flex items-center gap-1">
        <span className="text-text-muted text-xs">波特率</span>
        <select
          value={config.baud_rate}
          onChange={(e) => updateConfig("baud_rate", Number(e.target.value))}
          disabled={connected}
          className="select-field py-1 w-[80px] text-xs"
        >
          {BAUD_RATES.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {/* Data Bits */}
      <div className="flex items-center gap-1">
        <span className="text-text-muted text-xs">数据</span>
        <select
          value={config.data_bits}
          onChange={(e) => updateConfig("data_bits", e.target.value)}
          disabled={connected}
          className="select-field py-1 w-[48px] text-xs"
        >
          {["5", "6", "7", "8"].map((d) => (
            <option key={d} value={d === "5" ? "Five" : d === "6" ? "Six" : d === "7" ? "Seven" : "Eight"}>{d}</option>
          ))}
        </select>
      </div>

      {/* Stop Bits */}
      <div className="flex items-center gap-1">
        <span className="text-text-muted text-xs">停止</span>
        <select
          value={config.stop_bits}
          onChange={(e) => updateConfig("stop_bits", e.target.value)}
          disabled={connected}
          className="select-field py-1 w-[40px] text-xs"
        >
          <option value="One">1</option>
          <option value="Two">2</option>
        </select>
      </div>

      {/* Parity */}
      <div className="flex items-center gap-1">
        <span className="text-text-muted text-xs">校验</span>
        <select
          value={config.parity}
          onChange={(e) => updateConfig("parity", e.target.value)}
          disabled={connected}
          className="select-field py-1 w-[52px] text-xs"
        >
          {PARITY_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Flow Control */}
      <div className="flex items-center gap-1">
        <span className="text-text-muted text-xs">流控</span>
        <select
          value={config.flow_control}
          onChange={(e) => updateConfig("flow_control", e.target.value)}
          disabled={connected}
          className="select-field py-1 w-[60px] text-xs"
        >
          {FLOW_CONTROL_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Connect Button */}
      <div className="ml-auto">
        {!connected ? (
          <button
            onClick={onConnect}
            disabled={!selectedPort}
            className="btn-primary flex items-center gap-1.5 text-xs"
          >
            <Cable className="w-3 h-3" />
            连接
          </button>
        ) : (
          <button
            onClick={onDisconnect}
            className="btn-secondary !bg-accent-red/10 !text-accent-red hover:!bg-accent-red/20 flex items-center gap-1.5 text-xs"
          >
            <Cable className="w-3 h-3" />
            断开
          </button>
        )}
      </div>
    </div>
  );
}
