package api

import (
	"net/http"

	"github.com/Todari/metro-nomedeul-server/config"
	"github.com/Todari/metro-nomedeul-server/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type RoomHandler struct {
	Service *services.RoomService
}

func NewRoomHandler(service *services.RoomService) *RoomHandler {
	return &RoomHandler{Service: service}
}

func (h *RoomHandler) RegisterRoom(c *gin.Context) {
	roomUuid, err := h.Service.RegisterRoom()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"uuid": roomUuid})
}

func (h *RoomHandler) GetRoom(c *gin.Context) {
	roomUuid := c.Param("uuid")
	if _, err := uuid.Parse(roomUuid); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room UUID"})
		return
	}

	room, err := h.Service.GetRoom(roomUuid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	c.JSON(http.StatusOK, room)
}

// 방 입장을 위한 QR 코드 PNG를 반환
func (h *RoomHandler) GetRoomQR(c *gin.Context) {
    roomUuid := c.Param("uuid")
    if _, err := uuid.Parse(roomUuid); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room UUID"})
        return
    }

    // 프론트엔드에서 방에 입장할 때 사용할 URL 구성
    // 예: https://app.example.com/room/{uuid}
    base := config.AppConfig.AllowedOrigin
    if base == "" {
        // 기본값(개발): 로컬 프론트엔드 가정
        base = "http://localhost:5173"
    }
    joinURL := base + "/room/" + roomUuid
    // 서버는 QR 이미지를 직접 생성하지 않고, 클라이언트가 QR을 생성할 수 있도록 링크를 반환
    c.JSON(http.StatusOK, gin.H{
        "joinUrl": joinURL,
    })
}

