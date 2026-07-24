import { useState, useRef, useEffect } from 'react';
import { useAIStore } from '../../stores/aiStore';
import { Message } from '../../types/ai';

export function AIChat() {
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-text-muted text-xs mt-8">
            <p className="mb-2">🤖 AI 助手已就绪</p>
            <p>选中终端日志右键提交分析</p>
            <p>或直接输入问题开始对话</p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
      </div>

      <div className="border-t border-bg-tertiary p-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，Ctrl+Enter 发送..."
            disabled={isStreaming}
            className="flex-1 bg-bg-primary text-text-primary text-xs rounded px-3 py-2 border-0 resize-none min-h-[40px] max-h-[80px] placeholder:text-text-muted disabled:opacity-50"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="bg-accent-blue hover:bg-blue-600 text-white text-xs px-3 py-1 rounded self-end disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStreaming ? '...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
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
          <span className="inline-block w-1.5 h-3 bg-accent-blue ml-1 animate-pulse" />
        )}
      </div>
    </div>
  );
}
