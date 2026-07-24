import { useThemeStore } from '../stores/themeStore';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { mode, setMode } = useThemeStore();

  return (
    <div className="flex items-center bg-bg-tertiary rounded overflow-hidden">
      <button
        onClick={() => setMode('light')}
        className={`p-1.5 transition-all ${
          mode === 'light'
            ? 'bg-accent-blue text-white shadow-sm'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        }`}
        title="浅色模式"
      >
        <Sun className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => setMode('dark')}
        className={`p-1.5 transition-all ${
          mode === 'dark'
            ? 'bg-accent-blue text-white shadow-sm'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        }`}
        title="深色模式"
      >
        <Moon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
