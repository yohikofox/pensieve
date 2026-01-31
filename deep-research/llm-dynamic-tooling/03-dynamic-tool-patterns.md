# Dynamic Tool Addition Patterns - Implementation Guide

## Overview

This guide provides concrete code examples and architectural patterns for dynamically adding tools to LLM applications. All major LLM providers (Claude, OpenAI, open-source models) support dynamic tool registration through their APIs.

## Core Concept: Tools Are Runtime Parameters

Unlike static integrations, modern LLM APIs accept tool definitions as request parameters, enabling complete runtime flexibility.

**Key Principle:** Tools are JSON schemas passed with each API call. Change the tools array = change available capabilities.

## Claude API - Dynamic Tools

### Basic Tool Definition (TypeScript)

```typescript
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Define tools dynamically
const availableTools = [
  {
    name: "get_weather",
    description: "Get current weather for a location",
    input_schema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City name or coordinates"
        },
        units: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          default: "celsius"
        }
      },
      required: ["location"]
    }
  },
  {
    name: "search_database",
    description: "Search internal database for records",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query"
        },
        limit: {
          type: "number",
          default: 10
        }
      },
      required: ["query"]
    }
  }
];

// Make API call with dynamic tools
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: "What's the weather in Paris and search for French restaurants"
    }
  ],
  tools: availableTools  // Tools added dynamically
});
```

### Dynamic Tool Registry Pattern

```typescript
class DynamicToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private handlers: Map<string, ToolHandler> = new Map();

  // Register a new tool at runtime
  registerTool(tool: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(tool.name, tool);
    this.handlers.set(tool.name, handler);
    console.log(`✓ Registered tool: ${tool.name}`);
  }

  // Unregister a tool
  unregisterTool(toolName: string): void {
    this.tools.delete(toolName);
    this.handlers.delete(toolName);
    console.log(`✗ Unregistered tool: ${toolName}`);
  }

  // Get all registered tools for API call
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  // Execute a tool
  async executeTool(toolName: string, input: any): Promise<any> {
    const handler = this.handlers.get(toolName);
    if (!handler) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    return await handler(input);
  }

  // Filter tools based on context
  getToolsForContext(context: string): ToolDefinition[] {
    // Example: Only return relevant tools based on user context
    return Array.from(this.tools.values()).filter(tool => {
      // Custom filtering logic
      return tool.contexts?.includes(context) ?? true;
    });
  }
}

// Usage
const registry = new DynamicToolRegistry();

// Add tools dynamically
registry.registerTool(
  {
    name: "calculate",
    description: "Perform mathematical calculations",
    input_schema: {
      type: "object",
      properties: {
        expression: { type: "string" }
      },
      required: ["expression"]
    },
    contexts: ["math", "general"]
  },
  async (input) => {
    // Tool implementation
    return eval(input.expression); // Don't actually use eval in production!
  }
);

// Get tools for API call
const tools = registry.getToolDefinitions();

// Make API call
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 4096,
  messages: [{ role: "user", content: "Calculate 15 * 23" }],
  tools: tools
});
```

### Programmatic Tool Calling (Beta)

Claude's programmatic tool calling enables tools to be orchestrated through code rather than individual API round-trips.

```typescript
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// Define tools with allowed_callers
const tools = [
  {
    type: "code_execution_20250825",
    name: "code_execution"
  },
  {
    name: "query_database",
    description: "Execute SQL query. Returns JSON array of results.",
    input_schema: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "SQL query to execute"
        }
      },
      required: ["sql"]
    },
    allowed_callers: ["code_execution_20250825"]  // Only callable from code
  },
  {
    name: "send_email",
    description: "Send email to user",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" }
      },
      required: ["to", "subject", "body"]
    },
    allowed_callers: ["direct"]  // Only direct invocation
  }
];

const response = await anthropic.beta.messages.create({
  model: "claude-sonnet-4-5",
  betas: ["advanced-tool-use-2025-11-20"],
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: "Query sales for all regions, find top performer, email results"
    }
  ],
  tools: tools
});

// Claude will write code that calls query_database multiple times
// Filter results programmatically, then call send_email directly
```

