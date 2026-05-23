# TempNote 

A beautiful, fast, and ephemeral Markdown notepad. Write notes instantly, save them locally in your browser, and publish them with a secure link to share with others.

## Features

- **Local First:** Drafts are instantly autosaved to your browser's local storage.
- **Ephemeral Sharing:** Publish notes with custom expiration times (1h, 24h, 7d, etc.). They auto-delete when they expire.
- **Password Protection:** Lock shared notes behind a password.
- **Full Control:** Creators can update or immediately unpublish their active notes.
- **Export & Download:** Instantly download your notes as `.md`, `.txt`, or `.pdf` files.
- **Markdown Support:** Built-in Markdown editor with slash commands (`/`), a formatting toolbar, and a live split-view preview.
- **QR Code Sharing:** Generate and download beautiful neo-brutalist QR cards for mobile sharing.
- **Productivity Built-in:** Word/character counts and keyboard shortcuts (`Ctrl+B` for sidebar, `Ctrl+P` for preview).

## Tech Stack

- **Frontend:** Astro, React, CodeMirror (Built with Vite)
- **Backend:** Go (Standard Library), SQLite
- **Infrastructure:** Docker & Docker Compose


## Getting Started with Docker Compose

For a quick local development setup, use the provided `docker-compose.yml`. This starts both the frontend and backend containers.

```bash
# Start the application
docker compose up -d --build

# Stop the application
docker compose down
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080


## Project Structure

- `/client` - Astro & React frontend application.
- `/server` - Modular Go backend API (`/cmd/api/main.go`).
- `/server/data` - Persistent SQLite volume (created by Docker).
