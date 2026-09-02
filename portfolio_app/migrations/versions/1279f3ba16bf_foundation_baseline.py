"""foundation baseline

Revision ID: 1279f3ba16bf
Revises: 
Create Date: 2026-09-02 04:41:01.206182

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1279f3ba16bf'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Intentionally empty: Phase 0 establishes the migration chain before any
    # domain models exist. Phase 1+ migrations build on this baseline.
    pass


def downgrade():
    pass
