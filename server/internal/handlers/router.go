package handlers

import (
	"net/http"
	"strings"

	"tempnote/internal/models"
	"tempnote/internal/utils"
)

func ApiRouter(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	switch {
	case path == "/api/notes" && r.Method == "POST":
		CreateNote(w, r)
	case strings.HasPrefix(path, "/api/notes/") && r.Method == "GET":
		GetNote(w, r)
	case strings.HasPrefix(path, "/api/notes/") && r.Method == "POST":
		// Handle unlock (GetNote forwards to UnlockNote)
		GetNote(w, r)
	case strings.HasPrefix(path, "/api/notes/") && r.Method == "PUT":
		UpdateNote(w, r)
	case strings.HasPrefix(path, "/api/notes/") && r.Method == "DELETE":
		DeleteNote(w, r)
	case path == "/api/health":
		utils.WriteJSON(w, http.StatusOK, models.APIResponse{Success: true, Data: "ok"})
	default:
		utils.WriteJSON(w, http.StatusNotFound, models.APIResponse{Error: "Not found"})
	}
}