**Benefits:**
- Reduces token consumption (intermediate results not in context)
- Lower latency for multi-step workflows
- Data processing happens in sandboxed code execution

## OpenAI API - Dynamic Tools

### Basic Tool Definition (Python)

```python
from openai import OpenAI

client = OpenAI(api_key="your-api-key")

# Define tools dynamically
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_current_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City and state, e.g. San Francisco, CA"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"]
                    }
                },
                "required": ["location"],
                "additionalProperties": False
            }
        }
    }
]

# Make API call with tools
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "user", "content": "What's the weather in Boston?"}
    ],
    tools=tools,
    tool_choice="auto"  # Let model decide when to use tools
)
```

### Dynamic Tool Loading Pattern (Python)

```python
import importlib
from typing import Dict, List, Callable

class DynamicToolManager:
    def __init__(self):
        self.tools: List[Dict] = []
        self.handlers: Dict[str, Callable] = {}

    def load_tool_module(self, module_path: str) -> None:
        """Dynamically load tools from a Python module."""
        module = importlib.import_module(module_path)

        # Get all tool definitions from module
        if hasattr(module, 'TOOLS'):
            for tool_def in module.TOOLS:
                self.register_tool(tool_def, module.HANDLERS[tool_def['function']['name']])

    def register_tool(self, tool_definition: Dict, handler: Callable) -> None:
        """Register a single tool."""
        self.tools.append(tool_definition)
        tool_name = tool_definition['function']['name']
        self.handlers[tool_name] = handler
        print(f"✓ Registered: {tool_name}")

    def unregister_tool(self, tool_name: str) -> None:
        """Remove a tool from the registry."""
        self.tools = [t for t in self.tools if t['function']['name'] != tool_name]
        self.handlers.pop(tool_name, None)
        print(f"✗ Unregistered: {tool_name}")

    async def execute_tool(self, tool_name: str, arguments: Dict) -> any:
        """Execute a registered tool handler."""
        handler = self.handlers.get(tool_name)
        if not handler:
            raise ValueError(f"Unknown tool: {tool_name}")
        return await handler(**arguments)

    def get_tools_for_api(self) -> List[Dict]:
        """Get tool definitions for API call."""
        return self.tools.copy()

# Usage
manager = DynamicToolManager()

# Load tools from different modules based on context
manager.load_tool_module("tools.weather")
manager.load_tool_module("tools.database")

# Conditionally add tools
if user.has_permission("admin"):
    manager.load_tool_module("tools.admin")

# Use in API call
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Help me with my task"}],
    tools=manager.get_tools_for_api()
)
```

### Tool Choice Control

```python
# Force a specific tool
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "What's the weather?"}],
    tools=tools,
    tool_choice={"type": "function", "function": {"name": "get_current_weather"}}
)

# Require any tool (no direct response)
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Help me"}],
    tools=tools,
    tool_choice="required"  # Must use a tool
)

# Disable parallel tool calling
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Multiple tasks"}],
    tools=tools,
    parallel_tool_calls=False  # One tool at a time
)
```

## MCP Integration Pattern

### TypeScript SDK - Dynamic MCP Tools

```typescript
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// Define tools using Zod schemas
const greetTool = tool(
  "greet_user",
  "Greet a user by name",
  {
    name: z.string().describe("User's name"),
    language: z.enum(["en", "fr", "es"]).default("en")
  },
  async (args) => {
    const greetings = {
      en: `Hello, ${args.name}!`,
      fr: `Bonjour, ${args.name}!`,
      es: `¡Hola, ${args.name}!`
    };
    return {
      content: [
        { type: "text", text: greetings[args.language] }
      ]
    };
  }
);

const calculatorTool = tool(
  "calculate",
  "Perform mathematical calculations",
  {
    expression: z.string().describe("Math expression to evaluate")
  },
  async (args) => {
    // Safe evaluation (use a proper math library in production)
    const result = eval(args.expression);
    return {
      content: [
        { type: "text", text: `Result: ${result}` }
      ]
    };
  }
);

// Create MCP server with tools
const toolServer = createSdkMcpServer({
  name: "dynamic-tools",
  version: "1.0.0",
  tools: [greetTool, calculatorTool]
});

// Use in query
const result = query({
  prompt: "Greet John in French and calculate 25 * 4",
  options: {
    mcpServers: {
      "tools": toolServer
    },
    allowedTools: [
      "mcp__tools__greet_user",
      "mcp__tools__calculate"
    ]
  }
});

for await (const message of result) {
  if (message.type === 'result') {
    console.log(message.result);
  }
}
```

