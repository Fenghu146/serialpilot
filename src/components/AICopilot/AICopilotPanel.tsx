import { useState, useEffect, useRef } from 'react';
import { useAIStore } from '../../stores/aiStore';
import { Sparkles, Settings } from 'lucide-react';

export function AICopilotPanel() {
  const { boardProfile, setSettingsOpen } = useAIStore();

  return (
    <div className="w-96 flex flex-col bg-bg-secondary border-l border-border h-full animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-primary">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-blue" />
          <span className="text-sm font-semibold text-text-primary">AI Copilot</span>
        </div>
        <div className="flex items-center gap-2">
          {boardProfile && (
            <span className="badge badge-blue text-[10px]">{boardProfile.name}</span>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            title="AI 设置"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <AIChat />
    </div>
  );
}

function AIChat() {
  const { messages, isStreaming, sendMessage } = useAIStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted text-xs gap-2">
            <Sparkles className="w-8 h-8 text-accent-blue/30" />
            <p className="font-medium text-text-secondary">AI 助手已就绪</p>
            <p>选中终端日志右键提交分析</p>
            <p>或直接输入问题开始对话</p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
      </div>

      <div className="border-t border-border p-3 bg-bg-primary">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，Ctrl+Enter 发送..."
            disabled={isStreaming}
            className="flex-1 input-field resize-none min-h-[36px] max-h-[80px] py-1.5 text-xs disabled:opacity-50"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="btn-primary self-end text-xs h-[36px] px-3"
          >
            {isStreaming ? '...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: any }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
          isUser
            ? 'bg-accent-blue text-white'
            : 'bg-bg-tertiary text-text-primary'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">
          {message.content || (message.isStreaming ? '思考中...' : '')}
        </div>
        {message.isStreaming && (
          <span className="inline-block w-1.5 h-3 bg-white/70 ml-1 animate-pulse" />
        )}
      </div>
    </div>
  );
}
