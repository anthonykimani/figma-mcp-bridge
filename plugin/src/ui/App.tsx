import React, { useEffect, useMemo, useRef, useState } from "react";
import hoppLogo from "./assets/hopp-logo.png";

type RequestType =
  | "get_document"
  | "get_selection"
  | "get_node"
  | "get_styles"
  | "get_metadata"
  | "get_design_context"
  | "get_variable_defs"
  | "get_screenshot";

type ServerRequest = {
  type: RequestType;
  requestId: string;
  nodeIds?: string[];
  params?: {
    format?: "PNG" | "SVG" | "JPG" | "PDF";
    scale?: number;
    depth?: number;
  };
};

type PluginResponse = {
  type: RequestType;
  requestId: string;
  data?: unknown;
  error?: string;
};

type PluginStatus = {
  fileName: string;
  selectionCount: number;
  selectionIds?: string[];
  selectionNames?: string[];
};

type SerializedNode = {
  id: string;
  name: string;
  type: string;
  bounds?: { x: number; y: number; width: number; height: number };
  characters?: string;
  children?: SerializedNode[];
};

const WS_URL = "ws://localhost:1994/ws";

export default function App() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<PluginStatus>({
    fileName: "Unknown file",
    selectionCount: 0
  });
  const [selectedNodes, setSelectedNodes] = useState<SerializedNode[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);

  const statusLabel = useMemo(
    () => (connected ? "WebSocket Connected" : "Disconnected"),
    [connected]
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (!msg) return;

      if (msg.type === "plugin-status") {
        setStatus(msg.payload);
        const names = msg.payload.selectionNames;
        const ids = msg.payload.selectionIds;
        if (names && ids) {
          // Build nodes from the status message directly
          const nodes: SerializedNode[] = names.map((name: string, i: number) => ({
            id: ids[i],
            name: name,
            type: "NODE"
          }));
          setSelectedNodes(nodes);
        }
        return;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleNodeClick = (nodeId: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    
    const requestId = `req-${Date.now()}`;
    socketRef.current.send(JSON.stringify({
      type: "get_node",
      requestId,
      nodeIds: [nodeId]
    }));
  };

  useEffect(() => {
    const connect = () => {
      if (socketRef.current) {
        socketRef.current.close();
      }

      const ws = new WebSocket(WS_URL);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        parent.postMessage({ pluginMessage: { type: "ui-ready" } }, "*");
      };

      ws.onclose = () => {
        setConnected(false);
        if (reconnectTimer.current === null) {
          reconnectTimer.current = window.setTimeout(() => {
            reconnectTimer.current = null;
            connect();
          }, 1500);
        }
      };

      ws.onerror = () => {
        setConnected(false);
      };

      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        
        // Auto-fetch selected nodes when selection changes
        if (payload.type === "plugin-status" && payload.payload?.selectionCount > 0) {
          setStatus(payload.payload);
          const nodeIds = payload.payload.selectionIds;
          if (nodeIds && nodeIds.length > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
              type: "get_selection",
              requestId: `req-${Date.now()}`
            }));
          }
        }
        
        if (payload.type === "get_selection" && payload.data) {
          setSelectedNodes(payload.data as SerializedNode[]);
        }
        
        if (payload.type === "get_node" && payload.data) {
          setSelectedNodes(prev => {
            const node = payload.data as SerializedNode;
            const exists = prev.find(n => n.id === node.id);
            if (exists) return prev;
            return [...prev, node];
          });
        }
        
        parent.postMessage({ pluginMessage: { type: "server-request", payload } }, "*");
      };
    };

    connect();

    return () => {
      if (reconnectTimer.current !== null) {
        window.clearTimeout(reconnectTimer.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  

  return (
    <div className="container">
      <div className="info-section">
        <div className="info-row">
          <span className="info-label">File:</span>
          <span className="info-value">{status.fileName}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Selection:</span>
          <span className="info-value">{status.selectionCount} node(s)</span>
        </div>
        {selectedNodes.length > 0 && (
          <div className="info-row">
            <span className="info-label">Node:</span>
            <span className="info-value">{selectedNodes[0].name} {selectedNodes[0].id}</span>
          </div>
        )}
      </div>

      <div className="footer">
        <div className={`badge ${connected ? "connected" : "disconnected"}`}>
          <span className="dot" />
          <span className="badge-text">{statusLabel}</span>
        </div>
        <a
          href="https://www.gethopp.app/?ref=figma-mcp-bridge"
          target="_blank"
          rel="noopener noreferrer"
          className="branding"
        >
          <img src={hoppLogo} alt="Hopp" className="logo" />
          <span className="sponsored-text">
            Sponsored by Hopp
            <br />
            The best open-source
            <br />
            pair-programming app
          </span>
        </a>
      </div>
    </div>
  );
}