### Dynamic MCP Server Addition

```typescript
class MCPServerManager {
  private servers: Map<string, any> = new Map();

  async addServer(
    name: string,
    tools: Array<any>
  ): Promise<void> {
    const server = createSdkMcpServer({
      name,
      version: "1.0.0",
      tools
    });

    this.servers.set(name, server);
    console.log(`✓ Added MCP server: ${name} with ${tools.length} tools`);
  }

  removeServer(name: string): void {
    this.servers.delete(name);
    console.log(`✗ Removed MCP server: ${name}`);
  }

  getServersConfig(): Record<string, any> {
    const config: Record<string, any> = {};
    this.servers.forEach((server, name) => {
      config[name] = server;
    });
    return config;
  }

  getAllowedTools(): string[] {
    const tools: string[] = [];
    this.servers.forEach((server, serverName) => {
      // MCP tools are prefixed with mcp__servername__toolname
      server._tools?.forEach((tool: any) => {
        tools.push(`mcp__${serverName}__${tool.name}`);
      });
    });
    return tools;
  }
}

// Usage
const manager = new MCPServerManager();

// Add servers dynamically based on user context
await manager.addServer("user-tools", [greetTool, calculatorTool]);

if (userHasAdminAccess) {
  await manager.addServer("admin-tools", [adminTool, auditTool]);
}

// Use in query
const result = query({
  prompt: "Your task here",
  options: {
    mcpServers: manager.getServersConfig(),
    allowedTools: manager.getAllowedTools()
  }
});
```

## Context-Aware Tool Selection

### Pattern: User Permission-Based Tools

```typescript
interface UserContext {
  userId: string;
  role: 'user' | 'admin' | 'superadmin';
  permissions: string[];
  location?: string;
}

class ContextAwareToolRegistry {
  private allTools: Map<string, ToolDefinition> = new Map();

  getToolsForUser(context: UserContext): ToolDefinition[] {
    return Array.from(this.allTools.values()).filter(tool => {
      // Check role requirements
      if (tool.minRole && this.roleLevel(context.role) < this.roleLevel(tool.minRole)) {
        return false;
      }

      // Check specific permissions
      if (tool.requiredPermissions) {
        const hasAllPermissions = tool.requiredPermissions.every(
          perm => context.permissions.includes(perm)
        );
        if (!hasAllPermissions) return false;
      }

      // Check location-based tools
      if (tool.availableInRegions && context.location) {
        if (!tool.availableInRegions.includes(context.location)) {
          return false;
        }
      }

      return true;
    });
  }

  private roleLevel(role: string): number {
    const levels = { 'user': 1, 'admin': 2, 'superadmin': 3 };
    return levels[role as keyof typeof levels] || 0;
  }
}

// Usage
const registry = new ContextAwareToolRegistry();

// Register tools with access controls
registry.register({
  name: "delete_user",
  description: "Delete a user account",
  minRole: "admin",
  requiredPermissions: ["user.delete"],
  input_schema: { /* ... */ }
});

registry.register({
  name: "eu_gdpr_export",
  description: "Export user data for GDPR compliance",
  availableInRegions: ["EU"],
  input_schema: { /* ... */ }
});

// Get tools for specific user
const userContext: UserContext = {
  userId: "usr_123",
  role: "admin",
  permissions: ["user.read", "user.delete"],
  location: "US"
};

const availableTools = registry.getToolsForUser(userContext);
```

### Pattern: Session-Based Dynamic Tools

