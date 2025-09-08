package api

import (
	"net/http"

	"github.com/Todari/metro-nomedeul-server/repository"
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
		if err == repository.ErrRoomNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	c.JSON(http.StatusOK, room)
}

