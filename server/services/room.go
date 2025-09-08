package services

import (
	"log"
	"time"

	"github.com/Todari/metro-nomedeul-server/models"
	"github.com/Todari/metro-nomedeul-server/repository"
	nanoid "github.com/matoous/go-nanoid/v2"
)

type RoomService struct {
	Repo *repository.RoomRepository
}

func NewRoomService(repo *repository.RoomRepository) *RoomService {
	return &RoomService{Repo: repo}
}

func (s *RoomService) RegisterRoom() (string, error) {
	// nanoid를 사용하여 8자리 짧은 ID 생성 (URL-safe, 충돌 확률 낮음)
	roomId, err := nanoid.New(8)
	if err != nil {
		return "", err
	}
	log.Printf("Generated nanoid: %s", roomId)
	now := time.Now()
	room := models.Room{RoomId: roomId, CreatedAt: now, UpdatedAt: now}
	err = s.Repo.CreateRoom(&room)
	if err != nil {
		return "", err
	}
	log.Printf("Created room with ID: %s", roomId)
	return roomId, nil
}

func (s *RoomService) GetRoom(roomId string) (*models.Room, error) {
	return s.Repo.GetRoom(roomId)
}

