import { useEffect, useRef, useState } from "react";
import { LogEntry } from "../types";
import { useAIStore } from "../stores/aiStore";

interface TerminalProps {
  logs: LogEntry[];
  onClear: () => void;
  onTextSelected?: (text: string) => void;
}

export function Terminal({ logs, onClear, onTextSelected }: TerminalProps) {
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
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-1 bg-bg-secondary border-b border-bg-tertiary">
        <span className="text-text-secondary text-xs">
          终端 ({logs.length} 条记录)
          {mode === 'ai' && <span className="ml-2 text-accent-blue">· 选中日志可提交 AI</span>}
        </span>
        <button
          onClick={onClear}
          className="text-text-secondary hover:text-accent-red text-xs px-2 py-0.5 rounded hover:bg-bg-tertiary"
        >
          清屏
        </button>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        className="flex-1 overflow-y-auto px-3 py-2 terminal-text bg-bg-primary select-text"
      >
        {logs.length === 0 ? (
          <div className="text-text-muted text-center mt-10">
            暂无数据，请连接串口后开始通信
          </div>
        ) : (
          logs.map((log, idx) => (
            <div
              key={idx}
              className={`leading-6 ${
                log.direction === "TX" ? "text-tx" : "text-rx"
              }`}
            >
              <span className="text-text-muted mr-2">[{log.timestamp}]</span>
              <span className="font-bold mr-2">{log.direction}&gt;</span>
              <span className="break-all">{log.data}</span>
            </div>
          ))
        )}
      </div>

      {contextMenu && mode === 'ai' && (
        <div
          className="fixed z-50 bg-bg-secondary border border-bg-tertiary rounded shadow-lg py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleSubmitToAI}
            className="w-full text-left text-xs text-text-primary hover:bg-bg-tertiary px-4 py-1.5"
          >
            🤖 提交 AI 分析
          </button>
          <button
            onClick={handleCopy}
            className="w-full text-left text-xs text-text-primary hover:bg-bg-tertiary px-4 py-1.5"
          >
            📋 复制
          </button>
        </div>
      )}
    </div>
  );
}
