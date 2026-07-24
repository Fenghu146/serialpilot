import { useState, useRef, useEffect } from "react";
import { WriteMode } from "../types";
import { Send, Clock, History, ChevronUp, ChevronDown } from "lucide-react";

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
  const [showHistory, setShowHistory] = useState(false);
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
    <div className="border-t border-border bg-bg-secondary animate-slide-up">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <label className="flex items-center gap-1.5 text-text-secondary text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={hexMode}
            onChange={(e) => {
              setHexMode(e.target.checked);
              setMode(e.target.checked ? "Hex" : "Text");
            }}
            className="accent-accent-blue w-3 h-3"
          />
          HEX
        </label>
        <label className="flex items-center gap-1.5 text-text-secondary text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={timedSend}
            onChange={(e) => setTimedSend(e.target.checked)}
            className="accent-accent-blue w-3 h-3"
          />
          <Clock className="w-3 h-3" />
          定时
        </label>
        {timedSend && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={interval}
              onChange={(e) => setInterval_(Math.max(10, Number(e.target.value)))}
              className="input-field w-16 py-0.5 text-xs"
              min={10}
              step={100}
            />
            <span className="text-text-muted text-xs">ms</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-text-muted hover:text-text-primary text-xs transition-colors"
          >
            <History className="w-3 h-3" />
            历史 ({history.length})
            {showHistory ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* History Dropdown */}
      {showHistory && history.length > 0 && (
        <div className="max-h-[120px] overflow-y-auto border-b border-border bg-bg-primary">
          {history.slice().reverse().map((h) => (
            <button
              key={h.id}
              onClick={() => { setInput(h.data); setMode(h.mode); setShowHistory(false); }}
              className="w-full text-left px-4 py-1.5 text-xs text-text-primary hover:bg-bg-secondary flex items-center gap-2"
            >
              <span className="text-text-muted font-mono">[{h.timestamp}]</span>
              <span className={`badge ${h.mode === 'Hex' ? 'badge-blue' : 'badge-green'} text-[9px]`}>
                {h.mode}
              </span>
              <span className="truncate">{h.data}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex gap-3 px-4 py-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "请先连接串口" : "输入要发送的数据... (Ctrl+Enter 发送)"}
          disabled={disabled}
          className="flex-1 input-field resize-none min-h-[48px] max-h-[100px] py-2 font-mono text-xs disabled:opacity-50"
          rows={2}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="btn-primary self-end flex items-center gap-1.5 text-xs h-[36px]"
        >
          <Send className="w-3 h-3" />
          发送
        </button>
      </div>
    </div>
  );
}