```typescript
class SessionToolManager {
  private sessionTools: Map<string, Set<string>> = new Map();

  addToolToSession(sessionId: string, toolName: string): void {
    if (!this.sessionTools.has(sessionId)) {
      this.sessionTools.set(sessionId, new Set());
    }
    this.sessionTools.get(sessionId)!.add(toolName);
  }

  removeToolFromSession(sessionId: string, toolName: string): void {
    this.sessionTools.get(sessionId)?.delete(toolName);
  }

  getSessionTools(sessionId: string, allTools: ToolDefinition[]): ToolDefinition[] {
    const enabledToolNames = this.sessionTools.get(sessionId);
    if (!enabledToolNames) return [];

    return allTools.filter(tool => enabledToolNames.has(tool.name));
  }

  clearSession(sessionId: string): void {
    this.sessionTools.delete(sessionId);
  }
}

// Usage in conversation flow
const sessionManager = new SessionToolManager();

// Start with basic tools
sessionManager.addToolToSession(sessionId, "search");
sessionManager.addToolToSession(sessionId, "calculate");

// After user authenticates, add more tools
if (userAuthenticated) {
  sessionManager.addToolToSession(sessionId, "access_database");
  sessionManager.addToolToSession(sessionId, "send_email");
}

// After specific task, add specialized tools
if (userStartedDataAnalysis) {
  sessionManager.addToolToSession(sessionId, "run_sql");
  sessionManager.addToolToSession(sessionId, "create_chart");
}

// Get tools for current session
const tools = sessionManager.getSessionTools(sessionId, ALL_AVAILABLE_TOOLS);
```

## Lazy Loading Pattern

For mobile apps with many potential tools, implement lazy loading:

```typescript
class LazyToolLoader {
  private loadedTools: Map<string, ToolDefinition> = new Map();
  private toolLoaders: Map<string, () => Promise<ToolDefinition>> = new Map();

  registerLazyTool(name: string, loader: () => Promise<ToolDefinition>): void {
    this.toolLoaders.set(name, loader);
  }

  async loadTool(name: string): Promise<ToolDefinition> {
    // Check if already loaded
    if (this.loadedTools.has(name)) {
      return this.loadedTools.get(name)!;
    }

    // Load tool dynamically
    const loader = this.toolLoaders.get(name);
    if (!loader) {
      throw new Error(`No loader registered for tool: ${name}`);
    }

    const tool = await loader();
    this.loadedTools.set(name, tool);
    console.log(`✓ Lazy loaded: ${name}`);
    return tool;
  }

  async getTools(requiredTools: string[]): Promise<ToolDefinition[]> {
    const tools = await Promise.all(
      requiredTools.map(name => this.loadTool(name))
    );
    return tools;
  }

  unloadTool(name: string): void {
    this.loadedTools.delete(name);
  }
}

// Usage
const loader = new LazyToolLoader();

// Register lazy loaders
loader.registerLazyTool("heavy_ml_tool", async () => {
  // Only load when needed (saves memory)
  const { heavyMLTool } = await import('./tools/ml');
  return heavyMLTool;
});

loader.registerLazyTool("rare_admin_tool", async () => {
  const { adminTool } = await import('./tools/admin');
  return adminTool;
});

// Load only needed tools
const tools = await loader.getTools(["heavy_ml_tool"]);
```

## Tool Versioning Pattern

```typescript
interface VersionedTool extends ToolDefinition {
  version: string;
  deprecated?: boolean;
  deprecationMessage?: string;
  replacedBy?: string;
}

class VersionedToolRegistry {
  private tools: Map<string, Map<string, VersionedTool>> = new Map();

  registerTool(tool: VersionedTool): void {
    if (!this.tools.has(tool.name)) {
      this.tools.set(tool.name, new Map());
    }
    this.tools.get(tool.name)!.set(tool.version, tool);
  }

  getTool(name: string, version?: string): VersionedTool | null {
    const versions = this.tools.get(name);
    if (!versions) return null;

    if (version) {
      return versions.get(version) || null;
    }

    // Get latest version
    const sortedVersions = Array.from(versions.entries())
      .sort((a, b) => this.compareVersions(b[0], a[0]));

    return sortedVersions[0]?.[1] || null;
  }

  getLatestNonDeprecated(name: string): VersionedTool | null {
    const versions = this.tools.get(name);
    if (!versions) return null;

    const nonDeprecated = Array.from(versions.values())
      .filter(t => !t.deprecated)
      .sort((a, b) => this.compareVersions(b.version, a.version));

    return nonDeprecated[0] || null;
  }

  private compareVersions(v1: string, v2: string): number {
    // Simplified version comparison
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      if (part1 !== part2) return part1 - part2;
    }
    return 0;
  }
}

// Usage
const versionedRegistry = new VersionedToolRegistry();

// Register different versions
versionedRegistry.registerTool({
  name: "search",
  version: "1.0.0",
  description: "Basic search",
  deprecated: true,
  replacedBy: "search@2.0.0",
  input_schema: { /* v1 schema */ }
});

versionedRegistry.registerTool({
  name: "search",
  version: "2.0.0",
  description: "Advanced search with filters",
  input_schema: { /* v2 schema */ }
});

// Get specific version
const searchV1 = versionedRegistry.getTool("search", "1.0.0");

// Get latest version
const latestSearch = versionedRegistry.getTool("search");
```

