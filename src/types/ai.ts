export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  model: string;
  apiKey: string;
  endpoint: string;
  maxContextLogs: number;
  systemPrompt: string;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: '',
  endpoint: 'https://api.openai.com/v1',
  maxContextLogs: 20,
  systemPrompt: '',
};

export interface BoardProfile {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  default_serial: {
    baud_rate: number;
    data_bits: string;
    parity: string;
    stop_bits: string;
    flow_control?: string;
  };
  protocol: {
    type: string;
    line_ending?: string;
    response_ok?: string;
    response_error?: string;
  };
  at_commands?: Record<string, string>;
  debug_tips?: string[];
  common_issues?: Array<{
    symptom: string;
    causes: string[];
    solutions: string[];
  }>;
}

export interface AIContext {
  portConfig: {
    baud_rate: number;
    data_bits: string;
    stop_bits: string;
    parity: string;
    flow_control: string;
  };
  boardProfile: BoardProfile | null;
  selectedText: string;
  recentLogs: Array<{
    timestamp: string;
    direction: string;
    data: string;
  }>;
}

export interface AnalysisResult {
  frameFormat: string;
  checksumResult: string;
  anomalies: string[];
  suggestions: string[];
  commands: Array<{
    label: string;
    command: string;
  }>;
}
