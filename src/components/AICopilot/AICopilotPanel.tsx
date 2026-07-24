import { useAIStore } from '../../stores/aiStore';
import { AIChat } from './AIChat';
import { Sparkles } from 'lucide-react';

export function AICopilotPanel() {
  const { boardProfile, setSettingsOpen } = useAIStore();

  return (
    <div className="w-96 flex flex-col bg-bg-secondary border-l border-bg-tertiary h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bg-tertiary bg-bg-primary">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent-blue" />
          <span className="text-sm font-semibold text-text-primary">AI Copilot</span>
        </div>
        <div className="flex items-center gap-2">
          {boardProfile && (
            <span className="text-xs bg-bg-tertiary text-text-secondary px-2 py-0.5 rounded">
              {boardProfile.name}
            </span>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-text-muted hover:text-text-primary text-sm p-1 rounded hover:bg-bg-tertiary"
            title="AI 设置"
          >
            ⚙
          </button>
        </div>
      </div>
      <AIChat />
    </div>
  );
}
