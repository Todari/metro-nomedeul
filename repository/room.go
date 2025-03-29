package repository

import (
	"context"
	"time"

	"github.com/Todari/metro-nomedeul-server/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type RoomRepository struct {
	Collection *mongo.Collection
}

func NewRoomRepository(db *mongo.Database) *RoomRepository {
	return &RoomRepository{Collection: db.Collection("rooms")}
}

func (r *RoomRepository) CreateRoom(room *models.Room) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	_, err := r.Collection.InsertOne(ctx, room)
	return err
}

func (r *RoomRepository) GetRoom(uuid string) (*models.Room, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	var room models.Room
	err := r.Collection.FindOne(ctx, bson.M{"uuid": uuid}).Decode(&room)
	if err != nil {
		return nil, err
	}
	return &room, nil
}
