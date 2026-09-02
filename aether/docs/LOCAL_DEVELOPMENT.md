# Local Development

Prerequisites: Docker, Docker Compose and Git. Python/Node are optional when using containers.

```bash
cp .env.example .env
docker compose up --build
```

Keep development containerized for consistent Linux/macOS/Windows behavior.
Do not run `docker compose down -v` unless intentionally deleting persistent data.
