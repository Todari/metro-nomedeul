package repository

import (
	"context"
	"errors"
	"time"

	"github.com/Todari/metro-nomedeul-server/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type RoomRepository struct {
	Collection *mongo.Collection
}

func NewRoomRepository(db *mongo.Database) *RoomRepository {
	r := &RoomRepository{Collection: db.Collection("rooms")}
	// uuid 유니크 인덱스 보장 (존재하면 noop)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _ = r.Collection.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.M{"uuid": 1},
		Options: options.Index().SetUnique(true).SetName("uniq_uuid"),
	})
	return r
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
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrRoomNotFound
		}
		return nil, err
	}
	return &room, nil
}

var ErrRoomNotFound = errors.New("room not found")
