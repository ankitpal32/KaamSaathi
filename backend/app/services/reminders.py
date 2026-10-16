import logging
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from supabase import Client
from app.schemas import ReminderCreate

logger = logging.getLogger(__name__)

class ReminderService:
    @staticmethod
    def create_reminder(payload: ReminderCreate, owner_id: str, client: Client) -> Dict[str, Any]:
        """
        Creates a new customer follow-up reminder under the authenticated technician.
        """
        data = {
            "owner_id": owner_id,
            "job_id": payload.job_id,
            "task": payload.task,
            "due_date": payload.due_date,
            "trade": payload.trade.value,
            "priority": payload.priority.value,
            "is_completed": False,
        }

        try:
            res = client.table("reminders").insert(data).execute()
            if not res.data or len(res.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Database failed to schedule reminder."
                )
            return res.data[0]
        except Exception as e:
            logger.error("Failed to insert reminder into Supabase: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while scheduling reminder: {str(e)}"
            )

    @staticmethod
    def list_reminders(owner_id: str, client: Client, include_completed: bool = True) -> List[Dict[str, Any]]:
        """
        Lists reminders belonging to the authenticated technician, optionally filtering completed items.
        """
        try:
            query = client.table("reminders").select("*").eq("owner_id", owner_id)
            if not include_completed:
                query = query.eq("is_completed", False)
            res = query.order("due_date", desc=False).execute()
            return res.data or []
        except Exception as e:
            logger.error("Failed to fetch reminders from Supabase: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while retrieving reminders: {str(e)}"
            )

    @staticmethod
    def toggle_reminder(reminder_id: str, owner_id: str, client: Client, is_completed: Optional[bool] = None) -> Dict[str, Any]:
        """
        Toggles or explicitly sets completion status of an authorized reminder.
        """
        try:
            curr_res = client.table("reminders").select("*").eq("id", reminder_id).eq("owner_id", owner_id).execute()
            if not curr_res.data or len(curr_res.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Reminder '{reminder_id}' not found or unauthorized."
                )
            current = curr_res.data[0]
            new_status = not current.get("is_completed", False) if is_completed is None else is_completed

            res = client.table("reminders").update({"is_completed": new_status}).eq("id", reminder_id).eq("owner_id", owner_id).execute()
            if not res.data or len(res.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Database failed to update reminder completion status."
                )
            return res.data[0]
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Failed to toggle reminder: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while updating reminder: {str(e)}"
            )

    @staticmethod
    def delete_reminder(reminder_id: str, owner_id: str, client: Client) -> Dict[str, Any]:
        """
        Cancels and deletes an authorized reminder.
        """
        try:
            curr_res = client.table("reminders").select("*").eq("id", reminder_id).eq("owner_id", owner_id).execute()
            if not curr_res.data or len(curr_res.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Reminder '{reminder_id}' not found or unauthorized."
                )
            client.table("reminders").delete().eq("id", reminder_id).eq("owner_id", owner_id).execute()
            return {"success": True, "message": f"Reminder {reminder_id} deleted."}
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Failed to delete reminder: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while deleting reminder: {str(e)}"
            )
