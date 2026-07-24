import { useState, useRef, useEffect } from "react";
import { WriteMode } from "../types";

interface SendPanelProps {
  onSend: (data: string, mode: WriteMode) => void;
  disabled: boolean;
}

interface HistoryEntry {
  id: number;
  data: string;
  mode: WriteMode;
  timestamp: string;
}

export function SendPanel({ onSend, disabled }: SendPanelProps) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<WriteMode>("Text");
  const [hexMode, setHexMode] = useState(false);
  const [timedSend, setTimedSend] = useState(false);
  const [interval, setInterval_] = useState(1000);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (timedSend && !disabled && input) {
      intervalRef.current = setInterval(() => {
        onSend(input, mode);
      }, interval);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timedSend, interval, input, mode, disabled, onSend]);

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input, mode);
    setHistory((prev) => [
      ...prev.slice(-99),
      { id: Date.now(), data: input, mode, timestamp: new Date().toLocaleTimeString() },
    ]);
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "ArrowUp" && history.length > 0) {
      e.preventDefault();
      const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
      setHistoryIndex(newIndex);
      setInput(history[history.length - 1 - newIndex]?.data || "");
    }
    if (e.key === "ArrowDown" && historyIndex >= 0) {
      e.preventDefault();
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setInput(newIndex >= 0 ? history[history.length - 1 - newIndex]?.data || "" : "");
    }
  };

  return (
    <div className="border-t border-bg-tertiary bg-bg-secondary">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-bg-tertiary">
        <label className="flex items-center gap-1 text-text-secondary text-xs">
          <input
            type="checkbox"
            checked={hexMode}
            onChange={(e) => {
              setHexMode(e.target.checked);
              setMode(e.target.checked ? "Hex" : "Text");
            }}
            className="accent-accent-blue"
          />
          HEX
        </label>
        <label className="flex items-center gap-1 text-text-secondary text-xs">
          <input
            type="checkbox"
            checked={timedSend}
            onChange={(e) => setTimedSend(e.target.checked)}
            className="accent-accent-blue"
          />
          定时发送
        </label>
        {timedSend && (
          <>
            <input
              type="number"
              value={interval}
              onChange={(e) => setInterval_(Math.max(10, Number(e.target.value)))}
              className="bg-bg-tertiary text-text-primary text-xs rounded px-2 py-0.5 w-20 border-0"
              min={10}
              step={100}
            />
            <span className="text-text-muted text-xs">ms</span>
          </>
        )}
        <span className="text-text-muted text-xs ml-2">
          历史: {history.length} 条
        </span>
        <span className="text-text-muted text-xs ml-auto">
          Ctrl+Enter 发送 | ↑↓ 历史
        </span>
      </div>
      <div className="flex gap-2 px-3 py-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "请先连接串口" : "输入要发送的数据..."}
          disabled={disabled}
          className="flex-1 bg-bg-primary text-text-primary text-sm rounded px-3 py-2 border-0 resize-none min-h-[60px] max-h-[120px] placeholder:text-text-muted disabled:opacity-50 terminal-text"
          rows={2}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="bg-accent-blue hover:bg-blue-600 text-white text-sm px-6 py-2 rounded self-end disabled:opacity-50 disabled:cursor-not-allowed"
        >
          发送
        </button>
      </div>
    </div>
  );
}
