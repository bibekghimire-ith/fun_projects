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
