package routes

import (
	"github.com/Todari/metro-nomedeul-server/api"
	"github.com/Todari/metro-nomedeul-server/config"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter(roomHandler *api.RoomHandler, websocketHandler *api.WebSocketHandler) *gin.Engine {
	r := gin.Default()

    // CORS 설정 (콤마 분리된 다중 오리진 지원)
    allowed := config.GetAllowedOrigins()
    c := cors.Config{
        AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"baggage", "content-type", "sentry-trace"},
        ExposeHeaders:    []string{"Content-Length"},
        AllowCredentials: true,
    }
    if len(allowed) == 0 {
        // 개발 편의를 위해 오리진 미설정 시 전체 허용 (운영에서는 반드시 설정 권장)
        c.AllowAllOrigins = true
    } else {
        c.AllowOrigins = allowed
    }
    r.Use(cors.New(c))

    roomRoutes := r.Group("/room")
	{
		roomRoutes.POST("", roomHandler.RegisterRoom)
		roomRoutes.GET("/:uuid", roomHandler.GetRoom)
    roomRoutes.GET("/:uuid/qr", roomHandler.GetRoomQR)
	}

	wsRoutes := r.Group("/ws")
	{
		wsRoutes.GET("/:uuid", websocketHandler.HandleWebSocket)
	}

	return r
}
