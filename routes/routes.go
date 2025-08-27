package routes

import (
	"github.com/Todari/metro-nomedeul-server/api"
	"github.com/Todari/metro-nomedeul-server/config"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"log"
	"strings"
)

func SetupRouter(roomHandler *api.RoomHandler, websocketHandler *api.WebSocketHandler) *gin.Engine {
	r := gin.Default()

	// CORS 설정 (콤마 분리된 다중 오리진 지원)
	allowed := config.GetAllowedOrigins()

	// CORS 디버그 로깅 미들웨어
	r.Use(func(c *gin.Context) {
		requestOrigin := c.Request.Header.Get("Origin")
		trimmedRequestOrigin := strings.TrimRight(requestOrigin, "/")
		exact := false
		trimMatch := false
		for _, o := range allowed {
			if o == requestOrigin {
				exact = true
			}
			if strings.TrimRight(o, "/") == trimmedRequestOrigin && requestOrigin != "" {
				trimMatch = true
			}
		}
		log.Printf("[CORS DEBUG] Origin=%q Method=%s Path=%s Host=%s AllowedRaw=%q AllowedList=%v Exact=%t TrimMatch=%t",
			requestOrigin,
			c.Request.Method,
			c.Request.URL.Path,
			c.Request.Host,
			config.AppConfig.AllowedOrigin,
			allowed,
			exact,
			trimMatch,
		)
		c.Next()
	})

	c := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"baggage", "content-type", "sentry-trace", "authorization"},
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

	// 헬스체크
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

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
