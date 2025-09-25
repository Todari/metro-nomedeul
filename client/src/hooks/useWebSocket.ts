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
    let backoffMs = 1000; // 1초부터 시작
    const maxBackoffMs = 30000; // 최대 30초
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10; // 최대 10회 시도
    let shouldReconnect = true;
    
    // 주기적으로 큐 정리 (10초마다)
    const cleanupInterval = setInterval(() => {
      cleanupQueue();
    }, 10000);

    function connect() {
      // 최대 재연결 시도 횟수 초과 시 중단
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.warn('WebSocket 최대 재연결 시도 횟수 초과. 재연결을 중단합니다.');
        return;
      }

      const ws = new WebSocket(url);
      socket.current = ws;

      ws.onopen = () => {
        backoffMs = 1000; // reset
        reconnectAttempts = 0; // 성공 시 카운터 리셋
        
        // 연결되면 큐에 있는 메시지들을 전송
        while (messageQueue.current.length > 0) {
          const item = messageQueue.current.shift();
          if (item) {
            try {
              ws.send(JSON.stringify(item.message));
            } catch (error) {
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

      ws.onclose = (event) => {
        if (!shouldReconnect) return;
        
        // 502, 503, 504 같은 서버 오류는 더 긴 지연시간 적용
        const isServerError = event.code === 1006 || event.code >= 5000;
        const baseDelay = isServerError ? 5000 : backoffMs; // 서버 오류 시 5초부터 시작
        
        const nextDelay = Math.min(baseDelay, maxBackoffMs);
        
        reconnectAttempts++;
        
        setTimeout(() => {
          if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
            backoffMs = Math.min(backoffMs * 1.5, maxBackoffMs); // 더 부드러운 백오프
            connect();
          }
        }, nextDelay);
      };

      ws.onerror = (error) => {
        // 502 오류 등 서버 문제 시 로그 (처음 몇 번만)
        if (reconnectAttempts < 3) {
          console.warn('WebSocket 연결 오류:', error);
        }
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
