"""Server-side authorization decorators.

Per docs/SECURITY.md: "Every admin route requires authenticated admin
role" and hidden fields/client-side state must never be trusted for
authorization - these decorators enforce that check on the server for
every request, based only on the server-side session/user record.
"""

from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any, TypeVar

from flask import abort
from flask_login import current_user, login_required

F = TypeVar("F", bound=Callable[..., Any])


def admin_required(view: F) -> F:
    """Require an authenticated user with the admin role.

    Composes with `login_required` (unauthenticated requests are redirected
    to the login page / rejected exactly as `login_required` would); an
    authenticated but non-admin user gets a 403.
    """

    @wraps(view)
    def wrapped(*args: Any, **kwargs: Any) -> Any:
        if not current_user.is_admin:
            abort(403)
        return view(*args, **kwargs)

    return login_required(wrapped)
