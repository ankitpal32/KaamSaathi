from typing import Any
from fastapi import APIRouter, Depends, status
from app.database import get_authenticated_user_id, get_user_scoped_db
from app.schemas import DashboardStatsResponse
from app.services.jobs import JobService

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get(
    "/stats",
    response_model=DashboardStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get verified dashboard statistics",
    description="Returns deterministic calculations of jobs, collections, outstanding udhaar balance, and upcoming reminders."
)
def get_dashboard_stats(
    owner_id: str = Depends(get_authenticated_user_id),
    client: Any = Depends(get_user_scoped_db)
):
    return JobService.get_dashboard_stats(owner_id, client)
