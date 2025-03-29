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
