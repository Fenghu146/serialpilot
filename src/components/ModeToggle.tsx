import { useAIStore } from '../stores/aiStore';

export function ModeToggle() {
  const { mode, setMode } = useAIStore();

  return (
    <div className="flex items-center bg-bg-tertiary rounded overflow-hidden">
      <button
        onClick={() => setMode('standard')}
        className={`text-xs px-3 py-1 transition-colors ${
          mode === 'standard'
            ? 'bg-accent-blue text-white'
            : 'text-text-secondary hover:text-text-primary'
        }`}
      >
        标准
      </button>
      <button
        onClick={() => setMode('ai')}
        className={`text-xs px-3 py-1 transition-colors ${
          mode === 'ai'
            ? 'bg-accent-blue text-white'
            : 'text-text-secondary hover:text-text-primary'
        }`}
      >
        AI 模式
      </button>
    </div>
  );
}
