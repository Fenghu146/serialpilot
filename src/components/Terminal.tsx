import { useEffect, useRef, useState } from "react";
import { LogEntry, PortConfig } from "../types";
import { useAIStore } from "../stores/aiStore";
import { LogPanel } from "./LogPanel";
import { Trash2, Copy } from "lucide-react";

interface TerminalProps {
  logs: LogEntry[];
  onClear: () => void;
  onTextSelected?: (text: string) => void;
  onLoadLogs?: (entries: LogEntry[]) => void;
  portName?: string;
  config?: PortConfig;
  onOpenProtocol?: () => void;
  onOpenScript?: () => void;
}

export function Terminal({ logs, onClear, onTextSelected, onLoadLogs, portName, config, onOpenProtocol, onOpenScript }: TerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const { mode } = useAIStore();

  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
    }
  };

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      onTextSelected?.(selection.toString().trim());
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (mode !== 'ai') return;
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  const handleSubmitToAI = () => {
    const selection = window.getSelection();
    if (selection && onTextSelected) {
      onTextSelected(selection.toString().trim());
    }
    setContextMenu(null);
  };

  const handleCopy = () => {
    const selection = window.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection.toString());
    }
    setContextMenu(null);
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse-slow" />
          <span className="text-text-secondary text-xs font-medium">
            终端
          </span>
          <span className="text-text-muted text-xs">
            ({logs.length} 条记录)
          </span>
          {mode === 'ai' && (
            <span className="badge badge-blue text-[10px]">AI 就绪</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onLoadLogs && portName && config && (
            <LogPanel
              logs={logs}
              portName={portName}
              config={config}
              onClearLogs={onClear}
              onLoadLogs={onLoadLogs}
              onOpenProtocol={onOpenProtocol}
              onOpenScript={onOpenScript}
            />
          )}
          <button
            onClick={onClear}
            className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-accent-red transition-colors"
            title="清屏"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        className="flex-1 overflow-y-auto px-4 py-3 terminal-text bg-bg-primary select-text"
      >
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <div className="text-3xl mb-3">📟</div>
            <p className="text-sm">暂无数据</p>
            <p className="text-xs mt-1">请连接串口后开始通信</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className={`leading-6 py-0.5 px-2 rounded-sm hover:bg-bg-secondary/50 transition-colors ${
                  log.direction === "TX" ? "text-tx" : "text-rx"
                }`}
              >
                <span className="text-text-muted mr-2 font-mono text-[11px]">[{log.timestamp}]</span>
                <span className="font-bold mr-2 text-[11px]">{log.direction}&gt;</span>
                <span className="break-all">{log.data}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && mode === 'ai' && (
        <div
          className="fixed z-50 bg-bg-secondary border border-border rounded-md shadow-lg py-1 animate-slide-down"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleSubmitToAI}
            className="w-full text-left text-xs text-text-primary hover:bg-bg-hover px-4 py-2 flex items-center gap-2"
          >
            🤖 提交 AI 分析
          </button>
          <button
            onClick={handleCopy}
            className="w-full text-left text-xs text-text-primary hover:bg-bg-hover px-4 py-2 flex items-center gap-2"
          >
            <Copy className="w-3 h-3" /> 复制
          </button>
        </div>
      )}
    </div>
  );
}
