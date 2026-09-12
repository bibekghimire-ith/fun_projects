"""Password hashing helpers for the single-admin auth model.

bcrypt only looks at the first 72 bytes of a password and errors on
anything longer (depending on backend version), so passwords are
truncated to 72 bytes here before hashing/verifying — consistent and
predictable either way, and 72 bytes is already far beyond a reasonable
password length.
"""
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_MAX_PASSWORD_BYTES = 72


def _truncate(password: str) -> str:
    return password.encode("utf-8")[:_MAX_PASSWORD_BYTES].decode("utf-8", errors="ignore")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(_truncate(plain_password))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(_truncate(plain_password), hashed_password)


# ---------------------------------------------------------------------------
# CSRF protection for admin forms
#
# Every admin POST route relies on the session cookie for auth, which alone
# is not enough: SameSite=Lax (see main.py) blocks a cross-site *form*
# auto-submit for most browsers/methods, but a session-token-per-form is
# the properly robust defense and is what actually stops CSRF regardless of
# SameSite cookie behavior/browser quirks. The token is generated once per
# session and stored server-side in the session itself (not client-visible
# except as the hidden form field it's copied into), then compared with a
# constant-time check on every state-changing POST.
# ---------------------------------------------------------------------------
import secrets

from fastapi import Form, HTTPException, Request, status

_CSRF_SESSION_KEY = "csrf_token"


def get_or_create_csrf_token(request: Request) -> str:
    """Return this session's CSRF token, creating one on first use.
    Call this from every admin GET handler that renders a form, and embed
    the result as a hidden `csrf_token` field in that form."""
    token = request.session.get(_CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_urlsafe(32)
        request.session[_CSRF_SESSION_KEY] = token
    return token


def verify_csrf_token(request: Request, submitted_token: str) -> bool:
    expected = request.session.get(_CSRF_SESSION_KEY)
    return bool(expected) and secrets.compare_digest(expected, submitted_token)


def require_csrf(request: Request, csrf_token: str = Form(...)) -> None:
    """FastAPI dependency: add `Depends(require_csrf)` to any state-changing
    POST route. Raises 400 if the submitted token is missing or doesn't
    match this session's token (expired session, forged/replayed form,
    cross-site submission, etc.)."""
    if not verify_csrf_token(request, csrf_token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your session expired or this form was submitted from an untrusted origin. Go back and try again.",
        )
