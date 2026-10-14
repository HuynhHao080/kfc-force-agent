import { AgentTool, AnyAgentTool } from "./agent-tool";

export interface ToolRegistry {
  register<TInput, TOutput>(tool: AgentTool<TInput, TOutput>): void;
  get(name: string): AnyAgentTool | undefined;
  has(name: string): boolean;
  list(): AnyAgentTool[];
}

export class InMemoryToolRegistry implements ToolRegistry {
  private tools: Map<string, AnyAgentTool> = new Map();

  register<TInput, TOutput>(tool: AgentTool<TInput, TOutput>): void {
    this.tools.set(tool.name, tool as AnyAgentTool);
  }

  get(name: string): AnyAgentTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): AnyAgentTool[] {
    return Array.from(this.tools.values());
  }
}

// Global tool registry instance. Tools are registered once by the
// ServiceContainer so that every tool shares the same service instances.
export const toolRegistry = new InMemoryToolRegistry();

export function getTool(name: string): AnyAgentTool | undefined {
  return toolRegistry.get(name);
}

export function hasTool(name: string): boolean {
  return toolRegistry.has(name);
}

export function listTools(): AnyAgentTool[] {
  return toolRegistry.list();
}

