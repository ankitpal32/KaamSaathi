from typing import List, Optional, Any
from fastapi import APIRouter, Depends, Query, status
from app.database import get_authenticated_user_id, get_user_scoped_db
from app.schemas import ReminderCreate, ReminderResponse
from app.services.reminders import ReminderService

router = APIRouter(prefix="/api/reminders", tags=["Reminders"])

@router.post(
    "",
    response_model=ReminderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule a reminder",
    description="Creates a new customer follow-up reminder for the authenticated technician."
)
def create_reminder(
    payload: ReminderCreate,
    owner_id: str = Depends(get_authenticated_user_id),
    client: Any = Depends(get_user_scoped_db)
):
    return ReminderService.create_reminder(payload, owner_id, client)

@router.get(
    "",
    response_model=List[ReminderResponse],
    summary="List reminders",
    description="Returns all active reminders for the authenticated technician."
)
def list_reminders(
    include_completed: bool = Query(default=True, description="Whether to include completed reminders"),
    owner_id: str = Depends(get_authenticated_user_id),
    client: Any = Depends(get_user_scoped_db)
):
    return ReminderService.list_reminders(owner_id, client, include_completed=include_completed)

@router.patch(
    "/{reminder_id}/toggle",
    response_model=ReminderResponse,
    summary="Toggle reminder completion",
    description="Toggles the completion status of a reminder."
)
def toggle_reminder(
    reminder_id: str,
    is_completed: Optional[bool] = Query(default=None),
    owner_id: str = Depends(get_authenticated_user_id),
    client: Any = Depends(get_user_scoped_db)
):
    return ReminderService.toggle_reminder(reminder_id, owner_id, client, is_completed=is_completed)

@router.delete(
    "/{reminder_id}",
    summary="Delete a reminder",
    description="Cancels and removes a follow-up reminder."
)
def delete_reminder(
    reminder_id: str,
    owner_id: str = Depends(get_authenticated_user_id),
    client: Any = Depends(get_user_scoped_db)
):
    return ReminderService.delete_reminder(reminder_id, owner_id, client)
