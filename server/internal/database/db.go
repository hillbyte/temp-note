package database

import (
	"database/sql"
	"log"
	"os"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB() {
	var err error
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./tempnote.db"
	}

	DB, err = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}

	// Create tables
	schema := `
	CREATE TABLE IF NOT EXISTS notes (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL DEFAULT 'Untitled',
		content TEXT NOT NULL DEFAULT '',
		password_hash TEXT,
		admin_token TEXT,
		expires_at DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		view_count INTEGER DEFAULT 0
	);

	CREATE INDEX IF NOT EXISTS idx_notes_expires_at ON notes(expires_at);
	`

	_, err = DB.Exec(schema)
	if err != nil {
		log.Fatal("Failed to create schema:", err)
	}

	// Try adding the admin_token column in case of existing db
	_, _ = DB.Exec("ALTER TABLE notes ADD COLUMN admin_token TEXT")

	// Start cleanup goroutine
	go cleanupExpiredNotes()
}

func cleanupExpiredNotes() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		nowUTC := time.Now().UTC().Format(time.RFC3339)
		result, err := DB.Exec("DELETE FROM notes WHERE expires_at IS NOT NULL AND expires_at < ?", nowUTC)
		if err != nil {
			log.Println("Cleanup error:", err)
			continue
		}
		if rows, _ := result.RowsAffected(); rows > 0 {
			log.Printf("Cleaned up %d expired notes\n", rows)
		}
	}
}
