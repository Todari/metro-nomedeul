import { MetronomeState } from '../types/model';
import { useEffect, useRef, useState, useCallback } from 'react';

export const useWebSocket = (url: string) => {
  const socket = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<MetronomeState[]>([]);

  useEffect(() => {
    let backoffMs = 500;
    let shouldReconnect = true;

    function connect() {
      const ws = new WebSocket(url);
      socket.current = ws;

      ws.onopen = () => {
        backoffMs = 500; // reset
        console.log('WebSocket connection opened');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setMessages((prev) => [...prev, data]);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        if (!shouldReconnect) return;
        const nextDelay = Math.min(backoffMs, 10_000);
        setTimeout(() => {
          backoffMs = Math.min(backoffMs * 2, 10_000);
          connect();
        }, nextDelay);
      };

      ws.onerror = () => {
        // error handled by onclose flow
      };
    }

    connect();
    return () => {
      shouldReconnect = false;
      socket.current?.close();
    };
  }, [url]);

  const sendMessage = useCallback((message: unknown) => {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(message));
    }
  }, []);

  return {messages, sendMessage, socket: socket.current};
};
