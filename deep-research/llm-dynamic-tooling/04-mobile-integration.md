# Mobile Integration Guide - React Native & Expo

## Overview

Integrating dynamic LLM tooling into mobile applications presents unique challenges: network latency, battery constraints, limited memory, and intermittent connectivity. This guide provides production-ready patterns for React Native and Expo apps.

## Architecture Patterns for Mobile

### Pattern 1: Hybrid Local/Remote Architecture

The recommended approach for mobile apps balances performance and capability:

```
┌─────────────────────────────────────────────┐
│          React Native App                   │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │     LLM Orchestrator                  │ │
│  │  (Decision: Local vs Remote)          │ │
│  └────────────┬──────────────────────────┘ │
│               │                             │
│       ┌───────┴────────┐                    │
│       │                │                    │
│   ┌───▼────┐      ┌───▼────┐               │
│   │ Local  │      │ Remote │               │
│   │ Tools  │      │ Tools  │               │
│   └────────┘      └────┬───┘               │
│   - Fast           API │ MCP                │
│   - Offline            │                    │
│   - Simple       ┌─────▼──────┐            │
│                  │   Cloud    │            │
└──────────────────│  Backend   │────────────┘
                   │            │
                   │ - Complex  │
                   │ - Dynamic  │
                   │ - Powerful │
                   └────────────┘
```

**Decision Logic:**

```typescript
class ToolOrchestrator {
  async execute(toolName: string, input: any): Promise<any> {
    const tool = this.registry.get(toolName);

    // Decision factors
    const isOffline = !await this.networkStatus.isOnline();
    const isSimple = tool.complexity === 'simple';
    const isCached = await this.cache.has(toolName, input);
    const batteryLevel = await this.battery.getLevel();
    const isLowBattery = batteryLevel < 0.2;

    // Execute locally when possible
    if (isOffline || isSimple || isCached || isLowBattery) {
      if (tool.localHandler) {
        return await tool.localHandler(input);
      }
    }

    // Fall back to remote execution
    return await this.executeRemote(toolName, input);
  }

  private async executeRemote(toolName: string, input: any): Promise<any> {
    // Implement with retry, timeout, offline queueing
    try {
      return await this.remoteClient.call(toolName, input);
    } catch (error) {
      // Queue for later if offline
      if (!await this.networkStatus.isOnline()) {
        await this.offlineQueue.add(toolName, input);
        return { queued: true, message: 'Will execute when online' };
      }
      throw error;
    }
  }
}
```

### Pattern 2: MCP Client for React Native

Using Streamable HTTP transport for remote MCP servers:

```typescript
import { EventSource } from 'react-native-sse';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MCPClientConfig {
  serverUrl: string;
  authToken: string;
  timeout?: number;
}

class ReactNativeMCPClient {
  private serverUrl: string;
  private authToken: string;
  private tools: Map<string, ToolDefinition> = new Map();
  private eventSource?: EventSource;

  constructor(config: MCPClientConfig) {
    this.serverUrl = config.serverUrl;
    this.authToken = config.authToken;
  }

  async initialize(): Promise<void> {
    // Initialize connection
    const initResponse = await fetch(`${this.serverUrl}/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({
        protocolVersion: '2025-06-18',
        capabilities: {
          elicitation: {}
        },
        clientInfo: {
          name: 'react-native-app',
          version: '1.0.0'
        }
      })
    });

    const initData = await initResponse.json();
    console.log('MCP initialized:', initData.result.serverInfo);

    // Fetch available tools
    await this.refreshTools();

    // Subscribe to tool updates
    this.subscribeToUpdates();
  }

  private async refreshTools(): Promise<void> {
    const response = await fetch(`${this.serverUrl}/tools/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/list'
      })
    });

    const data = await response.json();
    const tools = data.result.tools;

    // Update tool registry
    this.tools.clear();
    tools.forEach((tool: ToolDefinition) => {
      this.tools.set(tool.name, tool);
    });

    // Cache tools locally
    await AsyncStorage.setItem(
      'mcp_tools',
      JSON.stringify(Array.from(this.tools.entries()))
    );

    console.log(`✓ Loaded ${this.tools.size} tools`);
  }

  private subscribeToUpdates(): void {
    // Note: React Native EventSource doesn't support custom headers well
    // Use a proxy server or implement custom SSE client
    this.eventSource = new EventSource(
      `${this.serverUrl}/notifications?token=${this.authToken}`
    );

    this.eventSource.addEventListener('tools/list_changed', () => {
      console.log('Tools updated, refreshing...');
      this.refreshTools();
    });

    this.eventSource.addEventListener('error', (error) => {
      console.error('SSE connection error:', error);
      // Implement reconnection logic
      setTimeout(() => this.subscribeToUpdates(), 5000);
    });
  }

  async callTool(toolName: string, input: any): Promise<any> {
    const response = await fetch(`${this.serverUrl}/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: input
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.result;
  }

  async disconnect(): Promise<void> {
    this.eventSource?.close();
    console.log('MCP client disconnected');
  }

  getAvailableTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
}

