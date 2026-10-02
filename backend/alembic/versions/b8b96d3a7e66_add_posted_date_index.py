"""add_posted_date_index

Revision ID: b8b96d3a7e66
Revises: perf_indexes_001
Create Date: 2026-10-02 19:45:40.413936

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8b96d3a7e66'
down_revision: Union[str, Sequence[str], None] = 'perf_indexes_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index(
        'ix_jobs_active_posted_date',
        'jobs',
        ['is_active', sa.text('posted_date DESC')],
        unique=False,
        if_not_exists=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_jobs_active_posted_date', table_name='jobs', if_exists=True)
