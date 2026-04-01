#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Node } from "./node.js";
import { Election } from "./election.js";
import { registerTools } from "./tools.js";
import { VERSION } from "./version.js";

const PORT = 1994;

async function main(): Promise<void> {
  console.error("========================================");
  console.error("  Figma MCP Bridge Server");
  console.error("========================================");
  console.error(`  Version: ${VERSION}`);
  console.error(`  Port: ${PORT}`);
  console.error("========================================");
  console.error("");

  const node = new Node(PORT);
  const election = new Election(PORT, node);
  await election.start();

  // Wait for election to stabilize
  await new Promise(resolve => setTimeout(resolve, 500));

  // Graceful shutdown
  const shutdown = () => {
    console.error("");
    console.error("[Bridge] Shutting down...");
    election.stop();
    node.stop();
    process.exit(0);
  };

  // Handle shutdown signals
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("exit", (code: number) => console.error("[Bridge] Process exit:", code));

  // Create MCP server
  const server = new McpServer({
    name: "figma-bridge",
    version: VERSION,
  });

  registerTools(server, node);

  console.error(`[Bridge] MCP server ready (role: ${node.roleName})`);
  console.error("[Bridge] Waiting for Figma plugin to connect...");

  // Create stdio transport - this is what opencode connects to
  const transport = new StdioServerTransport();
  
  // Handle transport events
  transport.onclose = () => {
    console.error("[Index] StdioServerTransport closed");
  };
  
  transport.onerror = (error: Error) => {
    console.error("[Index] StdioServerTransport error:", error.message);
  };

  try {
    await server.connect(transport);
    console.error("[Bridge] MCP server connected to AI tool");
    console.error("[Bridge] Ready! Plugin connected via WebSocket");
    console.error("");
    
    // Keep the process alive - the transport maintains the connection
    // Add a dummy interval to prevent process from exiting
    const keepAlive = setInterval(() => {
      // Keep alive
    }, 60000);
    
    // Clean up on shutdown
    process.on("beforeExit", () => {
      clearInterval(keepAlive);
    });
  } catch (err) {
    console.error("[Bridge] Failed to connect transport:", err);
    shutdown();
  }
}

main().catch((err) => {
  console.error("[Bridge] Fatal error:", err);
  process.exit(1);
});
