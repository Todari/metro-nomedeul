package config

import (
	"log"

	"github.com/spf13/viper"
)

type Config struct {
	DatabaseURL      string
	DatabaseName     string
	AllowedOrigin    string
	ServerPort       string
	JWTSecret        string
}

var AppConfig Config

func LoadConfig() {
    viper.SetConfigFile(".env")
    viper.AutomaticEnv()

    // 합리적 기본값 (도커/로컬 개발용)
    viper.SetDefault("DATABASE_URL", "mongodb://localhost:27017")
    viper.SetDefault("DATABASE_NAME", "metronomdeul")
    viper.SetDefault("ALLOWED_ORIGIN", "http://localhost:3000")
    viper.SetDefault("PORT", "8080")

	if err := viper.ReadInConfig(); err != nil {
		log.Println("⚠️ No .env file found, using environment variables")
	}

	AppConfig = Config{
		DatabaseURL:      viper.GetString("DATABASE_URL"),
		DatabaseName:     viper.GetString("DATABASE_NAME"),
		AllowedOrigin:    viper.GetString("ALLOWED_ORIGIN"),
		ServerPort:       viper.GetString("PORT"),
		JWTSecret:        viper.GetString("JWT_SECRET"),
	}
}
