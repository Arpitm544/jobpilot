"""Add performance indexes for user-scoped queries

Revision ID: perf_indexes_001
Revises: 4259d1296208
Create Date: 2026-10-02
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'perf_indexes_001'
down_revision = '4259d1296208'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add composite indexes for the most frequent query patterns:
    - job_matches: (user_id, status) — pipeline board, discovery listing
    - job_matches: (user_id, match_score DESC) — ranked listing
    - applications: (user_id, status) — pipeline board
    - applications: (user_id, created_at DESC) — velocity / audit log
    - application_events: (application_id) — already indexed but ensure
    - tailored_resumes: (job_match_id) — already unique-indexed
    - master_profiles: (user_id, is_primary) — primary profile fetch
    - job_preferences: (user_id) — single-row lookup
    - question_banks: (user_id) — single-row lookup
    - jobs: (employment_type, work_mode, is_active) — discovery filtering
    """

    # Composite index: job_matches by user + status (pipeline board)
    op.create_index(
        'ix_job_matches_user_status',
        'job_matches',
        ['user_id', 'status'],
        unique=False,
        if_not_exists=True,
    )

    # Composite index: job_matches by user + score DESC (ranked discovery)
    op.create_index(
        'ix_job_matches_user_score',
        'job_matches',
        ['user_id', sa.text('match_score DESC')],
        unique=False,
        if_not_exists=True,
        postgresql_using='btree',
    )

    # Composite index: applications by user + status
    op.create_index(
        'ix_applications_user_status',
        'applications',
        ['user_id', 'status'],
        unique=False,
        if_not_exists=True,
    )

    # Composite index: applications by user + created_at DESC (velocity)
    op.create_index(
        'ix_applications_user_created',
        'applications',
        ['user_id', 'created_at'],
        unique=False,
        if_not_exists=True,
    )

    # Composite index: master_profiles by user + is_primary (most common lookup)
    op.create_index(
        'ix_master_profiles_user_primary',
        'master_profiles',
        ['user_id', 'is_primary'],
        unique=False,
        if_not_exists=True,
    )

    # jobs: filtering by active + employment_type + work_mode
    op.create_index(
        'ix_jobs_active_type_mode',
        'jobs',
        ['is_active', 'employment_type', 'work_mode'],
        unique=False,
        if_not_exists=True,
    )

    # applications_events: improve join queries with application_id
    # (already has index in model but SQLite may not have created it on older DBs)
    op.create_index(
        'ix_app_events_application_id',
        'application_events',
        ['application_id'],
        unique=False,
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index('ix_job_matches_user_status', table_name='job_matches', if_exists=True)
    op.drop_index('ix_job_matches_user_score', table_name='job_matches', if_exists=True)
    op.drop_index('ix_applications_user_status', table_name='applications', if_exists=True)
    op.drop_index('ix_applications_user_created', table_name='applications', if_exists=True)
    op.drop_index('ix_master_profiles_user_primary', table_name='master_profiles', if_exists=True)
    op.drop_index('ix_jobs_active_type_mode', table_name='jobs', if_exists=True)
    op.drop_index('ix_app_events_application_id', table_name='application_events', if_exists=True)
