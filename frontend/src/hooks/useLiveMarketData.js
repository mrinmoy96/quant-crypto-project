import { useEffect, useRef, useState } from "react";

// Derives ws:// or wss:// from VITE_API_URL (or the current origin),
// matching the http(s) scheme.
function getWebSocketUrl() {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5015";
  const url = new URL(apiUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  return url.toString();
}

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;

// Phase 9: subscribes to the backend's live market feed over WebSocket.
// Falls back gracefully — if the socket never connects (e.g. dev server
// not running), `connected` just stays false; callers should keep
// showing their last REST-fetched data rather than blocking on this.
export function useLiveMarketData() {
  const [instruments, setInstruments] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connected, setConnected] = useState(false);
  const reconnectAttempt = useRef(0);
  const socketRef = useRef(null);
  const closedByCleanup = useRef(false);

  useEffect(() => {
    closedByCleanup.current = false;

    function connect() {
      const socket = new WebSocket(getWebSocketUrl());
      socketRef.current = socket;

      socket.onopen = () => {
        setConnected(true);
        reconnectAttempt.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "tick") {
            setInstruments(message.instruments);
            setLastUpdate(message.timestamp);
          }
        } catch {
          // Malformed message — ignore this one, keep the connection.
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (closedByCleanup.current) return;

        // Reconnect with exponential backoff (capped) rather than
        // hammering the server if it's down for a while.
        const delay = Math.min(
          RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt.current,
          RECONNECT_MAX_DELAY_MS
        );
        reconnectAttempt.current += 1;
        setTimeout(() => {
          if (!closedByCleanup.current) connect();
        }, delay);
      };

      socket.onerror = () => {
        // onclose fires right after — reconnect logic lives there.
        socket.close();
      };
    }

    connect();

    return () => {
      closedByCleanup.current = true;
      socketRef.current?.close();
    };
  }, []);

  return { instruments, lastUpdate, connected };
}
