import { MetronomeState } from '../types/model';
import { useEffect, useRef, useState, useCallback } from 'react';

export const useWebSocket = (url: string, onMessage?: (data: MetronomeState) => void) => {
  const socket = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<MetronomeState[]>([]);
  const messageQueue = useRef<Array<{message: unknown, timestamp: number, id: string}>>([]);
  const maxQueueSize = 50; // 최대 큐 크기
  const maxMessageAge = 30000; // 메시지 최대 유효 시간 (30초)
  const messageIdCounter = useRef(0);

  // 큐 정리 함수
  const cleanupQueue = useCallback(() => {
    const now = Date.now();
    messageQueue.current = messageQueue.current
      .filter(item => now - item.timestamp < maxMessageAge) // 오래된 메시지 제거
      .slice(-maxQueueSize); // 최대 크기 제한
  }, [maxMessageAge, maxQueueSize]);

  // 중복 메시지 제거 함수
  const removeDuplicateMessages = useCallback((newMessage: unknown) => {
    if (typeof newMessage === 'object' && newMessage !== null) {
      const messageObj = newMessage as {action?: string};
      if (messageObj.action) {
        // 같은 액션의 메시지가 있으면 제거 (최신 것만 유지)
        messageQueue.current = messageQueue.current.filter(item => {
          if (typeof item.message === 'object' && item.message !== null) {
            const itemObj = item.message as {action?: string};
            return !(itemObj.action === messageObj.action);
          }
          return true;
        });
      }
    }
  }, []);

  // 메시지를 큐에 추가하는 함수
  const addToQueue = useCallback((message: unknown) => {
    const messageId = `msg_${++messageIdCounter.current}`;
    const timestamp = Date.now();
    
    // 중복 메시지 제거
    removeDuplicateMessages(message);
    
    // 큐에 추가
    messageQueue.current.push({message, timestamp, id: messageId});
    
    // 큐 정리
    cleanupQueue();
    
  }, [removeDuplicateMessages, cleanupQueue]);

  useEffect(() => {
    let backoffMs = 500;
    let shouldReconnect = true;
    
    // 주기적으로 큐 정리 (10초마다)
    const cleanupInterval = setInterval(() => {
      cleanupQueue();
    }, 10000);

    function connect() {
      const ws = new WebSocket(url);
      socket.current = ws;

      ws.onopen = () => {
        backoffMs = 500; // reset
        console.log('WebSocket connection opened');
        
        // 연결되면 큐에 있는 메시지들을 전송
        while (messageQueue.current.length > 0) {
          const item = messageQueue.current.shift();
          if (item) {
            try {
              ws.send(JSON.stringify(item.message));
            } catch (error) {
              console.error('큐 메시지 전송 실패:', error);
              // 전송 실패 시 다시 큐에 추가
              messageQueue.current.unshift(item);
              break;
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
      clearInterval(cleanupInterval);
      socket.current?.close();
    };
  }, [url, onMessage, cleanupQueue]);

  const sendMessage = useCallback((message: unknown) => {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      try {
        socket.current.send(JSON.stringify(message));
      } catch (error) {
        console.error('메시지 전송 실패:', error);
        // 전송 실패 시 큐에 추가
        addToQueue(message);
      }
    } else {
      // WebSocket이 준비되지 않았으면 큐에 추가
      addToQueue(message);
    }
  }, [addToQueue]);

  return {messages, sendMessage, socket: socket.current};
};
