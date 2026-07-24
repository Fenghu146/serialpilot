import { useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Play, FileCode } from 'lucide-react';

interface ScriptResult {
  success: boolean;
  output: string[];
  test_results: Array<{ name: string; passed: boolean; message: string; duration_ms: number }>;
  duration_ms: number;
  error: string | null;
}

interface ScriptEditorProps {
  onClose: () => void;
  disabled: boolean;
}

const EXAMPLE_SCRIPT = `{
  "name": "ESP32 AT 测试",
  "description": "测试 ESP32 基本 AT 指令",
  "steps": [
    { "action": "print", "message": "开始 ESP32 测试" },
    { "action": "send", "data": "AT\\r\\n", "description": "测试连接" },
    { "action": "wait", "ms": 500, "description": "等待响应" },
    { "action": "assert_response", "contains": "OK", "description": "检查 AT 应答" },
    { "action": "send", "data": "AT+GMR\\r\\n", "description": "查询版本" },
    { "action": "wait", "ms": 1000, "description": "等待版本信息" },
    { "action": "assert_response", "contains": "version", "description": "检查版本信息" },
    { "action": "print", "message": "测试完成" }
  ]
}`;

export function ScriptEditor({ onClose, disabled }: ScriptEditorProps) {
  const [script, setScript] = useState(EXAMPLE_SCRIPT);
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [running, setRunning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleRun = async () => {
    if (!script.trim() || disabled) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await invoke<ScriptResult>('run_script', { script });
      setResult(res);
    } catch (e: any) {
      setResult({
        success: false,
        output: [],
        test_results: [],
        duration_ms: 0,
        error: e.toString(),
      });
    }
    setRunning(false);
  };

  const handleLoadExample = () => {
    setScript(EXAMPLE_SCRIPT);
    setResult(null);
  };

  const passedCount = result?.test_results.filter((t) => t.passed).length || 0;
  const totalCount = result?.test_results.length || 0;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-bg-secondary rounded-lg border border-border w-[700px] max-h-[85vh] flex flex-col shadow-lg animate-slide-up">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-accent-blue" />
            <h2 className="text-sm font-semibold text-text-primary">脚本自动化测试</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadExample}
              className="text-text-secondary hover:text-text-primary text-xs px-2 py-1 rounded hover:bg-bg-hover transition-colors"
            >
              加载示例
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              JSON 脚本 {disabled && <span className="text-accent-red">（请先连接串口）</span>}
            </label>
            <textarea
              ref={textareaRef}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={12}
              disabled={disabled}
              className="input-field w-full py-2 text-xs font-mono resize-none disabled:opacity-50"
              spellCheck={false}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRun}
              disabled={running || disabled || !script.trim()}
              className="btn-primary flex items-center gap-1.5 text-xs"
            >
              <Play className="w-3 h-3" />
              {running ? '运行中...' : '运行脚本'}
            </button>
            <span className="text-xs text-text-muted">
              支持: send, send_hex, wait, assert_response, assert_equal, print
            </span>
          </div>

          {result && (
            <div className="space-y-3 animate-slide-up">
              <div className={`flex items-center gap-2 text-xs ${result.success ? 'text-accent-green' : 'text-accent-red'}`}>
                <span>{result.success ? '✓' : '✗'}</span>
                <span className="font-semibold">
                  {result.success ? '脚本执行成功' : '脚本执行失败'}
                </span>
                <span className="text-text-muted">({result.duration_ms}ms)</span>
              </div>

              {result.error && (
                <div className="bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2 text-xs text-accent-red">
                  {result.error}
                </div>
              )}

              {result.output.length > 0 && (
                <div className="bg-bg-primary rounded-md p-3">
                  <div className="text-xs text-text-secondary mb-1">执行输出</div>
                  <div className="font-mono text-xs text-text-primary space-y-0.5 max-h-[150px] overflow-y-auto">
                    {result.output.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                </div>
              )}

              {result.test_results.length > 0 && (
                <div className="bg-bg-primary rounded-md p-3">
                  <div className="text-xs text-text-secondary mb-2">
                    测试结果: {passedCount}/{totalCount} 通过
                  </div>
                  <div className="space-y-1">
                    {result.test_results.map((tr, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={tr.passed ? 'text-accent-green' : 'text-accent-red'}>
                          {tr.passed ? '✓' : '✗'}
                        </span>
                        <span className="text-text-primary">{tr.name}</span>
                        <span className="text-text-muted">- {tr.message}</span>
                        <span className="text-text-muted ml-auto">{tr.duration_ms}ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
