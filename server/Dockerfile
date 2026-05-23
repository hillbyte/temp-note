# server/Dockerfile
FROM golang:alpine AS builder

# Enable CGO for sqlite3
ENV CGO_ENABLED=1
RUN apk add --no-cache gcc musl-dev sqlite-dev

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o tempnote-server .

# Production stage
FROM alpine:3.19

RUN apk add --no-cache sqlite-libs tzdata

WORKDIR /app
COPY --from=builder /app/tempnote-server .

# Create data directory for persistent SQLite storage
RUN mkdir -p /app/data && chown -R 1000:1000 /app/data

EXPOSE 8080
ENV DB_PATH=/app/data/tempnote.db
ENV PORT=8080

CMD ["./tempnote-server"]