## Best Practices

### 1. Context Window Management

```typescript
// Bad: Overly verbose descriptions
{
  name: "weather_api",
  description: "This is an extremely comprehensive weather API that allows you to fetch current weather conditions, forecasts, historical data, and much more for any location worldwide. It supports multiple units including celsius, fahrenheit, and kelvin. You can also get detailed information about wind speed, humidity, precipitation, UV index, and more...",
  // ... 800 more characters
}

// Good: Concise, focused descriptions
{
  name: "weather_api",
  description: "Get current weather and forecasts for any location. Supports multiple units and detailed metrics.",
  input_schema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "City name or coordinates"
      },
      include: {
        type: "array",
        items: {
          enum: ["forecast", "wind", "humidity", "uv"]
        },
        description: "Additional data to include"
      }
    }
  }
}
```

**Recommended Limits:**
- Tool name: ≤64 characters
- Tool description: ≤500 characters (warn at 500, alert at 1000)
- Total tools per request: ≤50 for optimal performance

### 2. Error Handling

```typescript
async function executeToolSafely(
  toolName: string,
  input: any,
  timeout: number = 30000
): Promise<ToolResult> {
  try {
    // Validate input
    if (!validateToolInput(toolName, input)) {
      return {
        error: true,
        message: "Invalid input parameters"
      };
    }

    // Execute with timeout
    const result = await Promise.race([
      registry.executeTool(toolName, input),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Tool execution timeout')), timeout)
      )
    ]);

    return { success: true, data: result };

  } catch (error) {
    console.error(`Tool execution failed: ${toolName}`, error);

    return {
      error: true,
      message: error instanceof Error ? error.message : 'Unknown error',
      retriable: isRetriableError(error)
    };
  }
}
```

### 3. Monitoring & Logging

```typescript
class InstrumentedToolRegistry {
  private async executeAndLog(
    toolName: string,
    input: any
  ): Promise<any> {
    const startTime = Date.now();

    try {
      const result = await this.handlers.get(toolName)!(input);

      // Log successful execution
      this.logToolExecution({
        tool: toolName,
        success: true,
        duration: Date.now() - startTime,
        inputSize: JSON.stringify(input).length,
        outputSize: JSON.stringify(result).length
      });

      return result;

    } catch (error) {
      // Log failed execution
      this.logToolExecution({
        tool: toolName,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  private logToolExecution(data: ToolExecutionLog): void {
    // Send to monitoring service
    analytics.track('tool_execution', data);

    // Alert on anomalies
    if (data.duration > 10000) {
      console.warn(`Slow tool execution: ${data.tool} took ${data.duration}ms`);
    }
  }
}
```

## Key Takeaways

1. **Tools are runtime parameters** - Passed with each API request, fully dynamic
2. **Registry pattern** - Centralize tool management for easy add/remove
3. **Context-aware selection** - Filter tools based on user permissions, location, session
4. **Lazy loading** - Load heavy tools only when needed (critical for mobile)
5. **Versioning** - Support multiple tool versions with deprecation management
6. **Description brevity** - Keep tool descriptions concise to preserve context window
7. **Error handling** - Timeout, validate, retry, and log all tool executions
8. **MCP integration** - Use standardized protocol for multi-service tools

Dynamic tool addition enables adaptive AI applications that respond to user context, permissions, and real-time requirements. The patterns in this guide provide production-ready foundations for building robust, scalable LLM applications.
