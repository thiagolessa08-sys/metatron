"""initial schema

Revision ID: 344268a5fd8f
Revises:
Create Date: 2026-05-17 12:25:37.295214

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '344268a5fd8f'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.Enum('gestor', 'consultor', 'admin', name='role'), nullable=False),
        sa.Column('agente_id_sybase', sa.String(length=100), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    op.create_table(
        'query_logs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=True),
        sa.Column('sql_hash', sa.String(length=64), nullable=False),
        sa.Column('sql_text', sa.Text(), nullable=False),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('row_count', sa.Integer(), nullable=True),
        sa.Column('truncated', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_query_logs_created_at'), 'query_logs', ['created_at'], unique=False)
    op.create_index(op.f('ix_query_logs_sql_hash'), 'query_logs', ['sql_hash'], unique=False)
    op.create_index(op.f('ix_query_logs_user_id'), 'query_logs', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_query_logs_user_id'), table_name='query_logs')
    op.drop_index(op.f('ix_query_logs_sql_hash'), table_name='query_logs')
    op.drop_index(op.f('ix_query_logs_created_at'), table_name='query_logs')
    op.drop_table('query_logs')

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
