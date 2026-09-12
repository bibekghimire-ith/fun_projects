"""Flask extension instances.

Extensions are instantiated here, outside of the application factory, and
attached to the app inside create_app(). This avoids circular imports and
keeps a single extension instance shared across the app package.
"""

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_login import LoginManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_wtf import CSRFProtect

db = SQLAlchemy()
migrate = Migrate()
csrf = CSRFProtect()
login_manager = LoginManager()

# Rate limiting. Storage backend is configured via RATELIMIT_STORAGE_URI
# (defaults to an in-process "memory://" store, which is appropriate for a
# single-instance self-hosted deployment; see docs/DECISIONS.md). Limits are
# applied per remote address.
limiter = Limiter(key_func=get_remote_address)
