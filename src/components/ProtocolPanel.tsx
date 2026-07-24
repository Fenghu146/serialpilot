import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X } from 'lucide-react';

interface FrameField {
  name: string;
  offset: number;
  length: number;
  value: string;
  description: string;
}

interface FrameAnalysis {
  protocol: string;
  raw_hex: string;
  fields: FrameField[];
  checksum_valid: boolean | null;
  anomalies: string[];
  decoded: any;
}

const PROTOCOL_OPTIONS = [
  { value: 'auto', label: '自动检测' },
  { value: 'modbus_rtu', label: 'Modbus RTU' },
  { value: 'modbus_tcp', label: 'Modbus TCP' },
  { value: 'at_command', label: 'AT 指令' },
];

const CHECKSUM_OPTIONS = [
  { value: 'crc16_modbus', label: 'CRC16 Modbus' },
  { value: 'crc16', label: 'CRC16 CCITT' },
  { value: 'crc8', label: 'CRC8' },
  { value: 'xor8', label: 'XOR8' },
  { value: 'sum8', label: 'SUM8' },
];

export function ProtocolPanel() {
  const [hexInput, setHexInput] = useState('');
  const [protocol, setProtocol] = useState('auto');
  const [analysis, setAnalysis] = useState<FrameAnalysis | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!hexInput.trim()) return;
    setError('');
    try {
      const result = await invoke<FrameAnalysis>('analyze_frame', {
        hexData: hexInput,
        protocolHint: protocol === 'auto' ? null : protocol,
      });
      setAnalysis(result);
    } catch (e: any) {
      setError(e.toString());
      setAnalysis(null);
    }
  };

  const handleChecksum = async (algo: string) => {
    if (!hexInput.trim()) return;
    try {
      const result = await invoke<string>('compute_checksum_cmd', {
        hexData: hexInput,
        algo,
      });
      setError('');
      return result;
    } catch (e: any) {
      setError(e.toString());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-bg-secondary rounded-lg border border-border w-[600px] max-h-[80vh] flex flex-col shadow-lg animate-slide-up">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">🔍 协议分析</h2>
          <button onClick={() => { }} className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">十六进制数据</label>
            <textarea
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              placeholder="输入十六进制数据，如: 01 03 00 00 00 0A C5 CD"
              rows={3}
              className="input-field w-full py-2 text-xs font-mono resize-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-text-secondary mb-1.5">协议类型</label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                className="input-field w-full py-2 text-sm"
              >
                {PROTOCOL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAnalyze}
                disabled={!hexInput.trim()}
                className="btn-primary text-sm py-2"
              >
                分析
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2 text-xs text-accent-red">
              {error}
            </div>
          )}

          {analysis && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="badge badge-blue">{analysis.protocol}</span>
                {analysis.checksum_valid !== null && (
                  <span className={`badge ${analysis.checksum_valid ? 'badge-green' : 'badge-red'}`}>
                    CRC {analysis.checksum_valid ? '✓ 通过' : '✗ 失败'}
                  </span>
                )}
              </div>

              <div className="bg-bg-primary rounded-md p-3">
                <div className="text-xs text-text-secondary mb-1">原始数据</div>
                <div className="font-mono text-xs text-text-primary break-all">{analysis.raw_hex}</div>
              </div>

              {analysis.anomalies.length > 0 && (
                <div className="bg-accent-red/10 border border-accent-red/30 rounded-md p-3">
                  <div className="text-xs text-accent-red font-semibold mb-1">⚠️ 异常</div>
                  {analysis.anomalies.map((a, i) => (
                    <div key={i} className="text-xs text-accent-red">{a}</div>
                  ))}
                </div>
              )}

              <div className="bg-bg-primary rounded-md p-3">
                <div className="text-xs text-text-secondary mb-2">字段解析</div>
                <div className="space-y-2">
                  {analysis.fields.map((field, i) => (
                    <div key={i} className="border-b border-border pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-text-primary">{field.name}</span>
                        <span className="text-xs text-text-muted">
                          [#{field.offset}..{field.offset + field.length - 1}]
                        </span>
                        <span className="text-xs text-accent-blue ml-auto font-mono">{field.value}</span>
                      </div>
                      <div className="text-xs text-text-muted mt-0.5 whitespace-pre-line">{field.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <details className="group">
              <summary className="text-xs text-text-secondary cursor-pointer hover:text-text-primary">
                🧮 校验和计算
              </summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {CHECKSUM_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleChecksum(opt.value)}
                    disabled={!hexInput.trim()}
                    className="text-xs bg-bg-primary text-text-secondary hover:text-text-primary px-3 py-1 rounded-md border border-border disabled:opacity-50 transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
