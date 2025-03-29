package main

import (
	"log"

	"github.com/Todari/metro-nomedeul-server/api"
	"github.com/Todari/metro-nomedeul-server/config"
	"github.com/Todari/metro-nomedeul-server/database"
	"github.com/Todari/metro-nomedeul-server/repository"
	"github.com/Todari/metro-nomedeul-server/routes"
	"github.com/Todari/metro-nomedeul-server/services"
)

func main() {
	config.LoadConfig()        // 환경 변수 로드
	database.ConnectDatabase() // PostgreSQL 연결

	roomRepository := repository.NewRoomRepository(database.DB)
	roomService := services.NewRoomService(roomRepository)
	roomHandler := api.NewRoomHandler(roomService)

	websocketService := services.NewWebSocketService()
	websocketHandler := api.NewWebSocketHandler(websocketService)

	r := routes.SetupRouter(roomHandler, websocketHandler) // *gin.Engine 반환

	port := config.AppConfig.ServerPort
	log.Println("🚀 Server running on port:", port)
	r.Run(":" + port)
}
