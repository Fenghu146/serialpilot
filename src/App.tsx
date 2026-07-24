import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { PortInfo, PortConfig, WriteMode, LogEntry, ConnectionStatus } from "./types";
import { PortPanel } from "./components/PortPanel";
import { Terminal } from "./components/Terminal";
import { SendPanel } from "./components/SendPanel";
import { StatusBar } from "./components/StatusBar";

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
  const unlistenRef = useRef<(() => void) | null>(null);

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
        unlistenRef.current = unlisten;
      } catch (e) {
        console.error("Failed to listen:", e);
      }
    };
    setupListener();
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleConnect = async () => {
    if (!selectedPort) return;
    try {
      await invoke("open_port", { portName: selectedPort, config });
      setConnected(true);
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

  return (
    <div className="h-full flex flex-col bg-bg-primary">
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
      <Terminal logs={logs} onClear={handleClearLogs} />
      <SendPanel onSend={handleSend} disabled={!connected} />
      <StatusBar connected={connected} portName={selectedPort} config={config} stats={bytesStats} />
    </div>
  );
}

export default App;
