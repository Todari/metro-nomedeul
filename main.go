package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Todari/metro-nomedeul-server/api"
	"github.com/Todari/metro-nomedeul-server/config"
	"github.com/Todari/metro-nomedeul-server/database"
	"github.com/Todari/metro-nomedeul-server/repository"
	"github.com/Todari/metro-nomedeul-server/routes"
	"github.com/Todari/metro-nomedeul-server/services"
)

func main() {
	config.LoadConfig()        // 환경 변수 로드
	database.ConnectDatabase() // MongoDB 연결

	roomRepository := repository.NewRoomRepository(database.DB)
	roomService := services.NewRoomService(roomRepository)
	roomHandler := api.NewRoomHandler(roomService)

	websocketService := services.NewWebSocketService()
	websocketHandler := api.NewWebSocketHandler(websocketService)

	r := routes.SetupRouter(roomHandler, websocketHandler) // *gin.Engine 반환

	port := config.AppConfig.ServerPort
	server := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	// 서버 시작
	go func() {
		log.Println("🚀 Server running on port:", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server listen error: %v", err)
		}
	}()

	// OS 신호 대기 및 그레이스풀 셧다운
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("🛑 Shutdown signal received")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("server shutdown error: %v", err)
	}

	// DB 연결 정리
	database.DisconnectDatabase(ctx)
}
