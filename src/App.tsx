import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { PortInfo, PortConfig, WriteMode, LogEntry, ConnectionStatus } from "./types";
import { PortPanel } from "./components/PortPanel";
import { Terminal } from "./components/Terminal";
import { SendPanel } from "./components/SendPanel";
import { StatusBar } from "./components/StatusBar";
import { ModeToggle } from "./components/ModeToggle";
import { AICopilotPanel } from "./components/AICopilot/AICopilotPanel";
import { AISettings } from "./components/AICopilot/AISettings";
import { useAIStore } from "./stores/aiStore";
import { detectBoardProfile } from "./services/boardProfileService";
import { ProtocolPanel } from "./components/ProtocolPanel";
import { ScriptEditor } from "./components/ScriptEditor/ScriptEditor";
import { McpStatus } from "./components/McpStatus";
import { ThemeToggle } from "./components/ThemeToggle";

/** 终端保留的最大日志条数，超出后丢弃最旧记录。 */
const MAX_LOG_ENTRIES = 2000;

function App() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>("");
  const [config, setConfig] = useState<PortConfig>({
    baud_rate: 115200,
    data_bits: "Eight",
    stop_bits: "One",
    parity: "None",
    flow_control: "None",
  });
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [bytesStats, setBytesStats] = useState({ sent: 0, received: 0 });

  const { mode, settingsOpen, setSelectedText, setBoardProfile } = useAIStore();
  const [showProtocol, setShowProtocol] = useState(false);
  const [showScript, setShowScript] = useState(false);

  const refreshPorts = useCallback(async () => {
    try {
      const result = await invoke<PortInfo[]>("list_ports");
      setPorts(result);
    } catch (e) {
      console.error("枚举串口失败:", e);
    }
  }, []);

  useEffect(() => {
    refreshPorts().catch(console.error);
    const interval = setInterval(() => refreshPorts().catch(console.error), 3000);
    return () => clearInterval(interval);
  }, [refreshPorts]);

  // 订阅后端串口数据事件，并限制日志条数避免内存无限增长
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const setupListener = async () => {
      try {
        unlisten = await listen<LogEntry>("serial:data", (event) => {
          setLogs((prev) => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), event.payload]);
        });
      } catch (e) {
        console.error("注册串口数据监听失败:", e);
      }
    };
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // 连接期间轮询后端收发统计，驱动状态栏的 TX/RX 计数
  useEffect(() => {
    if (!connected) {
      setBytesStats({ sent: 0, received: 0 });
      return;
    }

    let active = true;
    const syncStats = async () => {
      try {
        const status = await invoke<ConnectionStatus>("get_connection_status");
        if (active) {
          setBytesStats({ sent: status.bytes_sent, received: status.bytes_received });
        }
      } catch (e) {
        console.error("获取连接状态失败:", e);
      }
    };

    syncStats();
    const timer = setInterval(syncStats, 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [connected]);

  const handleConnect = async () => {
    if (!selectedPort) return;
    try {
      await invoke("open_port", { portName: selectedPort, config });
      setConnected(true);

      const port = ports.find((p) => p.port_name === selectedPort);
      if (port) {
        const profile = detectBoardProfile({
          manufacturer: port.manufacturer,
          product: port.product,
          vid: port.vid,
          pid: port.pid,
        });
        if (profile) {
          setBoardProfile(profile);
        }
      }
    } catch (e) {
      alert(`连接失败: ${e}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      await invoke("close_port");
      setConnected(false);
    } catch (e) {
      alert(`断开失败: ${e}`);
    }
  };

  const handleSend = async (data: string, mode: WriteMode) => {
    try {
      await invoke("write_port", { data, mode });
    } catch (e) {
      alert(`发送失败: ${e}`);
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleTextSelected = (text: string) => {
    setSelectedText(text);
  };

  return (
    <div className={`h-full flex ${mode === 'ai' ? 'flex-row' : 'flex-col'}`}>
      <div className={`flex-1 flex flex-col min-h-0 ${mode === 'ai' ? 'min-w-0' : ''}`}>
        <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border-b border-bg-tertiary">
          <PortPanel
            ports={ports}
            selectedPort={selectedPort}
            config={config}
            connected={connected}
            onPortSelect={setSelectedPort}
            onConfigChange={setConfig}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onRefresh={refreshPorts}
          />
          <div className="ml-auto flex items-center gap-2">
            <McpStatus />
            <ThemeToggle />
            <ModeToggle />
          </div>
        </div>
        <Terminal
          logs={logs}
          onClear={handleClearLogs}
          onTextSelected={handleTextSelected}
          onLoadLogs={(entries) => setLogs(entries)}
          portName={selectedPort}
          config={config}
          onOpenProtocol={() => setShowProtocol(true)}
          onOpenScript={() => setShowScript(true)}
        />
        <SendPanel onSend={handleSend} disabled={!connected} />
        <StatusBar connected={connected} portName={selectedPort} config={config} stats={bytesStats} />
      </div>
      {mode === 'ai' && <AICopilotPanel />}
      {settingsOpen && <AISettings />}
      {showProtocol && <ProtocolPanel onClose={() => setShowProtocol(false)} />}
      {showScript && <ScriptEditor onClose={() => setShowScript(false)} disabled={!connected} />}
    </div>
  );
}

export default App;
