package api

import (
	"net/http"
	"regexp"

	"github.com/Todari/metro-nomedeul-server/repository"
	"github.com/Todari/metro-nomedeul-server/services"
	"github.com/gin-gonic/gin"
)

type RoomHandler struct {
	Service *services.RoomService
}

func NewRoomHandler(service *services.RoomService) *RoomHandler {
	return &RoomHandler{Service: service}
}

func (h *RoomHandler) RegisterRoom(c *gin.Context) {
	roomId, err := h.Service.RegisterRoom()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"uuid": roomId})
}

func (h *RoomHandler) GetRoom(c *gin.Context) {
	roomId := c.Param("uuid")
	// nanoid는 8자리 영숫자 문자열이므로 간단한 정규식으로 검증
	if matched, _ := regexp.MatchString(`^[A-Za-z0-9_-]{8}$`, roomId); !matched {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID format"})
		return
	}

	room, err := h.Service.GetRoom(roomId)
	if err != nil {
		if err == repository.ErrRoomNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	c.JSON(http.StatusOK, room)
}

