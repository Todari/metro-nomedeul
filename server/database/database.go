package database

import (
	"context"
	"log"
	"time"

	"github.com/Todari/metro-nomedeul-server/config"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var Client *mongo.Client
var DB *mongo.Database

func ConnectDatabase() {
	// MongoDB 연결 문자열 생성
	uri := config.AppConfig.DatabaseURL

	// MongoDB 클라이언트 옵션 설정
	clientOptions := options.Client().ApplyURI(uri)

	// 컨텍스트 생성 (타임아웃 10초)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// MongoDB 연결
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Fatal("❌ Failed to connect to the database:", err)
	}

	// 연결 확인
	err = client.Ping(ctx, nil)
	if err != nil {
		log.Fatal("❌ Failed to ping the database:", err)
	}

	log.Println("✅ Database connected successfully")
	
	// 데이터베이스 선택
	DB = client.Database(config.AppConfig.DatabaseName)
	Client = client
}

// DisconnectDatabase는 애플리케이션 종료 시점에 MongoDB 연결을 정리합니다.
func DisconnectDatabase(ctx context.Context) {
	if Client == nil {
		return
	}
	if err := Client.Disconnect(ctx); err != nil {
		log.Println("⚠️ Failed to disconnect the database:", err)
		return
	}
	log.Println("🛑 Database disconnected")
}

// Ping은 데이터베이스 연결 상태를 확인합니다.
func Ping(ctx context.Context) error {
	if Client == nil {
		return mongo.ErrClientDisconnected
	}
	return Client.Ping(ctx, nil)
}