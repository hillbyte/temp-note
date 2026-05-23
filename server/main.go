package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB

// Note represents a note in the database
type Note struct {
	ID        string  `json:"id"`
	Title     string  `json:"title"`
	Content   string  `json:"content"`
	Password  string  `json:"password,omitempty"`
	HasPass   bool    `json:"has_password"`
	ExpiresAt *string `json:"expires_at,omitempty"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
	ViewCount int     `json:"view_count"`
	IsExpired bool    `json:"is_expired"`
}

// CreateNoteRequest represents the request body for creating a note
type CreateNoteRequest struct {
	Title    string `json:"title"`
	Content  string `json:"content"`
	Password string `json:"password,omitempty"`
	ExpireIn string `json:"expire_in,omitempty"` // "1h", "6h", "24h", "7d", "30d", "never"
}

// UnlockRequest represents the request body for unlocking a note
type UnlockRequest struct {
	Password string `json:"password"`
}

// APIResponse is a generic API response wrapper
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func generateID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func initDB() {
	var err error
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./tempnote.db"
	}

	db, err = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
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

	_, err = db.Exec(schema)
	if err != nil {
		log.Fatal("Failed to create schema:", err)
	}

	// Try adding the admin_token column in case of existing db
	_, _ = db.Exec("ALTER TABLE notes ADD COLUMN admin_token TEXT")

	// Start cleanup goroutine
	go cleanupExpiredNotes()
}

func cleanupExpiredNotes() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		nowUTC := time.Now().UTC().Format(time.RFC3339)
		result, err := db.Exec("DELETE FROM notes WHERE expires_at IS NOT NULL AND expires_at < ?", nowUTC)
		if err != nil {
			log.Println("Cleanup error:", err)
			continue
		}
		if rows, _ := result.RowsAffected(); rows > 0 {
			log.Printf("Cleaned up %d expired notes\n", rows)
		}
	}
}

// parseExpiry tries multiple datetime formats that go-sqlite3 may return
func parseExpiry(s string) (time.Time, error) {
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05Z",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unable to parse time: %q", s)
}

func calculateExpiry(expireIn string) *time.Time {
	if expireIn == "" || expireIn == "never" {
		return nil
	}

	var duration time.Duration
	switch expireIn {
	case "1h":
		duration = 1 * time.Hour
	case "6h":
		duration = 6 * time.Hour
	case "24h":
		duration = 24 * time.Hour
	case "7d":
		duration = 7 * 24 * time.Hour
	case "30d":
		duration = 30 * 24 * time.Hour
	default:
		return nil
	}

	t := time.Now().UTC().Add(duration)
	return &t
}

// CORS middleware
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Admin-Token")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// POST /api/notes
func createNote(w http.ResponseWriter, r *http.Request) {
	var req CreateNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, APIResponse{Error: "Invalid request body"})
		return
	}

	id := generateID()

	var passwordHash *string
	if req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, APIResponse{Error: "Failed to hash password"})
			return
		}
		h := string(hash)
		passwordHash = &h
	}

	expiresAt := calculateExpiry(req.ExpireIn)

	var expiresAtStr *string
	if expiresAt != nil {
		s := expiresAt.Format("2006-01-02 15:04:05")
		expiresAtStr = &s
	}

	title := req.Title
	if title == "" {
		title = "Untitled"
	}

	adminToken := generateID() + generateID()

	_, err := db.Exec(
		"INSERT INTO notes (id, title, content, password_hash, admin_token, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
		id, title, req.Content, passwordHash, adminToken, expiresAtStr,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, APIResponse{Error: "Failed to create note"})
		return
	}

	note := Note{
		ID:      id,
		Title:   title,
		Content: req.Content,
		HasPass: passwordHash != nil,
	}
	if expiresAtStr != nil {
		note.ExpiresAt = expiresAtStr
	}

	// Attach admin token so frontend can store it
	writeJSON(w, http.StatusCreated, APIResponse{Success: true, Data: map[string]interface{}{
		"note": note,
		"admin_token": adminToken,
	}})
}

// GET /api/notes/{id}
func getNote(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/notes/")
	if strings.Contains(id, "/") {
		// Handle /api/notes/{id}/unlock
		parts := strings.SplitN(id, "/", 2)
		id = parts[0]
		if parts[1] == "unlock" {
			unlockNote(w, r, id)
			return
		}
	}

	var note Note
	var passwordHash sql.NullString
	var expiresAt sql.NullString
	var createdAt, updatedAt string

	err := db.QueryRow(
		"SELECT id, title, content, password_hash, expires_at, created_at, updated_at, view_count FROM notes WHERE id = ?",
		id,
	).Scan(&note.ID, &note.Title, &note.Content, &passwordHash, &expiresAt, &createdAt, &updatedAt, &note.ViewCount)

	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, APIResponse{Error: "Note not found or has expired"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, APIResponse{Error: "Failed to fetch note"})
		return
	}

	// Check expiry
	if expiresAt.Valid {
		expTime, err := parseExpiry(expiresAt.String)
		if err == nil && time.Now().UTC().After(expTime) {
			db.Exec("DELETE FROM notes WHERE id = ?", id)
			writeJSON(w, http.StatusNotFound, APIResponse{Error: "Note has expired"})
			return
		}
		note.ExpiresAt = &expiresAt.String
	}

	note.HasPass = passwordHash.Valid
	note.CreatedAt = createdAt
	note.UpdatedAt = updatedAt

	// If password protected, don't send content
	if note.HasPass {
		note.Content = ""
		writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: note})
		return
	}

	// Increment view count
	db.Exec("UPDATE notes SET view_count = view_count + 1 WHERE id = ?", id)
	note.ViewCount++

	writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: note})
}

// POST /api/notes/{id}/unlock
func unlockNote(w http.ResponseWriter, r *http.Request, id string) {
	var req UnlockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, APIResponse{Error: "Invalid request body"})
		return
	}

	var note Note
	var passwordHash sql.NullString
	var expiresAt sql.NullString
	var createdAt, updatedAt string

	err := db.QueryRow(
		"SELECT id, title, content, password_hash, expires_at, created_at, updated_at, view_count FROM notes WHERE id = ?",
		id,
	).Scan(&note.ID, &note.Title, &note.Content, &passwordHash, &expiresAt, &createdAt, &updatedAt, &note.ViewCount)

	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, APIResponse{Error: "Note not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, APIResponse{Error: "Database error"})
		return
	}

	// Check expiry
	if expiresAt.Valid {
		expTime, err := parseExpiry(expiresAt.String)
		if err == nil && time.Now().UTC().After(expTime) {
			db.Exec("DELETE FROM notes WHERE id = ?", id)
			writeJSON(w, http.StatusNotFound, APIResponse{Error: "Note has expired"})
			return
		}
		note.ExpiresAt = &expiresAt.String
	}

	if !passwordHash.Valid {
		writeJSON(w, http.StatusBadRequest, APIResponse{Error: "Note is not password protected"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash.String), []byte(req.Password)); err != nil {
		writeJSON(w, http.StatusUnauthorized, APIResponse{Error: "Wrong password"})
		return
	}

	note.HasPass = true
	note.CreatedAt = createdAt
	note.UpdatedAt = updatedAt

	// Increment view count
	db.Exec("UPDATE notes SET view_count = view_count + 1 WHERE id = ?", id)
	note.ViewCount++

	writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: note})
}

// PUT /api/notes/{id}
func updateNote(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/notes/")

	var req CreateNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, APIResponse{Error: "Invalid request body"})
		return
	}

	// Check if note exists and verify admin token
	token := r.Header.Get("Admin-Token")
	var existingToken sql.NullString
	err := db.QueryRow("SELECT admin_token FROM notes WHERE id = ?", id).Scan(&existingToken)
	if err != nil {
		writeJSON(w, http.StatusNotFound, APIResponse{Error: "Note not found"})
		return
	}

	if !existingToken.Valid || existingToken.String != token {
		writeJSON(w, http.StatusUnauthorized, APIResponse{Error: "Unauthorized"})
		return
	}

	title := req.Title
	if title == "" {
		title = "Untitled"
	}

	_, err = db.Exec(
		"UPDATE notes SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?",
		title, req.Content, id,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, APIResponse{Error: "Failed to update note"})
		return
	}

	writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: map[string]string{"id": id}})
}

// DELETE /api/notes/{id}
func deleteNote(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/notes/")

	token := r.Header.Get("Admin-Token")
	var existingToken sql.NullString
	err := db.QueryRow("SELECT admin_token FROM notes WHERE id = ?", id).Scan(&existingToken)
	if err != nil {
		writeJSON(w, http.StatusNotFound, APIResponse{Error: "Note not found"})
		return
	}

	if !existingToken.Valid || existingToken.String != token {
		writeJSON(w, http.StatusUnauthorized, APIResponse{Error: "Unauthorized"})
		return
	}

	result, err := db.Exec("DELETE FROM notes WHERE id = ?", id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, APIResponse{Error: "Failed to delete note"})
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		writeJSON(w, http.StatusNotFound, APIResponse{Error: "Note not found"})
		return
	}

	writeJSON(w, http.StatusOK, APIResponse{Success: true})
}

func apiRouter(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	switch {
	case path == "/api/notes" && r.Method == "POST":
		createNote(w, r)
	case strings.HasPrefix(path, "/api/notes/") && r.Method == "GET":
		getNote(w, r)
	case strings.HasPrefix(path, "/api/notes/") && r.Method == "POST":
		// Handle unlock
		getNote(w, r)
	case strings.HasPrefix(path, "/api/notes/") && r.Method == "PUT":
		updateNote(w, r)
	case strings.HasPrefix(path, "/api/notes/") && r.Method == "DELETE":
		deleteNote(w, r)
	case path == "/api/health":
		writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: "ok"})
	default:
		writeJSON(w, http.StatusNotFound, APIResponse{Error: "Not found"})
	}
}

func main() {
	initDB()
	defer db.Close()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/", apiRouter)

	handler := corsMiddleware(mux)

	fmt.Printf("🗒️  TempNote server running on http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
