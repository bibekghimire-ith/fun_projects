"""FastAPI application entrypoint."""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.config import get_settings
from app.database import SessionLocal, init_db
from app.routers import admin, blog, public
from app.seed import seed

settings = get_settings()

app = FastAPI(title=settings.site_name)

# NOTE: https_only=True (set whenever ENVIRONMENT=production) means the
# browser will only ever send the admin session cookie back over HTTPS.
# If you serve the app over plain HTTP with ENVIRONMENT=production, admin
# login will appear to silently fail (the cookie never comes back). Only
# set ENVIRONMENT=production once the app is behind HTTPS.
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    same_site="lax",
    https_only=settings.is_production,
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")

app.include_router(public.router)
app.include_router(admin.router)
app.include_router(blog.router)


@app.middleware("http")
async def security_headers(request, call_next):
    """Baseline security headers on every response (BLOG_PLAN.md section 7).
    Kept minimal and dependency-free: no inline-script CSP is imposed here
    since it isn't needed by any current template (no inline <script> tags),
    but the framing/sniffing protections apply everywhere."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers.setdefault("Content-Security-Policy", "frame-ancestors 'none'")
    return response


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
