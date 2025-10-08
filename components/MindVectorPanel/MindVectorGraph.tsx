// SAGATI/components/MindVectorPanel/MindVectorGraph.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip as RechartTooltip,
  Legend,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

type MindVector = {
  // A vector of named dimensions (values expected 0..1 or any normalized scale)
  timestamp: string; // ISO string
  dimensions: { name: string; value: number }[];
  // friendly label describing the visualization state: "BalancedFlow", "MindOverheat", "Anxious", etc.
  visualState?: string;
  // optional emoji or meme id string to show
  emoji?: string;
};

type MindVectorGraphProps = {
  walletAddress?: string; // if supplied, will try to subscribe to updates for this wallet
  websocketUrl?: string; // e.g. wss://api.sagati.com/ws
  fetchApiUrl?: string; // fallback REST endpoint to fetch current MindVector (GET /mindvector/:wallet)
  pollingIntervalMs?: number; // fallback polling interval
  className?: string;
  // optional callback called when new vector arrives
  onUpdate?: (vector: MindVector) => void;
};

const DEFAULT_POLLING_INTERVAL = 15_000; // 15s

// Utility: normalize incoming data to the shape Recharts expects for a RadarChart
function normalizeToRadarData(vector: MindVector) {
  // Recharts radar expects an array of {subject, A} for each axis.
  // We will map { name, value } -> { subject: name, value: normalizedValue }
  // Keep ordering stable by sorting by name
  return vector.dimensions
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({
      subject: d.name,
      value: Number(d.value) || 0,
    }));
}

function friendlyTimestamp(ts?: string) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

export default function MindVectorGraph({
  walletAddress,
  websocketUrl,
  fetchApiUrl,
  pollingIntervalMs = DEFAULT_POLLING_INTERVAL,
  className,
  onUpdate,
}: MindVectorGraphProps) {
  const [current, setCurrent] = useState<MindVector | null>(null);
  const [history, setHistory] = useState<MindVector[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing…");

  const connectWebSocket = useCallback(() => {
    if (!websocketUrl || !walletAddress) {
      setStatusMessage("No WebSocket configured or wallet unspecified — using HTTP fallback.");
      return;
    }

    try {
      const ws = new WebSocket(websocketUrl);
      wsRef.current = ws;
      setStatusMessage("Connecting to live updates…");

      ws.addEventListener("open", () => {
        setStatusMessage("Connected. Subscribing to mind vector updates…");
        // protocol: send subscribe message with wallet (adjust if your server uses different protocol)
        const subscribeMsg = JSON.stringify({ type: "subscribe", topic: "mindVector", wallet: walletAddress });
        ws.send(subscribeMsg);
      });

      ws.addEventListener("message", (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          // Expecting a shape like { type: 'mindVectorUpdate', data: { timestamp, dimensions: [...] } }
          if (payload?.type === "mindVectorUpdate" && payload?.data) {
            const vector: MindVector = {
              timestamp: payload.data.timestamp || new Date().toISOString(),
              dimensions: payload.data.dimensions || [],
              visualState: payload.data.visualState,
              emoji: payload.data.emoji,
            };
            if (!mountedRef.current) return;
            setCurrent(vector);
            setHistory((h) => {
              const next = [vector, ...h].slice(0, 50); // keep up to last 50 entries
              return next;
            });
            onUpdate?.(vector);
            setStatusMessage("Live");
          } else if (payload?.type === "ping") {
            // optional keep-alive
            ws.send(JSON.stringify({ type: "pong" }));
          }
        } catch (err) {
          // ignore malformed messages but log status
          console.warn("Failed to parse websocket message:", err);
        }
      });

      ws.addEventListener("close", () => {
        setStatusMessage("WebSocket closed. Falling back to HTTP.");
        // attempt reconnect after a delay
        setTimeout(() => {
          if (mountedRef.current) connectWebSocket();
        }, 5000);
      });

      ws.addEventListener("error", (err) => {
        console.error("WebSocket error:", err);
        setStatusMessage("WebSocket error. Using HTTP fallback.");
        ws.close();
      });
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      setStatusMessage("WebSocket init error. Using HTTP fallback.");
    }
  }, [websocketUrl, walletAddress, onUpdate]);

  const fetchOnce = useCallback(async () => {
    if (!fetchApiUrl || !walletAddress) {
      setStatusMessage("No HTTP endpoint configured.");
      return;
    }
    try {
      setStatusMessage("Fetching mind vector via HTTP…");
      const url = `${fetchApiUrl.replace(/\/$/, "")}/${encodeURIComponent(walletAddress)}`;
      const resp = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
      if (!resp.ok) {
        setStatusMessage(`HTTP fetch failed: ${resp.status}`);
        return;
      }
      const data = await resp.json();
      // Accept multiple shapes, normalize
      const vector: MindVector = {
        timestamp: data.timestamp || new Date().toISOString(),
        dimensions:
          data.dimensions ||
          (data.vector
            ? data.vector.map((v: any) => ({ name: v.name || v.label || "dim", value: Number(v.value ?? 0) }))
            : []),
        visualState: data.visualState,
        emoji: data.emoji,
      };
      if (!mountedRef.current) return;
      setCurrent(vector);
      setHistory((h) => {
        const next = [vector, ...h].slice(0, 50);
        return next;
      });
      onUpdate?.(vector);
      setStatusMessage("HTTP OK");
    } catch (err) {
      console.error("HTTP fetch error:", err);
      setStatusMessage("HTTP error");
    }
  }, [fetchApiUrl, walletAddress, onUpdate]);

  // initialize on mount
  useEffect(() => {
    mountedRef.current = true;

    // prefer WebSocket if provided
    if (websocketUrl && walletAddress) {
      connectWebSocket();
    } else if (fetchApiUrl && walletAddress) {
      // immediate fetch and polling fallback
      fetchOnce();
      // set up polling
      const id = window.setInterval(() => {
        fetchOnce();
      }, pollingIntervalMs);
      pollingRef.current = id;
    } else {
      setStatusMessage("No data source configured (websocketUrl or fetchApiUrl required).");
    }

    return
