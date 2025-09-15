import { MetronomeState } from '../types/model';
import { useEffect, useRef, useState, useCallback } from 'react';

export const useWebSocket = (url: string, onMessage?: (data: MetronomeState) => void) => {
  const socket = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<MetronomeState[]>([]);
  const messageQueue = useRef<unknown[]>([]);

  useEffect(() => {
    let backoffMs = 500;
    let shouldReconnect = true;

    function connect() {
      const ws = new WebSocket(url);
      socket.current = ws;

      ws.onopen = () => {
        backoffMs = 500; // reset
        console.log('WebSocket connection opened');
        
        // 연결되면 큐에 있는 메시지들을 전송
        while (messageQueue.current.length > 0) {
          const message = messageQueue.current.shift();
          if (message) {
            try {
              ws.send(JSON.stringify(message));
            } catch (error) {
              console.error('큐 메시지 전송 실패:', error);
            }
          }
        }
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setMessages((prev) => [...prev, data]);
        // 메시지 콜백 호출
        if (onMessage) {
          onMessage(data);
        }
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
  }, [url, onMessage]);

  const sendMessage = useCallback((message: unknown) => {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      try {
        socket.current.send(JSON.stringify(message));
      } catch (error) {
        console.error('메시지 전송 실패:', error);
        // 전송 실패 시 큐에 추가
        messageQueue.current.push(message);
      }
    } else {
      // WebSocket이 준비되지 않았으면 큐에 추가
      messageQueue.current.push(message);
    }
  }, []);

  return {messages, sendMessage, socket: socket.current};
};