// Usage in React Native component
export function useMCPTools(serverUrl: string, authToken: string) {
  const [client, setClient] = useState<ReactNativeMCPClient | null>(null);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const mcpClient = new ReactNativeMCPClient({ serverUrl, authToken });

    mcpClient.initialize()
      .then(() => {
        setClient(mcpClient);
        setTools(mcpClient.getAvailableTools());
        setIsConnected(true);
      })
      .catch(console.error);

    return () => {
      mcpClient.disconnect();
    };
  }, [serverUrl, authToken]);

  const executeTool = useCallback(async (toolName: string, input: any) => {
    if (!client) throw new Error('MCP client not initialized');
    return await client.callTool(toolName, input);
  }, [client]);

  return { tools, executeTool, isConnected };
}
```

## Expo Integration

### Official Expo MCP Server

Expo provides an official MCP server for AI-assisted development:

```bash
# Installation
npx expo install expo-mcp --dev

# Start with MCP support
EXPO_UNSTABLE_MCP_SERVER=1 npx expo start
```

**Capabilities:**
- Screenshot automation
- DevTools integration
- Element interaction via testID
- React Native documentation search
- Dependency management

### Custom Expo + MCP Integration

```typescript
// app/services/mcp-service.ts
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Network from 'expo-network';

interface MCPServiceConfig {
  baseUrl: string;
  apiKey: string;
  enableCaching?: boolean;
}

export class ExpoMCPService {
  private config: MCPServiceConfig;
  private toolCache: Map<string, any> = new Map();

  constructor(config: MCPServiceConfig) {
    this.config = config;
  }

  async initializeMCP(): Promise<void> {
    // Check network connectivity
    const networkState = await Network.getNetworkStateAsync();

    if (!networkState.isConnected) {
      console.warn('No network connection, using cached tools only');
      await this.loadCachedTools();
      return;
    }

    // Initialize MCP connection
    try {
      const response = await fetch(`${this.config.baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Platform': Platform.OS,
          'X-Device-Model': Device.modelName || 'unknown'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: { elicitation: {} },
            clientInfo: {
              name: `expo-app-${Platform.OS}`,
              version: '1.0.0'
            }
          }
        })
      });

      const data = await response.json();
      console.log('MCP initialized:', data.result);

      // Fetch and cache tools
      await this.fetchAndCacheTools();

    } catch (error) {
      console.error('MCP initialization failed:', error);
      await this.loadCachedTools();
    }
  }

  private async fetchAndCacheTools(): Promise<void> {
    const response = await fetch(`${this.config.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      })
    });

    const data = await response.json();
    const tools = data.result.tools;

    // Cache in memory
    tools.forEach((tool: any) => {
      this.toolCache.set(tool.name, tool);
    });

    // Persist to AsyncStorage
    if (this.config.enableCaching) {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(
        'mcp_tools_cache',
        JSON.stringify(tools)
      );
    }
  }

  private async loadCachedTools(): Promise<void> {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const cached = await AsyncStorage.getItem('mcp_tools_cache');

      if (cached) {
        const tools = JSON.parse(cached);
        tools.forEach((tool: any) => {
          this.toolCache.set(tool.name, tool);
        });
        console.log(`Loaded ${tools.length} cached tools`);
      }
    } catch (error) {
      console.error('Failed to load cached tools:', error);
    }
  }

  async executeTool(
    toolName: string,
    input: any,
    options?: { timeout?: number }
  ): Promise<any> {
    const timeout = options?.timeout || 30000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: input
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      return data.result;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`Tool execution timeout (${timeout}ms): ${toolName}`);
      }

      throw error;
    }
  }

  getAvailableTools(): any[] {
    return Array.from(this.toolCache.values());
  }
}

// Usage in Expo app
import { ExpoMCPService } from './services/mcp-service';

export default function App() {
  const [mcpService, setMcpService] = useState<ExpoMCPService | null>(null);

  useEffect(() => {
    const service = new ExpoMCPService({
      baseUrl: 'https://your-mcp-server.com',
      apiKey: 'your-api-key',
      enableCaching: true
    });

    service.initializeMCP().then(() => {
      setMcpService(service);
    });
  }, []);

  // Use mcpService in your app...
}
```

## Claude SDK Integration for React Native

```typescript
// services/claude-service.ts
import Anthropic from '@anthropic-ai/sdk';
import NetInfo from '@react-native-community/netinfo';

interface ClaudeToolConfig {
  name: string;
  description: string;
  inputSchema: any;
  handler: (input: any) => Promise<any>;
  localOnly?: boolean;
}

