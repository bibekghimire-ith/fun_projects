"""Bulk-load starter content from a YAML file into the database.

Usage:
    python scripts/load_content.py [path/to/content.yaml]

Defaults to ./content.yaml (see content.example.yaml for the template and
field docs). Meant for the initial content import before you start
day-to-day editing via /admin.

Re-running this script is safe / idempotent:
  - site_settings: fields present in the YAML are merged into the existing
    singleton row (fields you omit are left untouched).
  - skills / projects / experience / education: each of these lists fully
    REPLACES whatever is currently in the database for that section. This
    keeps the import simple and predictable, but means any edits you've made
    in /admin to these sections will be overwritten the next time you run
    this script against the same content.yaml.
"""
import sys
from datetime import date
from pathlib import Path

import yaml
from slugify import slugify

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal, init_db  # noqa: E402
from app.models import (  # noqa: E402
    Education,
    Experience,
    Project,
    Skill,
    SkillCategory,
    SiteSettings,
)


def _parse_date(value):
    if value in (None, ""):
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def _unique_slug(db, title: str) -> str:
    base_slug = slugify(title)
    slug = base_slug
    counter = 2
    while db.query(Project).filter(Project.slug == slug).first() is not None:
        slug = f"{base_slug}-{counter}"
        counter += 1
    return slug


def load(path: Path) -> None:
    data = yaml.safe_load(path.read_text()) or {}

    init_db()
    db = SessionLocal()
    try:
        # --- site settings: merge field-by-field ---
        settings_data = data.get("site_settings") or {}
        site = db.get(SiteSettings, 1)
        if site is None:
            site = SiteSettings(id=1)
            db.add(site)
        for key, value in settings_data.items():
            if value is None:
                continue
            if hasattr(site, key):
                setattr(site, key, value)

        # --- skills: replace all ---
        db.query(Skill).delete()
        db.query(SkillCategory).delete()
        for cat_index, category in enumerate(data.get("skills") or []):
            cat = SkillCategory(
                name=category["category"],
                order_index=category.get("order_index", cat_index),
            )
            db.add(cat)
            db.flush()  # need cat.id for the skills below
            for skill_index, item in enumerate(category.get("items") or []):
                db.add(
                    Skill(
                        category_id=cat.id,
                        name=item["name"],
                        level=int(item.get("level", 80)),
                        order_index=item.get("order_index", skill_index),
                    )
                )

        # --- projects: replace all ---
        db.query(Project).delete()
        db.flush()
        for index, item in enumerate(data.get("projects") or []):
            db.add(
                Project(
                    title=item["title"],
                    slug=_unique_slug(db, item["title"]),
                    summary=item.get("summary", ""),
                    description=item.get("description", ""),
                    tech_stack=item.get("tech_stack", ""),
                    repo_url=item.get("repo_url", ""),
                    live_url=item.get("live_url", ""),
                    image_url=item.get("image_url", ""),
                    featured=bool(item.get("featured", False)),
                    order_index=item.get("order_index", index),
                )
            )
            db.flush()  # so the next _unique_slug() sees this one too

        # --- experience: replace all ---
        db.query(Experience).delete()
        for index, item in enumerate(data.get("experience") or []):
            db.add(
                Experience(
                    role=item["role"],
                    company=item["company"],
                    location=item.get("location", ""),
                    start_date=_parse_date(item["start_date"]),
                    end_date=_parse_date(item.get("end_date")),
                    description=item.get("description", ""),
                    order_index=item.get("order_index", index),
                )
            )

        # --- education: replace all ---
        db.query(Education).delete()
        for index, item in enumerate(data.get("education") or []):
            db.add(
                Education(
                    institution=item["institution"],
                    degree=item.get("degree", ""),
                    field=item.get("field", ""),
                    start_date=_parse_date(item.get("start_date")),
                    end_date=_parse_date(item.get("end_date")),
                    order_index=item.get("order_index", index),
                )
            )

        db.commit()
        print(f"Content loaded successfully from {path}.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    content_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("content.yaml")
    if not content_path.exists():
        print(f"Content file not found: {content_path}")
        print("Copy content.example.yaml to content.yaml, edit it, then re-run:")
        print(f"  cp content.example.yaml {content_path}")
        sys.exit(1)
    load(content_path)
