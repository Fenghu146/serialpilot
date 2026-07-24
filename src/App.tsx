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

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const setupListener = async () => {
      try {
        unlisten = await listen<LogEntry>("serial:data", (event) => {
          setLogs((prev) => [...prev.slice(-2000), event.payload]);
        });
      } catch (e) {
        console.error("Failed to listen:", e);
      }
    };
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

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
        />
        <SendPanel onSend={handleSend} disabled={!connected} />
        <StatusBar connected={connected} portName={selectedPort} config={config} stats={bytesStats} />
      </div>
      {mode === 'ai' && <AICopilotPanel />}
      {settingsOpen && <AISettings />}
    </div>
  );
}

export default App;
