package routes

import (
	"github.com/Todari/metro-nomedeul-server/api"
	"github.com/Todari/metro-nomedeul-server/config"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter(roomHandler *api.RoomHandler, websocketHandler *api.WebSocketHandler) *gin.Engine {
	r := gin.Default()

	// CORS 설정 추가
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{config.AppConfig.AllowedOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"baggage", "content-type", "sentry-trace"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	roomRoutes := r.Group("/room")
	{
		roomRoutes.POST("", roomHandler.RegisterRoom)
		roomRoutes.GET("/:uuid", roomHandler.GetRoom)
	}

	wsRoutes := r.Group("/ws")
	{
		wsRoutes.GET("/:uuid", websocketHandler.HandleWebSocket)
	}

	return r
}
