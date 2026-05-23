package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"tempnote/internal/database"
	"tempnote/internal/models"
	"tempnote/internal/utils"

	"golang.org/x/crypto/bcrypt"
)

// POST /api/notes
func CreateNote(w http.ResponseWriter, r *http.Request) {
	var req models.CreateNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteJSON(w, http.StatusBadRequest, models.APIResponse{Error: "Invalid request body"})
		return
	}

	id := utils.GenerateID()

	var passwordHash *string
	if req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			utils.WriteJSON(w, http.StatusInternalServerError, models.APIResponse{Error: "Failed to hash password"})
			return
		}
		h := string(hash)
		passwordHash = &h
	}

	expiresAt := utils.CalculateExpiry(req.ExpireIn)

	var expiresAtStr *string
	if expiresAt != nil {
		s := expiresAt.Format("2006-01-02 15:04:05")
		expiresAtStr = &s
	}

	title := req.Title
	if title == "" {
		title = "Untitled"
	}

	adminToken := utils.GenerateID() + utils.GenerateID()

	_, err := database.DB.Exec(
		"INSERT INTO notes (id, title, content, password_hash, admin_token, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
		id, title, req.Content, passwordHash, adminToken, expiresAtStr,
	)
	if err != nil {
		utils.WriteJSON(w, http.StatusInternalServerError, models.APIResponse{Error: "Failed to create note"})
		return
	}

	note := models.Note{
		ID:      id,
		Title:   title,
		Content: req.Content,
		HasPass: passwordHash != nil,
	}
	if expiresAtStr != nil {
		note.ExpiresAt = expiresAtStr
	}

	utils.WriteJSON(w, http.StatusCreated, models.APIResponse{Success: true, Data: map[string]interface{}{
		"note":        note,
		"admin_token": adminToken,
	}})
}

// GET /api/notes/{id}
func GetNote(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/notes/")
	if strings.Contains(id, "/") {
		// Handle /api/notes/{id}/unlock
		parts := strings.SplitN(id, "/", 2)
		id = parts[0]
		if parts[1] == "unlock" {
			UnlockNote(w, r, id)
			return
		}
	}

	var note models.Note
	var passwordHash sql.NullString
	var expiresAt sql.NullString
	var createdAt, updatedAt string

	err := database.DB.QueryRow(
		"SELECT id, title, content, password_hash, expires_at, created_at, updated_at, view_count FROM notes WHERE id = ?",
		id,
	).Scan(&note.ID, &note.Title, &note.Content, &passwordHash, &expiresAt, &createdAt, &updatedAt, &note.ViewCount)

	if err == sql.ErrNoRows {
		utils.WriteJSON(w, http.StatusNotFound, models.APIResponse{Error: "Note not found or has expired"})
		return
	}
	if err != nil {
		utils.WriteJSON(w, http.StatusInternalServerError, models.APIResponse{Error: "Failed to fetch note"})
		return
	}

	// Check expiry
	if expiresAt.Valid {
		expTime, err := utils.ParseExpiry(expiresAt.String)
		if err == nil && time.Now().UTC().After(expTime) {
			database.DB.Exec("DELETE FROM notes WHERE id = ?", id)
			utils.WriteJSON(w, http.StatusNotFound, models.APIResponse{Error: "Note has expired"})
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
		utils.WriteJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: note})
		return
	}

	// Increment view count
	database.DB.Exec("UPDATE notes SET view_count = view_count + 1 WHERE id = ?", id)
	note.ViewCount++

	utils.WriteJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: note})
}

