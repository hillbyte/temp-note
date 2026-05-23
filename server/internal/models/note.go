package models

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
