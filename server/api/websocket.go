package api

import (
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/Todari/metro-nomedeul-server/config"
	"github.com/Todari/metro-nomedeul-server/services"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type WebSocketHandler struct {
	Service *services.WebSocketService
}

func NewWebSocketHandler(service *services.WebSocketService) *WebSocketHandler {
	return &WebSocketHandler{Service: service}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,  // 버퍼 크기 증가
	WriteBufferSize: 4096,  // 버퍼 크기 증가
	HandshakeTimeout: 10 * time.Second, // 핸드셰이크 타임아웃
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		allowed := config.GetAllowedOrigins()
		if len(allowed) == 0 {
			return true
		}
		for _, a := range allowed {
			if strings.EqualFold(strings.TrimSpace(a), origin) {
				return true
			}
		}
		return false
	},
}

func (h *WebSocketHandler) HandleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("WebSocket 업그레이드 오류:", err)
		return
	}
	defer conn.Close()

	userID := c.Query("userId")
	uuid := c.Param("uuid")

	log.Printf("새 클라이언트 연결: %s (방: %s)", userID, uuid)

	client := h.Service.NewClient(userID, uuid, conn)
	h.Service.AddClient(client)
	
	// 새 클라이언트에게 현재 메트로놈 상태 전송
	h.Service.SendCurrentMetronomeState(client)

	// 연결 상태 모니터링을 위한 티커
	pingTicker := time.NewTicker(30 * time.Second)
	defer pingTicker.Stop()

	// 메시지 처리 루프
	for {
		select {
		case <-pingTicker.C:
			// 핑 메시지 전송으로 연결 상태 확인
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("핑 메시지 전송 실패: %v", err)
				h.Service.RemoveClient(client)
				return
			}
		default:
			// 메시지 읽기 (타임아웃 설정)
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			var msg map[string]interface{}
			err := conn.ReadJSON(&msg)
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket 읽기 오류: %v", err)
				}
				h.Service.RemoveClient(client)
				return
			}
		
		// 메시지 타입에 따라 처리
		if action, ok := msg["action"].(string); ok {
			switch action {
			case "startMetronome":
				log.Println("메트로놈 시작 요청 수신")
				
				tempo := 128 // 기본값
				beats := 4 // 기본값
				if t, ok := msg["tempo"].(float64); ok {
					tempo = int(t)
				}
				if b, ok := msg["beats"].(float64); ok {
					beats = int(b)
				}
				h.Service.StartMetronome(uuid, tempo, beats)
				
			case "stopMetronome":
				log.Println("메트로놈 정지 요청 수신")
				h.Service.StopMetronome(uuid)
				
			case "changeTempo":
				log.Println("템포 변경 요청 수신")
				
				tempo := 128 // 기본값
				if t, ok := msg["tempo"].(float64); ok {
					tempo = int(t)
				}
				h.Service.ChangeTempoWithStop(uuid, tempo)

			case "changeBeats":
				log.Println("박자 변경 요청 수신")
				
				beats := 4 // 기본값
				if b, ok := msg["beats"].(float64); ok {
					beats = int(b)
				}
				h.Service.ChangeBeatsWithStop(uuid, beats)
				
			case "requestSync":
				log.Println("동기화 요청 수신")
				h.Service.BroadcastMetronomeState(uuid)
				
			default:
				log.Printf("알 수 없는 액션: %s", action)
			}
		}
		}
	}
}