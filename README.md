# Figma MCP Bridge

[![Pairing with Hopp](https://gethopp.app/git/hopp-shield.svg?ref=hopp-repo)](https://gethopp.app)

- [Demo](#demo)
- [Quick Start](#quick-start)
- [Local development](#local-development)
- [Structure](#structure)
- [How it works](#how-it-works)
- [Available MCP Tools](#available-mcp-tools)
- [Troubleshooting](#troubleshooting)

<br/>

<img src="https://raw.githubusercontent.com/gethopp/figma-mcp-bridge/main/logo.png" alt="Figma MCP Bridge" align="center" />

<br/>

While other amazing Figma MCP servers like [Figma-Context-MCP](https://github.com/GLips/Figma-Context-MCP/) exist, one issues is the [API limiting](https://github.com/GLips/Figma-Context-MCP/issues/258) for free users.

The limit for free accounts is 6 requests per month, yes **per month**.

Figma MCP Bridge is a solution to this problem. It is a plugin + MCP server that streams live Figma document data to AI tools without hitting Figma API rate limits, so its Figma MCP for the rest of us ✊

## Demo

[Watch a demo of building a UI in Cursor with Figma MCP Bridge](https://youtu.be/ouygIhFBx0g)

[![Watch the video](https://img.youtube.com/vi/ouygIhFBx0g/maxresdefault.jpg)](https://youtu.be/ouygIhFBx0g)


## Quick Start

### 1. Add the MCP server to your favourite AI tool

Add the following to your AI tool's MCP configuration (e.g. Cursor, Windsurf, Claude Desktop):

```json
{
  "figma-bridge": {
    "command": "npx",
    "args": ["-y", "@gethopp/figma-mcp-bridge"]
  }
}
```

That's it — no binaries to download or install.

### 2. Add the Figma plugin

Download the plugin from the [latest release](https://github.com/gethopp/figma-mcp-bridge/releases) page, then in Figma go to `Plugins > Development > Import plugin from manifest` and select the `manifest.json` file from the `plugin/` folder.

### 3. Start using it 🎉

Open a Figma file, run the plugin, and start prompting your AI tool. The MCP server will automatically connect to the plugin.

If you want to know more about how it works, read the [How it works](#how-it-works) section.

## Local development

#### 1. Clone this repository locally

```bash
git clone git@github.com:gethopp/figma-mcp-bridge.git
```

#### 2. Build the server

```bash
cd server && npm install && npm run build
```

#### 3. Build the plugin

```bash
cd plugin && bun install && bun run build
```

#### 4. Add the MCP server to your favourite AI tool

For local development, add the following to your AI tool's MCP config:

**OpenCode (recommended):**
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "figma-bridge": {
      "type": "local",
      "command": ["node", "/path/to/figma-mcp-bridge/server/dist/index.js"],
      "enabled": true
    }
  }
}
```

**Other AI tools:**
```json
{
  "figma-bridge": {
    "command": "node",
    "args": ["/path/to/figma-mcp-bridge/server/dist/index.js"]
  }
}
```

#### 5. Running the bridge

```bash
# Start the bridge server
cd /path/to/figma-mcp-bridge/server
node dist/index.js
```

The bridge will:
1. Start an MCP server on stdio (for AI tool communication)
2. Start an HTTP server on port 1994 (for plugin communication)
3. Print `Leader listening on :1994` when ready

**Verify the bridge is running:**

```bash
curl http://localhost:1994/ping
# Should return: {"status":"ok","version":"0.1.1"}
```

#### 6. Using with Figma Desktop

1. Open Figma Desktop
2. Open the Figma file you want to analyze
3. Go to `Plugins > Development` and run "Figma MCP Bridge"
4. The plugin UI should show "WebSocket Connected"
5. Select nodes or navigate to the page you want to analyze
6. Use the MCP tools in your AI tool to query the design

**Architecture overview:**

```
Figma Desktop → Plugin (WebSocket) → Bridge Server (:1994) → MCP Server (stdio) → AI Tool
```

The bridge server handles the protocol translation between:
- Figma's plugin message protocol (via WebSocket)
- MCP protocol (via stdio)


## Structure

```
Figma-MCP-Bridge/
├── plugin/   # Figma plugin (TypeScript/React)
└── server/   # MCP server (TypeScript/Node.js)
    └── src/
        ├── index.ts      # Entry point
        ├── bridge.ts     # WebSocket bridge to Figma plugin
        ├── leader.ts     # Leader: HTTP server + bridge
        ├── follower.ts   # Follower: proxies to leader via HTTP
        ├── node.ts       # Dynamic leader/follower role switching
        ├── election.ts   # Leader election & health monitoring
        ├── tools.ts      # MCP tool definitions
        └── types.ts      # Shared types
```

## How it works

There are two main components to the Figma MCP Bridge:

### 1. The Figma Plugin

The Figma plugin is the user interface for the Figma MCP Bridge. You run this inside the Figma file you want to use the MCP server for, and it's responsible for getting all the information you need.

### 2. The MCP Server

The MCP server is the core of the Figma MCP Bridge. As the Figma plugin connects with the MCP server via a WebSocket connection, the MCP server is responsible for:
- Handling WebSocket connections from the Figma plugin
- Forwarding tool calls to the Figma plugin
- Routing responses back to the Figma plugin
- Handling leader election (as we can have only one WS connection to an MCP server at a time)

## Available MCP Tools

Once connected, you can use these tools in your AI tool:

| Tool | Description |
|------|-------------|
| `get_metadata` | Get file info, pages, current page |
| `get_document` | Get the current page document tree |
| `get_selection` | Get currently selected nodes |
| `get_node` | Get a specific node by ID (format: `123:456`) |
| `get_styles` | Get all local styles (paint, text, effects, grids) |
| `get_design_context` | Get summarized tree structure of selection/page |
| `get_variable_defs` | Get all local variable collections and values |
| `get_screenshot` | Export screenshot (returns base64) |
| `save_screenshots` | Export and save screenshots to filesystem |

### Example usage:

```
Get the metadata for the current Figma file

Get the design context for the Explore & Discover Crypto frame (node 18319:27856)

Take a screenshot of the selected nodes at 2x scale
```

## Troubleshooting

### "Not connected" error in AI tool

If MCP tools return "Not connected":

1. **Check if the bridge server is running:**
   ```bash
   curl http://localhost:1994/ping
   # Should return: {"status":"ok","version":"0.1.1"}
   ```

2. **Check if the Figma plugin is connected:**
   - Look at the plugin UI in Figma
   - It should show "WebSocket Connected" status
   - If not, close and reopen the plugin

3. **Check for multiple bridge processes:**
   ```bash
   lsof -i :1994
   # Kill any stale processes and restart
   ```

4. **Restart the bridge:**
   ```bash
   # Kill existing process
   pkill -f "node.*figma-mcp-bridge"
   
   # Start fresh
   cd /path/to/figma-mcp-bridge/server
   node dist/index.js
   ```

### RPC requests time out

This usually means the Figma plugin isn't connected. Check:
- Plugin UI shows "WebSocket Connected"
- Figma file is open and plugin is running

### Plugin shows "Connected" but tools don't work

The WebSocket connection to the bridge may be stale. Try:
1. Close the plugin in Figma
2. Stop the bridge server (`pkill -f "node.*figma-mcp-bridge"`)
3. Restart both


```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FIGMA (Browser)                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Figma Plugin                                  │  │
│  │                    (TypeScript/React)                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ WebSocket
                                      │ (ws://localhost:1994/ws)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRIMARY MCP SERVER                                 │
│                         (Leader on :1994)                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Bridge                                    Endpoints:               │    │
│  │  • Manages WebSocket conn                  • /ws    (plugin)        │    │
│  │  • Forwards requests to plugin             • /ping  (health)        │    │
│  │  • Routes responses back                   • /rpc   (followers)     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                           ▲                              ▲
                           │ HTTP /rpc                    │ HTTP /rpc
                           │ POST requests                │ POST requests
                           │                              │
         ┌─────────────────┴───────────┐    ┌─────────────┴───────────────┐
         │    FOLLOWER MCP SERVER 1    │    │    FOLLOWER MCP SERVER 2    │
         │                             │    │                             │
         │  • Pings leader /ping       │    │  • Pings leader /ping       │
         │  • Forwards tool calls      │    │  • Forwards tool calls      │
         │    via HTTP /rpc            │    │    via HTTP /rpc            │
         │  • If leader dies →         │    │  • If leader dies →         │
         │    attempts takeover        │    │    attempts takeover        │
         └─────────────────────────────┘    └─────────────────────────────┘
                    ▲                                      ▲
                    │                                      │
                    │ MCP Protocol                         │ MCP Protocol
                    │ (stdio)                              │ (stdio)
                    ▼                                      ▼
         ┌─────────────────────────────┐    ┌─────────────────────────────┐
         │      AI Tool / IDE 1        │    │      AI Tool / IDE 2        │
         │      (e.g., Cursor)         │    │      (e.g., Cursor)         │
         └─────────────────────────────┘    └─────────────────────────────┘
```