export class ReactNativeClaudeService {
  private client: Anthropic;
  private tools: Map<string, ClaudeToolConfig> = new Map();

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  registerTool(config: ClaudeToolConfig): void {
    this.tools.set(config.name, config);
    console.log(`✓ Registered tool: ${config.name}`);
  }

  async chat(
    message: string,
    options?: {
      allowedTools?: string[];
      onToolUse?: (toolName: string, input: any) => void;
    }
  ): Promise<string> {
    // Check network for remote tools
    const networkState = await NetInfo.fetch();
    const hasNetwork = networkState.isConnected;

    // Filter tools based on network availability
    const availableTools = Array.from(this.tools.values())
      .filter(tool => {
        if (tool.localOnly) return true;
        return hasNetwork;
      })
      .filter(tool => {
        if (!options?.allowedTools) return true;
        return options.allowedTools.includes(tool.name);
      });

    // Convert to API format
    const toolDefinitions = availableTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));

    let messages = [{ role: 'user' as const, content: message }];

    while (true) {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        messages,
        tools: toolDefinitions
      });

      // Check if tool use is requested
      const toolUse = response.content.find(
        block => block.type === 'tool_use'
      );

      if (!toolUse) {
        // No more tool calls, return final response
        const textBlock = response.content.find(
          block => block.type === 'text'
        );
        return textBlock?.text || '';
      }

      // Execute tool
      const tool = this.tools.get(toolUse.name);
      if (!tool) {
        throw new Error(`Unknown tool: ${toolUse.name}`);
      }

      // Notify caller
      options?.onToolUse?.(toolUse.name, toolUse.input);

      try {
        const result = await tool.handler(toolUse.input);

        // Add assistant response and tool result to messages
        messages = [
          ...messages,
          { role: 'assistant' as const, content: response.content },
          {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify(result)
              }
            ]
          }
        ];

      } catch (error) {
        // Handle tool execution error
        messages = [
          ...messages,
          { role: 'assistant' as const, content: response.content },
          {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                is_error: true,
                content: error instanceof Error ? error.message : 'Tool execution failed'
              }
            ]
          }
        ];
      }
    }
  }
}

// Usage in React Native component
export function useClaudeChat() {
  const [service] = useState(() => new ReactNativeClaudeService(API_KEY));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Register local tools
    service.registerTool({
      name: 'get_device_info',
      description: 'Get current device information',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async () => ({
        platform: Platform.OS,
        model: Device.modelName,
        osVersion: Platform.Version
      }),
      localOnly: true
    });

    // Register remote tools
    service.registerTool({
      name: 'search_products',
      description: 'Search product database',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' }
        },
        required: ['query']
      },
      handler: async (input) => {
        // Call backend API
        const response = await fetch(`https://api.example.com/search?q=${input.query}`);
        return await response.json();
      }
    });
  }, [service]);

  const chat = async (message: string) => {
    setIsLoading(true);
    try {
      const response = await service.chat(message, {
        onToolUse: (toolName, input) => {
          console.log(`Using tool: ${toolName}`, input);
        }
      });
      return response;
    } finally {
      setIsLoading(false);
    }
  };

  return { chat, isLoading };
}
```

## Network & Offline Handling

### Offline Queue Pattern

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

interface QueuedToolCall {
  id: string;
  toolName: string;
  input: any;
  timestamp: number;
}

class OfflineToolQueue {
  private static QUEUE_KEY = 'offline_tool_queue';

  async add(toolName: string, input: any): Promise<void> {
    const queue = await this.getQueue();

    const item: QueuedToolCall = {
      id: `${Date.now()}_${Math.random()}`,
      toolName,
      input,
      timestamp: Date.now()
    };

    queue.push(item);
    await AsyncStorage.setItem(this.constructor.QUEUE_KEY, JSON.stringify(queue));

    console.log(`✓ Queued tool call: ${toolName}`);
  }

  async processQueue(executor: (toolName: string, input: any) => Promise<any>): Promise<void> {
    const queue = await this.getQueue();

    if (queue.length === 0) {
      return;
    }

    console.log(`Processing ${queue.length} queued tool calls...`);

    const results = await Promise.allSettled(
      queue.map(item => executor(item.toolName, item.input))
    );

    // Remove successfully processed items
    const failed = queue.filter((_, index) => results[index].status === 'rejected');

    await AsyncStorage.setItem(this.constructor.QUEUE_KEY, JSON.stringify(failed));

    console.log(`✓ Processed queue: ${results.length - failed.length} succeeded, ${failed.length} failed`);
  }

  private async getQueue(): Promise<QueuedToolCall[]> {
    const data = await AsyncStorage.getItem(this.constructor.QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(this.constructor.QUEUE_KEY);
  }
}

// Usage with network listener
export function useOfflineQueue(executor: (toolName: string, input: any) => Promise<any>) {
  const queue = useRef(new OfflineToolQueue());

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        console.log('Network connected, processing queue...');
        queue.current.processQueue(executor);
      }
    });

    return unsubscribe;
  }, [executor]);

  return queue.current;
}
```

