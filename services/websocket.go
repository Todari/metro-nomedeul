package services

import (
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Client struct {
	ID       string
	RoomUuid string
	Conn     *websocket.Conn
}

type MetronomeState struct {
	IsPlaying  bool   `json:"isPlaying"`
	Tempo      int    `json:"tempo"`
	Beats      int    `json:"beats"`
	StartTime  int64  `json:"startTime"`
	ServerTime int64  `json:"serverTime"`
	RoomUuid   string `json:"roomUuid"`
	Type       string `json:"type"`
}

type WebSocketService struct {
	clients       map[*Client]bool
	clientsMux    sync.RWMutex
	metronomeData map[string]*MetronomeState
	metronomeMux  sync.RWMutex
	syncTickers   map[string]*time.Ticker
	tickerMux     sync.RWMutex
}

func NewWebSocketService() *WebSocketService {
	return &WebSocketService{
		clients:       make(map[*Client]bool),
		metronomeData: make(map[string]*MetronomeState),
		syncTickers:   make(map[string]*time.Ticker),
	}
}

func (s *WebSocketService) NewClient(userID string, roomUuid string, conn *websocket.Conn) *Client {
	return &Client{
		ID:       userID,
		RoomUuid: roomUuid,
		Conn:     conn,
	}
}

func (s *WebSocketService) AddClient(client *Client) {
	s.clientsMux.Lock()
	defer s.clientsMux.Unlock()
	s.clients[client] = true
	log.Printf("클라이언트 추가됨: %s (방: %s)", client.ID, client.RoomUuid)
}

func (s *WebSocketService) RemoveClient(client *Client) {
	s.clientsMux.Lock()
	defer s.clientsMux.Unlock()
	
	if _, exists := s.clients[client]; exists {
		delete(s.clients, client)
		log.Printf("클라이언트 제거됨: %s (방: %s)", client.ID, client.RoomUuid)
		
		// 방에 남은 클라이언트 수 확인
		clientsInRoom := 0
		for c := range s.clients {
			if c.RoomUuid == client.RoomUuid {
				clientsInRoom++
			}
		}
		
		// 방에 클라이언트가 없으면 메트로놈 정지 및 정리
		if clientsInRoom == 0 {
			s.cleanupRoom(client.RoomUuid)
		}
	}
}

// 방 정리 (메트로놈 정지 및 관련 리소스 해제)
func (s *WebSocketService) cleanupRoom(roomUuid string) {
	log.Printf("방 정리 중: %s", roomUuid)
	
	// 메트로놈 데이터 제거
	s.metronomeMux.Lock()
	delete(s.metronomeData, roomUuid)
	s.metronomeMux.Unlock()
	
	// 동기화 타이머 정지 및 제거
	s.tickerMux.Lock()
	if ticker, exists := s.syncTickers[roomUuid]; exists {
		ticker.Stop()
		delete(s.syncTickers, roomUuid)
	}
	s.tickerMux.Unlock()
}

// 메트로놈 시작
func (s *WebSocketService) StartMetronome(roomUuid string, tempo int, beats int) {
	log.Printf("메트로놈 시작: 방 %s, 템포 %d, 박자 %d", roomUuid, tempo, beats)
	
	// 기존 동기화 타이머 정지
	s.stopSyncTicker(roomUuid)
	now := time.Now().UnixMilli()
	
	// 메트로놈 상태 생성 또는 업데이트
    state, exists := s.metronomeData[roomUuid]
    if !exists {
        // 새 메트로놈 상태 생성
        state = &MetronomeState{
            IsPlaying:  true,
            Tempo:      tempo,
            Beats:      beats,
            StartTime:  now,
            ServerTime: now,
            RoomUuid:   roomUuid,
            Type:       "metronomeState",
        }
        s.metronomeData[roomUuid] = state
    } else {
        // 기존 메트로놈 상태 업데이트
        state.IsPlaying = true
        state.Tempo = tempo
        state.Beats = beats
        state.StartTime = now
        state.ServerTime = now
    }
    s.metronomeMux.Unlock()
	
	// 상태 브로드캐스트
	s.BroadcastMetronomeState(roomUuid)
	
	// 동기화 타이머 시작 (3초마다)
	s.startSyncTicker(roomUuid, 3*time.Second)
}

// 동기화 타이머 시작
func (s *WebSocketService) startSyncTicker(roomUuid string, interval time.Duration) {
	ticker := time.NewTicker(interval)
	
	s.tickerMux.Lock()
	s.syncTickers[roomUuid] = ticker
	s.tickerMux.Unlock()
	
	go func() {
		for range ticker.C {
			s.metronomeMux.RLock()
			state, exists := s.metronomeData[roomUuid]
			s.metronomeMux.RUnlock()
			
			if !exists || !state.IsPlaying {
				s.stopSyncTicker(roomUuid)
				return
			}
			
			// 동기화 신호 전송
			s.BroadcastMetronomeState(roomUuid)
		}
	}()
}

// 동기화 타이머 정지
func (s *WebSocketService) stopSyncTicker(roomUuid string) {
	s.tickerMux.Lock()
	defer s.tickerMux.Unlock()
	
	if ticker, exists := s.syncTickers[roomUuid]; exists {
		ticker.Stop()
		delete(s.syncTickers, roomUuid)
	}
}

// 메트로놈 상태 브로드캐스트
func (s *WebSocketService) BroadcastMetronomeState(roomUuid string) {
	s.metronomeMux.RLock()
	state, exists := s.metronomeData[roomUuid]
	if !exists {
		s.metronomeMux.RUnlock()
		return
	}
	
	// 현재 서버 시간 업데이트
	state.ServerTime = time.Now().UnixMilli()
	s.metronomeMux.RUnlock()
	
	s.clientsMux.RLock()
	defer s.clientsMux.RUnlock()
	
	for client := range s.clients {
		if client.RoomUuid == roomUuid {
			err := client.Conn.WriteJSON(state)
			if err != nil {
				log.Printf("메트로놈 상태 전송 실패 (클라이언트 %s): %v", client.ID, err)
				go s.RemoveClient(client)
			}
		}
	}
}

// 새 클라이언트 연결 시 현재 메트로놈 상태 전송
func (s *WebSocketService) SendCurrentMetronomeState(client *Client) {
	s.metronomeMux.RLock()
	defer s.metronomeMux.RUnlock()
	
	state, exists := s.metronomeData[client.RoomUuid]
	if exists {
		// 현재 서버 시간 업데이트
		state.ServerTime = time.Now().UnixMilli()
		err := client.Conn.WriteJSON(state)
		if err != nil {
			log.Printf("메트로놈 상태 전송 실패 (클라이언트 %s): %v", client.ID, err)
		}
	}
}

// 메트로놈 정지
func (s *WebSocketService) StopMetronome(roomUuid string) {
	log.Printf("메트로놈 정지: 방 %s", roomUuid)
	
	s.metronomeMux.Lock()
	state, exists := s.metronomeData[roomUuid]
	if !exists {
		s.metronomeMux.Unlock()
		return
	}
	
	// 메트로놈 상태 업데이트
	state.IsPlaying = false
	state.ServerTime = time.Now().UnixMilli()
	s.metronomeMux.Unlock()
	
	// 동기화 타이머 정지
	s.stopSyncTicker(roomUuid)
	
	// 정지 상태 브로드캐스트
	s.BroadcastMetronomeState(roomUuid)
}

// 템포 변경
func (s *WebSocketService) ChangeTempo(roomUuid string, tempo int) {
	log.Printf("템포 변경: 방 %s, 새 템포 %d", roomUuid, tempo)
	
	s.metronomeMux.Lock()
	state, exists := s.metronomeData[roomUuid]
	if !exists {
		s.metronomeMux.Unlock()
		return
	}
	
	// 메트로놈이 실행 중이면 시작 시간 재설정
	if state.IsPlaying {
		state.StartTime = time.Now().UnixMilli()
	}
	
	// 템포 업데이트
	state.Tempo = tempo
	state.ServerTime = time.Now().UnixMilli()
	s.metronomeMux.Unlock()
	
	// 변경된 상태 브로드캐스트
	s.BroadcastMetronomeState(roomUuid)
}

func (s *WebSocketService) ChangeBeats(roomUuid string, beats int) {
	log.Printf("박자 변경: 방 %s, 새 박자 %d", roomUuid, beats)
	
	s.metronomeMux.Lock()
	state, exists := s.metronomeData[roomUuid]
	if !exists {
		s.metronomeMux.Unlock()
		return
	}
	
	state.Beats = beats
	state.ServerTime = time.Now().UnixMilli()
	s.metronomeMux.Unlock()
	
	s.BroadcastMetronomeState(roomUuid)
}

