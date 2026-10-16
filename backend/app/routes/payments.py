from typing import List, Any
from fastapi import APIRouter, Depends, status
from app.database import get_authenticated_user_id, get_user_scoped_db
from app.schemas import PaymentResponse, PaymentCorrectionCreate
from app.services.jobs import JobService

router = APIRouter(prefix="/api/payments", tags=["Payments"])

@router.get(
    "",
    response_model=List[PaymentResponse],
    summary="List all payments",
    description="Returns all recorded payment events belonging to the authenticated technician across all jobs."
)
def list_all_payments(
    owner_id: str = Depends(get_authenticated_user_id),
    client: Any = Depends(get_user_scoped_db)
):
    return JobService.list_all_payments(owner_id, client)

@router.post(
    "/{payment_id}/correct",
    response_model=PaymentResponse,
    summary="Correct a payment entry",
    description="Applies a confirmed correction to an existing payment and recalculates the job balance deterministically."
)
def correct_payment(
    payment_id: str,
    payload: PaymentCorrectionCreate,
    owner_id: str = Depends(get_authenticated_user_id),
    client: Any = Depends(get_user_scoped_db)
):
    return JobService.correct_payment(payment_id, payload, owner_id, client)
