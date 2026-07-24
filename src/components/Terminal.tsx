import { useEffect, useRef } from "react";
import { LogEntry } from "../types";

interface TerminalProps {
  logs: LogEntry[];
  onClear: () => void;
}

export function Terminal({ logs, onClear }: TerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-1 bg-bg-secondary border-b border-bg-tertiary">
        <span className="text-text-secondary text-xs">
          终端 ({logs.length} 条记录)
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
        className="flex-1 overflow-y-auto px-3 py-2 terminal-text bg-bg-primary"
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
    </div>
  );
}
