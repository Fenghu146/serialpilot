import { useState } from 'react';
import { useAIStore } from '../../stores/aiStore';
import { AI_MODELS, ENDPOINT_PRESETS } from '../../services/ai-service';

export function AISettings() {
  const { config, updateConfig, setSettingsOpen } = useAIStore();
  const [showKey, setShowKey] = useState(false);

  const handleProviderChange = (provider: string) => {
    const endpoint = ENDPOINT_PRESETS[provider] || '';
    const models = AI_MODELS[provider]?.models || [];
    updateConfig({
      provider: provider as any,
      endpoint,
      model: models[0] || '',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bg-secondary rounded-lg border border-bg-tertiary w-[480px] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-tertiary">
          <h2 className="text-sm font-semibold text-text-primary">AI 设置</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="text-text-muted hover:text-text-primary text-lg"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1">服务商</label>
            <select
              value={config.provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full bg-bg-primary text-text-primary text-sm rounded px-3 py-2 border-0"
            >
              {Object.entries(AI_MODELS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">模型</label>
            <select
              value={config.model}
              onChange={(e) => updateConfig({ model: e.target.value })}
              className="w-full bg-bg-primary text-text-primary text-sm rounded px-3 py-2 border-0"
            >
              {(AI_MODELS[config.provider]?.models || []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">API 端点</label>
            <input
              type="text"
              value={config.endpoint}
              onChange={(e) => updateConfig({ endpoint: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full bg-bg-primary text-text-primary text-sm rounded px-3 py-2 border-0 placeholder:text-text-muted"
            />
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">API 密钥</label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => updateConfig({ apiKey: e.target.value })}
                placeholder="sk-..."
                className="flex-1 bg-bg-primary text-text-primary text-sm rounded px-3 py-2 border-0 placeholder:text-text-muted"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="bg-bg-tertiary text-text-secondary text-xs px-3 rounded hover:bg-bg-primary"
              >
                {showKey ? '隐藏' : '显示'}
              </button>
            </div>
            {config.provider === 'ollama' && (
              <p className="text-xs text-text-muted mt-1">Ollama 本地运行无需 API 密钥</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">上下文日志数</label>
            <input
              type="number"
              value={config.maxContextLogs}
              onChange={(e) => updateConfig({ maxContextLogs: Number(e.target.value) })}
              min={5}
              max={100}
              className="w-full bg-bg-primary text-text-primary text-sm rounded px-3 py-2 border-0"
            />
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">自定义 System Prompt（可选）</label>
            <textarea
              value={config.systemPrompt}
              onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
              placeholder="留空使用默认提示词..."
              rows={3}
              className="w-full bg-bg-primary text-text-primary text-xs rounded px-3 py-2 border-0 resize-none placeholder:text-text-muted"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-bg-tertiary">
          <button
            onClick={() => setSettingsOpen(false)}
            className="bg-accent-blue hover:bg-blue-600 text-white text-sm px-4 py-1.5 rounded"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
