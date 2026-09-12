"""Shared FastAPI dependencies."""
from collections.abc import Generator

from fastapi import Depends, HTTPException, Request, status

from app.database import SessionLocal
from app.models import SiteSettings


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_site_settings(db=Depends(get_db)) -> SiteSettings:
    site = db.get(SiteSettings, 1)
    if site is None:
        # Should not happen once seed() has run, but avoid a hard crash.
        site = SiteSettings(id=1)
    return site


def require_admin(request: Request) -> str:
    username = request.session.get("admin_username")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_303_SEE_OTHER,
            headers={"Location": "/admin/login"},
        )
    return username
