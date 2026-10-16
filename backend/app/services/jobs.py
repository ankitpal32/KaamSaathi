import logging
from decimal import Decimal
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from supabase import Client
from app.schemas import JobCreate, JobStatus, PaymentCreate

logger = logging.getLogger(__name__)

class JobService:
    @staticmethod
    def create_job(payload: JobCreate, owner_id: str, client: Client) -> Dict[str, Any]:
        """
        Validates business logic and persists a confirmed job under the authenticated owner_id.
        """
        if not payload.confirmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A job must not be saved before the user has confirmed its details."
            )

        calculated_status = payload.status
        if not calculated_status:
            if payload.amount_paid >= payload.agreed_amount and payload.agreed_amount > 0:
                calculated_status = JobStatus.completed
            elif payload.amount_paid > 0:
                calculated_status = JobStatus.partially_paid
            else:
                calculated_status = JobStatus.pending

        job_data = {
            "owner_id": owner_id,
            "customer_name": payload.customer_name,
            "customer_phone": payload.customer_phone or "",
            "trade": payload.trade.value,
            "description": payload.description,
            "agreed_amount": float(payload.agreed_amount),
            "amount_paid": float(payload.amount_paid),
            "status": calculated_status.value if hasattr(calculated_status, "value") else str(calculated_status),
            "notes": payload.notes or "",
        }

        try:
            res = client.table("jobs").insert(job_data).execute()
            if not res.data or len(res.data) == 0:
                logger.error("Supabase insert succeeded without returning data")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Database failed to record the job."
                )
            created_job = res.data[0]
            if "remaining_balance" not in created_job or created_job["remaining_balance"] is None:
                created_job["remaining_balance"] = float(payload.agreed_amount - payload.amount_paid)
            return created_job
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Failed to insert job into Supabase: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while creating job: {str(e)}"
            )

    @staticmethod
    def list_jobs(owner_id: str, client: Client, q: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Lists all jobs belonging strictly to the authenticated owner, with optional search query and status filter.
        """
        try:
            res = client.table("jobs").select("*").eq("owner_id", owner_id).order("created_at", desc=True).execute()
            jobs = res.data or []
            filtered_jobs = []
            for j in jobs:
                if "remaining_balance" not in j or j["remaining_balance"] is None:
                    agreed = Decimal(str(j.get("agreed_amount", 0)))
                    paid = Decimal(str(j.get("amount_paid", 0)))
                    j["remaining_balance"] = float(max(Decimal(0), agreed - paid))
                
                # Apply status filter if supplied
                if status and status != "all" and j.get("status") != status:
                    continue
                
                # Apply search filter if supplied
                if q:
                    query = q.lower().strip()
                    c_name = str(j.get("customer_name", "")).lower()
                    c_phone = str(j.get("customer_phone", "")).lower()
                    desc = str(j.get("description", "")).lower()
                    notes = str(j.get("notes", "")).lower()
                    if query not in c_name and query not in c_phone and query not in desc and query not in notes:
                        continue

                filtered_jobs.append(j)
            return filtered_jobs
        except Exception as e:
            logger.error("Failed to fetch jobs from Supabase: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while retrieving jobs: {str(e)}"
            )

    @staticmethod
    def get_job_by_id(job_id: str, owner_id: str, client: Client) -> Dict[str, Any]:
        """
        Retrieves a single authorized job by ID for the authenticated owner.
        """
        try:
            res = client.table("jobs").select("*").eq("id", job_id).eq("owner_id", owner_id).execute()
            if not res.data or len(res.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Job with ID '{job_id}' not found or you are not authorized to view it."
                )
            job = res.data[0]
            if "remaining_balance" not in job or job["remaining_balance"] is None:
                agreed = Decimal(str(job.get("agreed_amount", 0)))
                paid = Decimal(str(job.get("amount_paid", 0)))
                job["remaining_balance"] = float(max(Decimal(0), agreed - paid))
            return job
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Failed to get job from Supabase: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while retrieving job: {str(e)}"
            )

    @staticmethod
    def record_payment(job_id: str, payload: PaymentCreate, owner_id: str, client: Client) -> Dict[str, Any]:
        """
        Records a validated payment event against an authorized job.
        Enforces:
        - Technician confirmation
        - Ownership verification
        - Payment amount <= remaining unpaid balance
        - Deterministic update of job amount_paid and status
        """
        if not payload.confirmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment must be confirmed by the technician before recording."
            )

        # 1. Verify job exists and belongs to owner
        job = JobService.get_job_by_id(job_id, owner_id, client)
        agreed = Decimal(str(job["agreed_amount"]))
        current_paid = Decimal(str(job["amount_paid"]))
        remaining = max(Decimal("0.00"), agreed - current_paid)

        if payload.amount > remaining:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment amount (₹{payload.amount}) exceeds remaining balance (₹{remaining})."
            )

        payment_data = {
            "owner_id": owner_id,
            "job_id": job_id,
            "amount": float(payload.amount),
            "payment_mode": payload.payment_mode.value,
            "notes": payload.notes or "",
        }

        try:
            res = client.table("payment_events").insert(payment_data).execute()
            if not res.data or len(res.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Database failed to record payment."
                )
            created_payment = dict(res.data[0])

            # 2. Update job balance and status deterministically
            new_paid = current_paid + payload.amount
            new_remaining = max(Decimal("0.00"), agreed - new_paid)
            new_status = "completed" if new_remaining == 0 else "partially_paid"
            
            client.table("jobs").update({
                "amount_paid": float(new_paid),
                "status": new_status,
            }).eq("id", job_id).eq("owner_id", owner_id).execute()

            # Return updated balance and status alongside payment record
            if "recorded_at" not in created_payment or not created_payment["recorded_at"]:
                created_payment["recorded_at"] = created_payment.get("created_at") or "2026-10-16T10:00:00Z"
            created_payment["remaining_balance"] = float(new_remaining)
            created_payment["job_status"] = new_status

            return created_payment
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Failed to record payment in Supabase: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while recording payment: {str(e)}"
            )

    @staticmethod
    def update_job(job_id: str, payload: Any, owner_id: str, client: Client) -> Dict[str, Any]:
        """
        Updates an existing job. Requires explicit user confirmation if financial or status attributes are modified.
        """
        current_job = JobService.get_job_by_id(job_id, owner_id, client)
        
        # Determine if financial attributes changed
        new_agreed = payload.agreed_amount if payload.agreed_amount is not None else Decimal(str(current_job["agreed_amount"]))
        new_paid = payload.amount_paid if payload.amount_paid is not None else Decimal(str(current_job["amount_paid"]))

        financial_changed = (new_agreed != Decimal(str(current_job["agreed_amount"]))) or (new_paid != Decimal(str(current_job["amount_paid"])))
        
        if financial_changed and not payload.confirmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Confirmation required: Financial modifications (agreed amount or paid amount) require explicit technician confirmation."
            )

        if new_paid > new_agreed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Amount paid (₹{new_paid}) cannot exceed agreed amount (₹{new_agreed})."
            )

        new_remaining = max(Decimal("0.00"), new_agreed - new_paid)
        
        # Calculate status
        if payload.status:
            calculated_status = payload.status.value if hasattr(payload.status, "value") else str(payload.status)
        else:
            if new_remaining == 0 and new_agreed > 0:
                calculated_status = "completed"
            elif new_paid > 0:
                calculated_status = "partially_paid"
            else:
                calculated_status = "pending"

        update_dict: Dict[str, Any] = {
            "agreed_amount": float(new_agreed),
            "amount_paid": float(new_paid),
            "status": calculated_status,
        }

        if payload.customer_name is not None:
            update_dict["customer_name"] = payload.customer_name.strip()
        if payload.customer_phone is not None:
            update_dict["customer_phone"] = payload.customer_phone.strip()
        if payload.trade is not None:
            update_dict["trade"] = payload.trade.value if hasattr(payload.trade, "value") else str(payload.trade)
        if payload.description is not None:
            update_dict["description"] = payload.description.strip()
        if payload.notes is not None:
            update_dict["notes"] = payload.notes.strip()

        try:
            res = client.table("jobs").update(update_dict).eq("id", job_id).eq("owner_id", owner_id).execute()
            if not res.data or len(res.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Database failed to update job."
                )
            updated = dict(res.data[0])
            updated["remaining_balance"] = float(new_remaining)
            return updated
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Failed to update job in Supabase: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while updating job: {str(e)}"
            )

    @staticmethod
    def delete_job(job_id: str, owner_id: str, client: Client) -> Dict[str, Any]:
        """
        Deletes a job belonging to the authenticated technician.
        """
        JobService.get_job_by_id(job_id, owner_id, client)
        try:
            client.table("jobs").delete().eq("id", job_id).eq("owner_id", owner_id).execute()
            return {"success": True, "message": f"Job {job_id} deleted successfully."}
        except Exception as e:
            logger.error("Failed to delete job: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while deleting job: {str(e)}"
            )

    @staticmethod
    def list_payments_for_job(job_id: str, owner_id: str, client: Client) -> List[Dict[str, Any]]:
        """
        Lists all payment events recorded for an authorized job.
        """
        JobService.get_job_by_id(job_id, owner_id, client)
        try:
            res = client.table("payment_events").select("*").eq("job_id", job_id).eq("owner_id", owner_id).order("recorded_at", desc=True).execute()
            return res.data or []
        except Exception as e:
            logger.error("Failed to fetch payments from Supabase: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while retrieving payments: {str(e)}"
            )

    @staticmethod
    def list_all_payments(owner_id: str, client: Client) -> List[Dict[str, Any]]:
        """
        Lists all payment events belonging to the authenticated owner.
        """
        try:
            res = client.table("payment_events").select("*").eq("owner_id", owner_id).order("recorded_at", desc=True).execute()
            return res.data or []
        except Exception as e:
            logger.error("Failed to fetch all payments: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while retrieving payments: {str(e)}"
            )

    @staticmethod
    def correct_payment(payment_id: str, payload: Any, owner_id: str, client: Client) -> Dict[str, Any]:
        """
        Explicitly corrects a recorded payment event.
        Calculates balance = agreed amount - sum of valid payments deterministically.
        """
        if not payload.confirmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment corrections require explicit technician confirmation."
            )

        try:
            # 1. Fetch target payment
            pay_res = client.table("payment_events").select("*").eq("id", payment_id).eq("owner_id", owner_id).execute()
            if not pay_res.data or len(pay_res.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Payment event '{payment_id}' not found or unauthorized."
                )
            target_payment = pay_res.data[0]
            job_id = target_payment["job_id"]

            # 2. Fetch associated job
            job = JobService.get_job_by_id(job_id, owner_id, client)
            agreed = Decimal(str(job["agreed_amount"]))

            # 3. Sum other payments for this job
            all_payments_res = client.table("payment_events").select("*").eq("job_id", job_id).eq("owner_id", owner_id).execute()
            other_payments_sum = sum(
                Decimal(str(p["amount"])) 
                for p in (all_payments_res.data or []) 
                if p["id"] != payment_id
            )

            new_total_paid = other_payments_sum + payload.new_amount
            if new_total_paid > agreed:
                max_allowed = max(Decimal("0.00"), agreed - other_payments_sum)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Corrected amount (₹{payload.new_amount}) makes total payments (₹{new_total_paid}) exceed agreed amount (₹{agreed}). Maximum allowed: ₹{max_allowed}."
                )

            # 4. Update payment record with audit notation
            existing_notes = target_payment.get("notes") or ""
            audit_note = f"{existing_notes} [Correction: {payload.reason}]".strip()
            up_res = client.table("payment_events").update({
                "amount": float(payload.new_amount),
                "notes": audit_note,
            }).eq("id", payment_id).eq("owner_id", owner_id).execute()

            if not up_res.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update payment record."
                )
            corrected_payment = dict(up_res.data[0])

            # 5. Reconcile job deterministically
            new_remaining = max(Decimal("0.00"), agreed - new_total_paid)
            new_status = "completed" if new_remaining == 0 else ("partially_paid" if new_total_paid > 0 else "pending")
            client.table("jobs").update({
                "amount_paid": float(new_total_paid),
                "status": new_status,
            }).eq("id", job_id).eq("owner_id", owner_id).execute()

            corrected_payment["remaining_balance"] = float(new_remaining)
            corrected_payment["job_status"] = new_status
            return corrected_payment
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Failed to correct payment: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error during payment correction: {str(e)}"
            )

    @staticmethod
    def get_dashboard_stats(owner_id: str, client: Client) -> Dict[str, Any]:
        """
        Calculates deterministically verifiable dashboard metrics strictly from persisted records.
        """
        from datetime import datetime, timedelta

        jobs = JobService.list_jobs(owner_id, client)
        payments = JobService.list_all_payments(owner_id, client)
        
        # Fetch reminders
        try:
            rem_res = client.table("reminders").select("*").eq("owner_id", owner_id).execute()
            reminders = rem_res.data or []
        except Exception:
            reminders = []

        total_jobs = len(jobs)
        total_agreed = sum((Decimal(str(j.get("agreed_amount", 0))) for j in jobs), Decimal("0.00"))
        total_collected = sum((Decimal(str(j.get("amount_paid", 0))) for j in jobs), Decimal("0.00"))
        total_outstanding = max(Decimal("0.00"), total_agreed - total_collected)

        pending_jobs_count = len([j for j in jobs if Decimal(str(j.get("remaining_balance", 0))) > 0])
        completed_jobs_count = len([j for j in jobs if j.get("status") == "completed"])
        upcoming_reminders_count = len([r for r in reminders if not r.get("is_completed", False)])

        # Weekly earnings (last 7 days)
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        weekly_earnings = []
        today = datetime.utcnow().date()
        
        for i in range(6, -1, -1):
            target_date = today - timedelta(days=i)
            target_date_str = target_date.isoformat()
            day_name = day_names[target_date.weekday()]

            day_payments = [
                Decimal(str(p.get("amount", 0))) 
                for p in payments 
                if str(p.get("recorded_at", "")).startswith(target_date_str)
            ]
            day_jobs = [
                j for j in jobs 
                if str(j.get("created_at", "")).startswith(target_date_str)
            ]

            weekly_earnings.append({
                "date": target_date_str,
                "day": day_name,
                "amount": float(sum(day_payments, Decimal("0.00"))),
                "jobs_count": len(day_jobs)
            })

        return {
            "total_jobs": total_jobs,
            "total_agreed": float(total_agreed),
            "total_collected": float(total_collected),
            "total_outstanding": float(total_outstanding),
            "pending_jobs_count": pending_jobs_count,
            "completed_jobs_count": completed_jobs_count,
            "upcoming_reminders_count": upcoming_reminders_count,
            "weekly_earnings": weekly_earnings
        }
