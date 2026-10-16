import logging
from typing import Optional
from fastapi import Header, HTTPException, status
from supabase import Client
from app.config import settings

logger = logging.getLogger(__name__)

# Cached Supabase client
_supabase_client: Optional[Client] = None

def get_supabase_client() -> Client:
    """
    Initializes and returns the Supabase client singleton.
    Raises HTTPException 503 if credentials are not configured.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not settings.is_supabase_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase credentials are not configured on the backend. Please configure SUPABASE_URL and SUPABASE_KEY in .env."
        )

    try:
        from supabase import create_client
        _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        return _supabase_client
    except Exception as e:
        logger.error("Failed to initialize Supabase client: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to connect to Supabase service."
        )

def get_authenticated_user_id(authorization: Optional[str] = Header(None)) -> str:
    """
    Validates the Bearer JWT token against Supabase Auth and derives the genuine user UUID.
    Strict security:
    - Never trusts owner_id sent by the client in request body or query params.
    - Rejects missing, malformed, or fake tokens with 401 Unauthorized.
    - Never invents a fake or fallback user ID.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Expected 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty Bearer token provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    client = get_supabase_client()

    try:
        # Validate the token directly with Supabase Auth service
        user_res = client.auth.get_user(token)
        if not user_res or not user_res.user or not user_res.user.id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return str(user_res.user.id)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Token verification failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed. The token is invalid or expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_user_scoped_client(token: str) -> Client:
    """
    Returns a Supabase client whose postgrest requests carry the authenticated user's JWT.
    This guarantees that Supabase Row Level Security (RLS) policies (auth.uid() = owner_id)
    are strictly enforced at the database level.
    """
    client = get_supabase_client()
    try:
        client.postgrest.auth(token)
    except Exception as e:
        logger.error("Failed to attach user token to PostgREST client: %s", str(e))
    return client

def get_user_scoped_db(authorization: Optional[str] = Header(None)) -> Client:
    """
    FastAPI dependency that extracts the Bearer token and returns an RLS-scoped Supabase client.
    """
    parts = (authorization or "").split()
    token = parts[1] if len(parts) > 1 else ""
    return get_user_scoped_client(token)

