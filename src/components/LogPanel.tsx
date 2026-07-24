import { useState, useRef, useEffect, useCallback } from 'react';
import { LogEntry } from '../types';
import {
  exportToTxt,
  exportToCsv,
  exportToJson,
  downloadFile,
  generateFilename,
  parseLogText,
  parseLogJson,
  calculateSessionMetadata,
  LogSession,
  ReplayState,
} from '../services/logService';

interface LogPanelProps {
  logs: LogEntry[];
  portName: string;
  config: { baud_rate: number; data_bits: string; stop_bits: string; parity: string; flow_control: string };
  onClearLogs: () => void;
  onLoadLogs: (entries: LogEntry[]) => void;
}

export function LogPanel({ logs, portName, config, onClearLogs, onLoadLogs }: LogPanelProps) {
  const [showExport, setShowExport] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [replayEntries, setReplayEntries] = useState<LogEntry[]>([]);
  const [replay, setReplay] = useState<ReplayState>({
    isPlaying: false,
    currentIndex: 0,
    speed: 1,
    entries: [],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleExportTxt = () => {
    const content = exportToTxt(logs, portName);
    downloadFile(content, generateFilename('txt'), 'text/plain');
    setShowExport(false);
  };

  const handleExportCsv = () => {
    const content = exportToCsv(logs);
    downloadFile(content, generateFilename('csv'), 'text/csv');
    setShowExport(false);
  };

  const handleExportJson = () => {
    const session: LogSession = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      portName,
      config,
      entries: logs,
      metadata: calculateSessionMetadata(logs),
    };
    const content = exportToJson(session);
    downloadFile(content, generateFilename('json'), 'application/json');
    setShowExport(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      let entries: LogEntry[] = [];

      if (file.name.endsWith('.json')) {
        entries = parseLogJson(text);
      } else if (file.name.endsWith('.txt') || file.name.endsWith('.log')) {
        entries = parseLogText(text);
      }

      if (entries.length > 0) {
        onLoadLogs(entries);
        setReplayEntries(entries);
      } else {
        alert('无法解析日志文件格式');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startReplay = useCallback(() => {
    if (replayEntries.length === 0) return;
    setReplay({
      isPlaying: true,
      currentIndex: 0,
      speed: 1,
      entries: replayEntries,
    });
    setShowReplay(true);
  }, [replayEntries]);

  const toggleReplayPlay = () => {
    setReplay((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const setReplaySpeed = (speed: number) => {
    setReplay((prev) => ({ ...prev, speed }));
  };

  const seekReplay = (index: number) => {
    setReplay((prev) => ({ ...prev, currentIndex: Math.max(0, Math.min(index, prev.entries.length - 1)) }));
  };

  useEffect(() => {
    if (!replay.isPlaying || replay.entries.length === 0) return;

    const currentEntry = replay.entries[replay.currentIndex];
    if (!currentEntry) return;

    const delay = Math.max(10, 100 / replay.speed);

    replayTimerRef.current = setTimeout(() => {
      setReplay((prev) => {
        const nextIndex = prev.currentIndex + 1;
        if (nextIndex >= prev.entries.length) {
          return { ...prev, isPlaying: false, currentIndex: prev.entries.length - 1 };
        }
        return { ...prev, currentIndex: nextIndex };
      });
    }, delay);

    return () => {
      if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
    };
  }, [replay.isPlaying, replay.currentIndex, replay.speed, replay.entries]);

  const visibleEntries = replay.entries.slice(0, replay.currentIndex + 1);
  const metadata = replay.entries.length > 0 ? calculateSessionMetadata(replay.entries) : null;

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowExport(!showExport)}
            disabled={logs.length === 0}
            className="text-text-secondary hover:text-text-primary text-xs px-2 py-0.5 rounded hover:bg-bg-tertiary disabled:opacity-50"
            title="导出日志"
          >
            📤 导出
          </button>
          {showExport && (
            <div className="absolute top-full left-0 mt-1 bg-bg-secondary border border-bg-tertiary rounded shadow-lg py-1 z-50 min-w-[120px]">
              <button onClick={handleExportTxt} className="w-full text-left text-xs text-text-primary hover:bg-bg-tertiary px-3 py-1.5">
                📄 TXT 格式
              </button>
              <button onClick={handleExportCsv} className="w-full text-left text-xs text-text-primary hover:bg-bg-tertiary px-3 py-1.5">
                📊 CSV 格式
              </button>
              <button onClick={handleExportJson} className="w-full text-left text-xs text-text-primary hover:bg-bg-tertiary px-3 py-1.5">
                📋 JSON 格式
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-text-secondary hover:text-text-primary text-xs px-2 py-0.5 rounded hover:bg-bg-tertiary"
          title="加载历史日志"
        >
          📂 加载
        </button>

        <button
          onClick={startReplay}
          disabled={logs.length === 0}
          className="text-text-secondary hover:text-text-primary text-xs px-2 py-0.5 rounded hover:bg-bg-tertiary disabled:opacity-50"
          title="复盘调试过程"
        >
          🔄 复盘
        </button>

        <button
          onClick={onClearLogs}
          className="text-text-secondary hover:text-accent-red text-xs px-2 py-0.5 rounded hover:bg-bg-tertiary"
        >
          🗑 清屏
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.json,.log,.csv"
          onChange={handleImport}
          className="hidden"
        />
      </div>

      {showReplay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-lg border border-bg-tertiary w-[700px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-bg-tertiary">
              <h2 className="text-sm font-semibold text-text-primary">🔄 日志复盘</h2>
              <button onClick={() => { setShowReplay(false); setReplay((p) => ({ ...p, isPlaying: false })); }} className="text-text-muted hover:text-text-primary">✕</button>
            </div>

            {metadata && (
              <div className="px-5 py-2 border-b border-bg-tertiary flex gap-4 text-xs text-text-secondary">
                <span>条目: {replay.entries.length}</span>
                <span>↑ TX: {metadata.totalTxBytes}B</span>
                <span>↓ RX: {metadata.totalRxBytes}B</span>
                <span>错误: {metadata.errorCount}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-2 terminal-text text-xs bg-bg-primary min-h-[200px] max-h-[400px]">
              {visibleEntries.length === 0 ? (
                <div className="text-text-muted text-center mt-8">点击播放开始复盘</div>
              ) : (
                visibleEntries.map((log, idx) => (
                  <div key={idx} className={`leading-5 ${log.direction === 'TX' ? 'text-tx' : 'text-rx'}`}>
                    <span className="text-text-muted mr-2">[{log.timestamp}]</span>
                    <span className="font-bold mr-2">{log.direction}&gt;</span>
                    <span className="break-all">{log.data}</span>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t border-bg-tertiary space-y-2">
              <div className="w-full bg-bg-primary rounded h-2 overflow-hidden">
                <div
                  className="bg-accent-blue h-full transition-all"
                  style={{ width: `${replay.entries.length > 0 ? ((replay.currentIndex + 1) / replay.entries.length) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => seekReplay(0)} className="text-text-secondary hover:text-text-primary text-xs">⏮</button>
                <button onClick={() => seekReplay(replay.currentIndex - 1)} className="text-text-secondary hover:text-text-primary text-xs">◀</button>
                <button onClick={toggleReplayPlay} className="bg-accent-blue text-white text-xs px-3 py-1 rounded">
                  {replay.isPlaying ? '⏸ 暂停' : '▶ 播放'}
                </button>
                <button onClick={() => seekReplay(replay.currentIndex + 1)} className="text-text-secondary hover:text-text-primary text-xs">▶</button>
                <button onClick={() => seekReplay(replay.entries.length - 1)} className="text-text-secondary hover:text-text-primary text-xs">⏭</button>
                <span className="text-text-muted text-xs ml-2">
                  {replay.currentIndex + 1} / {replay.entries.length}
                </span>
                <select
                  value={replay.speed}
                  onChange={(e) => setReplaySpeed(Number(e.target.value))}
                  className="bg-bg-primary text-text-primary text-xs rounded px-2 py-0.5 border-0 ml-auto"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={5}>5x</option>
                  <option value={10}>10x</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