## Battery & Performance Optimization

### Smart Execution Strategy

```typescript
import * as Battery from 'expo-battery';

class SmartToolExecutor {
  async shouldExecuteRemotely(): Promise<boolean> {
    const batteryLevel = await Battery.getBatteryLevelAsync();
    const batteryState = await Battery.getBatteryStateAsync();
    const isLowPowerMode = await Battery.getPowerStateAsync();

    // Don't execute remotely if:
    // - Battery < 20%
    // - Low power mode enabled
    // - Not charging
    if (batteryLevel < 0.2 || isLowPowerMode.lowPowerMode) {
      return false;
    }

    if (batteryState !== Battery.BatteryState.CHARGING && batteryLevel < 0.5) {
      return false;
    }

    return true;
  }

  async execute(toolName: string, input: any): Promise<any> {
    // Check if we should execute remotely
    if (!await this.shouldExecuteRemotely()) {
      console.log('Low battery, using local execution or cache');

      // Try local execution first
      const localResult = await this.tryLocalExecution(toolName, input);
      if (localResult) return localResult;

      // Try cache
      const cached = await this.tryCache(toolName, input);
      if (cached) return cached;

      // Queue for later
      await offlineQueue.add(toolName, input);
      return { queued: true };
    }

    // Execute normally
    return await this.executeRemote(toolName, input);
  }
}
```

## Complete Example: React Native Chat App with Dynamic Tools

```typescript
// app/screens/ChatScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, TextInput, FlatList, Text, TouchableOpacity } from 'react-native';
import { ReactNativeClaudeService } from '../services/claude-service';
import { ExpoMCPService } from '../services/mcp-service';
import NetInfo from '@react-native-community/netinfo';

export function ChatScreen() {
  const [claudeService] = useState(() => new ReactNativeClaudeService(API_KEY));
  const [mcpService, setMcpService] = useState<ExpoMCPService | null>(null);
  const [messages, setMessages] = useState<Array<{id: string; text: string; role: string}>>([]);
  const [input, setInput] = useState('');
  const [isOnline, setIsOnline] = useState(true);

  // Initialize MCP service
  useEffect(() => {
    const mcp = new ExpoMCPService({
      baseUrl: 'https://your-mcp-server.com',
      apiKey: 'your-key',
      enableCaching: true
    });

    mcp.initializeMCP().then(() => {
      setMcpService(mcp);

      // Register MCP tools with Claude
      mcp.getAvailableTools().forEach(tool => {
        claudeService.registerTool({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.input_schema,
          handler: async (input) => {
            const result = await mcp.executeTool(tool.name, input);
            return result.content[0].text;
          }
        });
      });
    });

    // Monitor network
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });

    return unsubscribe;
  }, [claudeService]);

  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const userMessage = { id: Date.now().toString(), text: input, role: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await claudeService.chat(input, {
        onToolUse: (toolName, toolInput) => {
          console.log(`Using tool: ${toolName}`, toolInput);
          // Could show UI indicator here
        }
      });

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        text: response,
        role: 'assistant'
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error.',
        role: 'assistant'
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [input, claudeService]);

  return (
    <View style={{ flex: 1 }}>
      {!isOnline && (
        <View style={{ padding: 10, backgroundColor: 'orange' }}>
          <Text>Offline - using cached tools only</Text>
        </View>
      )}

      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={{
            padding: 10,
            margin: 5,
            backgroundColor: item.role === 'user' ? '#e3f2fd' : '#f5f5f5'
          }}>
            <Text>{item.text}</Text>
          </View>
        )}
      />

      <View style={{ flexDirection: 'row', padding: 10 }}>
        <TextInput
          style={{ flex: 1, borderWidth: 1, padding: 10 }}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
        />
        <TouchableOpacity onPress={sendMessage} style={{ padding: 10 }}>
          <Text>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

## Key Takeaways

1. **Use hybrid architecture** - Local for simple/offline, remote for complex
2. **Streamable HTTP for MCP** - Only viable transport for mobile
3. **Cache aggressively** - Tools, responses, network calls
4. **Handle offline gracefully** - Queue operations, provide feedback
5. **Respect battery constraints** - Reduce remote calls when low battery
6. **Optimize for mobile networks** - Timeouts, retries, compression
7. **Monitor everything** - Network state, battery, tool execution

Mobile LLM integration requires careful consideration of device constraints, but the patterns in this guide enable powerful AI features while respecting mobile limitations.
