"""SQLAlchemy engine/session setup."""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Columns added to existing tables after their first release. create_all()
# only creates missing *tables*, never adds columns to a table that already
# exists — so a column added here needs a manual backfill for anyone who
# already has a running database. Kept as a plain list of
# (table, column, ddl_type, default_sql_literal) tuples rather than pulling
# in Alembic, since the schema is still small. Revisit with real migrations
# if this list keeps growing.
_COLUMN_MIGRATIONS = [
    ("site_settings", "background_color", "VARCHAR(20)", "'#F7F0E6'"),
    ("site_settings", "text_color", "VARCHAR(20)", "'#1D2B1F'"),
]


def _run_column_migrations() -> None:
    inspector = inspect(engine)
    if "site_settings" not in inspector.get_table_names():
        return  # brand-new database — create_all() already applied the full model

    existing_columns = {col["name"] for col in inspector.get_columns("site_settings")}

    is_first_run_of_this_migration = "background_color" not in existing_columns

    with engine.begin() as conn:
        for table, column, ddl_type, default_sql in _COLUMN_MIGRATIONS:
            if column in existing_columns:
                continue
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))
            conn.execute(text(f"UPDATE {table} SET {column} = {default_sql} WHERE {column} IS NULL"))

        if is_first_run_of_this_migration:
            # Re-theme any pre-existing row that still has the old accent
            # default (i.e. hasn't been customized) to match the new
            # default palette introduced alongside background/text color.
            conn.execute(
                text(
                    "UPDATE site_settings SET accent_color = '#BFEA4B' "
                    "WHERE accent_color = '#00ff66'"
                )
            )


def init_db() -> None:
    """Create tables if they do not exist yet, and backfill any columns
    added to an existing table since it was first created.

    For a project this size, ``create_all`` + the small migration list above
    is enough. If the schema grows a lot (e.g. once the blogging feature
    lands), switch to Alembic migrations instead of relying on this.
    """
    import app.models  # noqa: F401  (ensure models are registered on Base)

    Base.metadata.create_all(bind=engine)
    _run_column_migrations()
