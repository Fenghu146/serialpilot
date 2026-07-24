import { useAIStore } from "../stores/aiStore";
import { Monitor, Sparkles } from "lucide-react";

export function ModeToggle() {
  const { mode, setMode } = useAIStore();

  return (
    <div className="flex items-center bg-bg-tertiary rounded overflow-hidden">
      <button
        onClick={() => setMode('standard')}
        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-all ${
          mode === 'standard'
            ? 'bg-accent-blue text-white shadow-sm'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        }`}
        title="标准模式"
      >
        <Monitor className="w-3 h-3" />
        标准
      </button>
      <button
        onClick={() => setMode('ai')}
        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-all ${
          mode === 'ai'
            ? 'bg-accent-blue text-white shadow-sm'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        }`}
        title="AI 协同模式"
      >
        <Sparkles className="w-3 h-3" />
        AI
      </button>
    </div>
  );
}
