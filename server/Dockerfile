## Multi-stage build for Go API
FROM golang:1.22 AS builder

WORKDIR /app

# Pre-cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build statically linked binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o server ./main.go

# Runtime image
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && \
    adduser -D -H -u 10001 appuser

WORKDIR /home/app
COPY --from=builder /app/server /home/app/server

ENV PORT=8080
EXPOSE 8080

USER appuser
ENTRYPOINT ["/home/app/server"]


