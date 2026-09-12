"""One-time bootstrap: admin user + default site settings row."""
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AdminUser, SiteSettings
from app.security import hash_password

settings = get_settings()


def seed(db: Session) -> None:
    if db.query(AdminUser).count() == 0:
        db.add(
            AdminUser(
                username=settings.admin_username,
                password_hash=hash_password(settings.admin_password),
            )
        )

    if db.get(SiteSettings, 1) is None:
        db.add(
            SiteSettings(
                id=1,
                site_title=settings.site_name,
                tagline="Software / Hardware Engineer",
                bio="Write a short bio about yourself from the admin panel.",
            )
        )

    db.commit()
