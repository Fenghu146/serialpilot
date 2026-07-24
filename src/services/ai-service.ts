import { AIConfig } from '../types/ai';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AIProvider {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  async *stream(messages: ChatMessage[]): AsyncGenerator<string> {
    if (!this.config.apiKey && this.config.provider !== 'ollama') {
      throw new Error('请先配置 API 密钥（点击右上角设置图标）');
    }

    switch (this.config.provider) {
      case 'openai':
      case 'ollama':
      case 'custom':
        yield* this.streamOpenAI(messages);
        break;
      case 'anthropic':
        yield* this.streamAnthropic(messages);
        break;
      default:
        yield* this.streamOpenAI(messages);
    }
  }

  private async *streamOpenAI(messages: ChatMessage[]): AsyncGenerator<string> {
    const url = `${this.config.endpoint.replace(/\/$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const body = {
      model: this.config.model,
      messages,
      stream: true,
      temperature: 0.3,
      max_tokens: 2048,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API 错误 (${response.status}): ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法读取响应流');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip malformed JSON
        }
      }
    }
  }

  private async *streamAnthropic(messages: ChatMessage[]): AsyncGenerator<string> {
    const url = `${this.config.endpoint.replace(/\/$/, '')}/v1/messages`;
    const systemMsg = messages.find((m) => m.role === 'system');
    const otherMsgs = messages.filter((m) => m.role !== 'system');

    const body = {
      model: this.config.model,
      system: systemMsg?.content,
      messages: otherMsgs,
      stream: true,
      max_tokens: 2048,
      temperature: 0.3,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API 错误 (${response.status}): ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法读取响应流');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        try {
          const json = JSON.parse(data);
          if (json.type === 'content_block_delta') {
            const text = json.delta?.text;
            if (text) yield text;
          }
        } catch {
          // skip
        }
      }
    }
  }
}

export const AI_MODELS: Record<string, { label: string; models: string[] }> = {
  openai: {
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  },
  ollama: {
    label: 'Ollama (本地)',
    models: ['llama3.3', 'llama3.1', 'qwen2.5', 'deepseek-r1'],
  },
  custom: {
    label: '自定义 (OpenAI 兼容)',
    models: ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'deepseek-chat'],
  },
};

export const ENDPOINT_PRESETS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  ollama: 'http://localhost:11434/v1',
  custom: '',
};
