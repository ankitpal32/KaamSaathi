"""
Vercel and ASGI root entrypoint for KaamSaathi FastAPI Backend.
Exposes the FastAPI instance 'app' defined in app.main.
"""
from app.main import app

__all__ = ["app"]
