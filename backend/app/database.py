"""
Database module for KaamSaathi FastAPI Backend.
Maintains client singleton and auth dependencies.
"""
from app.dependencies.auth import (
    get_supabase_client,
    get_authenticated_user_id,
    get_user_scoped_client,
    get_user_scoped_db,
    _supabase_client,
)

__all__ = [
    "get_supabase_client",
    "get_authenticated_user_id",
    "get_user_scoped_client",
    "get_user_scoped_db",
    "_supabase_client",
]
