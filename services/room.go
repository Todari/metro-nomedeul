package services

import (
	"time"

	"github.com/Todari/metro-nomedeul-server/models"
	"github.com/Todari/metro-nomedeul-server/repository"
	"github.com/google/uuid"
)

type RoomService struct {
	Repo *repository.RoomRepository
}

func NewRoomService(repo *repository.RoomRepository) *RoomService {
	return &RoomService{Repo: repo}
}

func (s *RoomService) RegisterRoom() (string, error) {
	uuid := uuid.New().String()
	now := time.Now()
	room := models.Room{Uuid: uuid, CreatedAt: now, UpdatedAt: now}
	err := s.Repo.CreateRoom(&room)
	if err != nil {
		return "", err
	}
	return uuid, nil
}

func (s *RoomService) GetRoom(uuid string) (*models.Room, error) {
	return s.Repo.GetRoom(uuid)
}

