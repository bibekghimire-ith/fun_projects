"""SQLAlchemy models.

Domain model modules are added in later phases (Phase 1: identity, Phase 2:
portfolio content, Phase 5: blog, Phase 7: contact). This package is imported
by the application factory so that Alembic autogenerate and
`db.create_all()` (test fixtures only) see the full metadata even before any
domain models exist.
"""

from app.models.achievement import Achievement  # noqa: F401
from app.models.blog import (  # noqa: F401
    BlogCategory,
    BlogPost,
    BlogPostStatus,
    BlogTag,
    blog_post_tags,
)
from app.models.certification import Certification  # noqa: F401
from app.models.contact_message import ContactMessage, ContactMessageStatus  # noqa: F401
from app.models.education import Education  # noqa: F401
from app.models.experience import Experience  # noqa: F401
from app.models.media_asset import MediaAsset  # noqa: F401
from app.models.navigation import NavigationItem  # noqa: F401
from app.models.portfolio_template import PortfolioTemplate  # noqa: F401
from app.models.profile import Profile, SocialLink  # noqa: F401
from app.models.project import Project, ProjectTechnology  # noqa: F401
from app.models.resume import Resume  # noqa: F401
from app.models.skill import Skill, SkillCategory  # noqa: F401
from app.models.user import User, UserRole  # noqa: F401
