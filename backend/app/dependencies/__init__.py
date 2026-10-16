"""
Dependencies package for KaamSaathi API
"""
from app.dependencies.auth import (
    get_authenticated_user_id,
    get_supabase_client,
    get_user_scoped_client,
)

__all__ = [
    "get_authenticated_user_id",
    "get_supabase_client",
    "get_user_scoped_client",
]
