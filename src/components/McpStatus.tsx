import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface McpInfo {
  port: number;
  protocol: string;
  tools: string[];
}

export function McpStatus() {
  const [info, setInfo] = useState<McpInfo | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleToggle = async () => {
    if (!showDetails) {
      try {
        const result = await invoke<McpInfo>('get_mcp_info');
        setInfo(result);
      } catch {
        setInfo(null);
      }
    }
    setShowDetails(!showDetails);
  };

  const configJson = JSON.stringify({
    mcpServers: {
      serialpilot: {
        command: "nc",
        args: ["127.0.0.1", "9777"]
      }
    }
  }, null, 2);

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="text-text-secondary hover:text-text-primary text-xs px-2 py-0.5 rounded hover:bg-bg-tertiary"
        title="MCP Server 状态"
      >
        🔌 MCP
      </button>

      {showDetails && info && (
        <div className="absolute right-0 top-full mt-1 bg-bg-secondary border border-bg-tertiary rounded shadow-lg p-4 z-50 w-80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-text-primary">MCP Server</span>
            <span className="text-xs bg-accent-green/20 text-accent-green px-2 py-0.5 rounded">运行中</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-text-secondary">端口:</span>
              <span className="text-text-primary font-mono">{info.port}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">协议:</span>
              <span className="text-text-primary">{info.protocol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">工具数:</span>
              <span className="text-text-primary">{info.tools.length}</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-bg-tertiary">
            <div className="text-xs text-text-secondary mb-1">Claude Desktop 配置:</div>
            <pre className="bg-bg-primary rounded p-2 text-xs text-text-primary overflow-x-auto font-mono">
              {configJson}
            </pre>
          </div>

          <div className="mt-2 pt-2 border-t border-bg-tertiary">
            <div className="text-xs text-text-secondary mb-1">可用工具:</div>
            <div className="flex flex-wrap gap-1">
              {info.tools.map((tool) => (
                <span key={tool} className="text-xs bg-bg-primary text-text-muted px-1.5 py-0.5 rounded">
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
