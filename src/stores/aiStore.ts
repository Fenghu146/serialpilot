import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AIConfig, DEFAULT_AI_CONFIG, Message, BoardProfile, AIContext } from '../types/ai';
import { AIProvider } from '../services/ai-service';

interface AIState {
  messages: Message[];
  isStreaming: boolean;
  config: AIConfig;
  boardProfile: BoardProfile | null;
  mode: 'standard' | 'ai';
  settingsOpen: boolean;
  selectedText: string;

  setMode: (mode: 'standard' | 'ai') => void;
  setSettingsOpen: (open: boolean) => void;
  setSelectedText: (text: string) => void;
  setBoardProfile: (profile: BoardProfile | null) => void;
  updateConfig: (config: Partial<AIConfig>) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, content: string) => void;
  clearMessages: () => void;
  sendMessage: (content: string, context?: AIContext) => Promise<void>;
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      messages: [],
      isStreaming: false,
      config: DEFAULT_AI_CONFIG,
      boardProfile: null,
      mode: 'standard',
      settingsOpen: false,
      selectedText: '',

      setMode: (mode) => set({ mode }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setSelectedText: (selectedText) => set({ selectedText }),
      setBoardProfile: (boardProfile) => set({ boardProfile }),
      updateConfig: (partial) => set((s) => ({ config: { ...s.config, ...partial } })),
      clearMessages: () => set({ messages: [] }),

      addMessage: (message) =>
        set((s) => ({ messages: [...s.messages, message] })),

      updateMessage: (id, content) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, content } : m
          ),
        })),

      sendMessage: async (content, context) => {
        const state = get();
        if (state.isStreaming) return;

        const userMsg: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content,
          timestamp: Date.now(),
        };
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
        };

        set((s) => ({
          messages: [...s.messages, userMsg, assistantMsg],
          isStreaming: true,
        }));

        try {
          const provider = new AIProvider(state.config);
          const systemPrompt = buildSystemPrompt(state, context);

          const messages = [
            { role: 'system' as const, content: systemPrompt },
            ...state.messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user' as const, content: buildUserPrompt(content, context) },
          ];

          let fullContent = '';
          for await (const chunk of provider.stream(messages)) {
            fullContent += chunk;
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: fullContent }
                  : m
              ),
            }));
          }

          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, isStreaming: false }
                : m
            ),
            isStreaming: false,
          }));
        } catch (error: any) {
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: `错误: ${error.message}`, isStreaming: false }
                : m
            ),
            isStreaming: false,
          }));
        }
      },
    }),
    {
      name: 'serialpilot-ai',
      partialize: (state) => ({
        config: state.config,
        boardProfile: state.boardProfile,
        mode: state.mode,
        messages: state.messages.slice(-100),
      }),
    }
  )
);

function buildSystemPrompt(state: AIState, context?: AIContext): string {
  if (state.config.systemPrompt) {
    return state.config.systemPrompt;
  }

  let prompt = `你是嵌入式串口调试助手 SerialPilot 中的 AI 助手。`;

  if (context?.boardProfile) {
    const bp = context.boardProfile;
    prompt += `\n\n## 当前开发板\n`;
    prompt += `- 型号: ${bp.name} (${bp.manufacturer})\n`;
    prompt += `- 类别: ${bp.category}\n`;
    if (bp.at_commands) {
      prompt += `- 常用指令:\n`;
      for (const [cmd, desc] of Object.entries(bp.at_commands)) {
        prompt += `  - ${cmd}: ${desc}\n`;
      }
    }
    if (bp.debug_tips) {
      prompt += `- 调试技巧:\n`;
      for (const tip of bp.debug_tips) {
        prompt += `  - ${tip}\n`;
      }
    }
  }

  if (context?.portConfig) {
    const pc = context.portConfig;
    prompt += `\n## 串口参数\n`;
    prompt += `- 波特率: ${pc.baud_rate}\n`;
    prompt += `- 数据位: ${pc.data_bits}\n`;
    prompt += `- 停止位: ${pc.stop_bits}\n`;
    prompt += `- 校验: ${pc.parity}\n`;
  }

  prompt += `\n## 你的能力\n`;
  prompt += `1. 解析串口通信报文（帧头/长度/数据/校验）\n`;
  prompt += `2. 检测异常（超时/校验错/格式错/丢包/乱码）\n`;
  prompt += `3. 给出调试建议和排查步骤\n`;
  prompt += `4. 生成测试指令\n`;
  prompt += `5. 分析硬件连接问题\n`;
  prompt += `\n请用简洁专业的中文回答，使用 markdown 格式。`;

  return prompt;
}

function buildUserPrompt(content: string, context?: AIContext): string {
  let prompt = '';

  if (context?.selectedText) {
    prompt += `## 用户选中的日志内容\n\`\`\`\n${context.selectedText}\n\`\`\`\n\n`;
  }

  if (context?.recentLogs && context.recentLogs.length > 0) {
    prompt += `## 最近收发记录\n\`\`\`\n`;
    for (const log of context.recentLogs.slice(-10)) {
      prompt += `[${log.timestamp}] ${log.direction}> ${log.data}\n`;
    }
    prompt += `\`\`\`\n\n`;
  }

  prompt += content;
  return prompt;
}