// POST /api/notes/{id}/unlock
func UnlockNote(w http.ResponseWriter, r *http.Request, id string) {
	var req models.UnlockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteJSON(w, http.StatusBadRequest, models.APIResponse{Error: "Invalid request body"})
		return
	}

	var note models.Note
	var passwordHash sql.NullString
	var expiresAt sql.NullString
	var createdAt, updatedAt string

	err := database.DB.QueryRow(
		"SELECT id, title, content, password_hash, expires_at, created_at, updated_at, view_count FROM notes WHERE id = ?",
		id,
	).Scan(&note.ID, &note.Title, &note.Content, &passwordHash, &expiresAt, &createdAt, &updatedAt, &note.ViewCount)

	if err == sql.ErrNoRows {
		utils.WriteJSON(w, http.StatusNotFound, models.APIResponse{Error: "Note not found"})
		return
	}
	if err != nil {
		utils.WriteJSON(w, http.StatusInternalServerError, models.APIResponse{Error: "Database error"})
		return
	}

	// Check expiry
	if expiresAt.Valid {
		expTime, err := utils.ParseExpiry(expiresAt.String)
		if err == nil && time.Now().UTC().After(expTime) {
			database.DB.Exec("DELETE FROM notes WHERE id = ?", id)
			utils.WriteJSON(w, http.StatusNotFound, models.APIResponse{Error: "Note has expired"})
			return
		}
		note.ExpiresAt = &expiresAt.String
	}

	if !passwordHash.Valid {
		utils.WriteJSON(w, http.StatusBadRequest, models.APIResponse{Error: "Note is not password protected"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash.String), []byte(req.Password)); err != nil {
		utils.WriteJSON(w, http.StatusUnauthorized, models.APIResponse{Error: "Wrong password"})
		return
	}

	note.HasPass = true
	note.CreatedAt = createdAt
	note.UpdatedAt = updatedAt

	// Increment view count
	database.DB.Exec("UPDATE notes SET view_count = view_count + 1 WHERE id = ?", id)
	note.ViewCount++

	utils.WriteJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: note})
}

// PUT /api/notes/{id}
func UpdateNote(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/notes/")

	var req models.CreateNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteJSON(w, http.StatusBadRequest, models.APIResponse{Error: "Invalid request body"})
		return
	}

	token := r.Header.Get("Admin-Token")
	var existingToken sql.NullString
	err := database.DB.QueryRow("SELECT admin_token FROM notes WHERE id = ?", id).Scan(&existingToken)
	if err != nil {
		utils.WriteJSON(w, http.StatusNotFound, models.APIResponse{Error: "Note not found"})
		return
	}

	if !existingToken.Valid || existingToken.String != token {
		utils.WriteJSON(w, http.StatusUnauthorized, models.APIResponse{Error: "Unauthorized"})
		return
	}

	title := req.Title
	if title == "" {
		title = "Untitled"
	}

	_, err = database.DB.Exec(
		"UPDATE notes SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?",
		title, req.Content, id,
	)
	if err != nil {
		utils.WriteJSON(w, http.StatusInternalServerError, models.APIResponse{Error: "Failed to update note"})
		return
	}

	utils.WriteJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: map[string]string{"id": id}})
}

// DELETE /api/notes/{id}
func DeleteNote(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/notes/")

	token := r.Header.Get("Admin-Token")
	var existingToken sql.NullString
	err := database.DB.QueryRow("SELECT admin_token FROM notes WHERE id = ?", id).Scan(&existingToken)
	if err != nil {
		utils.WriteJSON(w, http.StatusNotFound, models.APIResponse{Error: "Note not found"})
		return
	}

	if !existingToken.Valid || existingToken.String != token {
		utils.WriteJSON(w, http.StatusUnauthorized, models.APIResponse{Error: "Unauthorized"})
		return
	}

	result, err := database.DB.Exec("DELETE FROM notes WHERE id = ?", id)
	if err != nil {
		utils.WriteJSON(w, http.StatusInternalServerError, models.APIResponse{Error: "Failed to delete note"})
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		utils.WriteJSON(w, http.StatusNotFound, models.APIResponse{Error: "Note not found"})
		return
	}

	utils.WriteJSON(w, http.StatusOK, models.APIResponse{Success: true})
}
