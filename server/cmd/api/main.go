package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"tempnote/internal/database"
	"tempnote/internal/handlers"
	"tempnote/internal/middleware"
)

func main() {
	database.InitDB()
	defer database.DB.Close()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/", handlers.ApiRouter)

	handler := middleware.CorsMiddleware(mux)

	fmt.Printf("🗒️  TempNote server running on http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
