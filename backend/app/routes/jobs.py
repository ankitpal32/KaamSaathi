from typing import List, Optional, Any
from fastapi import APIRouter, Depends, Query, status
from app.database import get_authenticated_user_id, get_user_scoped_db
from app.schemas import JobCreate, JobUpdate, JobResponse, PaymentCreate, PaymentResponse
from app.services.jobs import JobService

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])

@router.post(
    "",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a confirmed job",
    description="Validates and persists a newly confirmed job for the authenticated user."
)
def create_job(
    payload: JobCreate,
    owner_id: str = Depends(get_authenticated_user_id),
    client: Any = Depends(get_user_scoped_db)
):
    return JobService.create_job(payload, owner_id, client)

@router.get(
    "",
    response_model=List[JobResponse],
    summary="List authorized jobs",
    description="Returns all jobs belonging strictly to the authenticated user, with optional search and status filter."
)
def list_jobs(
    q: Optional[str] = Query(default=None, description="Search term for customer name, phone, or description"),
    status: Optional[str] = Query(default=None, description="Filter by status (pending, in_progress, partially_paid, completed)"),
    owner_id: str = Depends(get_authenticated_user_id),
    client: Any = Depends(get_user_scoped_db)
):
    return JobService.list_jobs(owner_id, client, q=q, status=status)

@router.get(
    "/{job_id}",
    response_model=JobResponse,
    summary="Get single authorized job",
    description="Retrieves a single job by ID if owned by the authenticated user."
)
def get_job(
    job_id: str,
    owner_id: str = Depends(get_authenticated_user_id),
    client: Any = Depends(get_user_scoped_db)
):
    return JobService.get_job_by_id(job_id, owner_id, client)

@router.put(
    "/{job_id}",
    response_model=JobResponse,
    summary="Update an existing job",
    description="Updates job details. Requires confirmed=true if financial amounts or status are updated."
)
def update_job(
    job_id: str,
    payload: JobUpdate,
    owner_id: str = Depends(get_authenticated_user_id),
    client: Any = Depends(get_user_scoped_db)
):
    return JobService.update_job(job_id, payload, owner_id, client)

@router.delete(
    "/{job_id}",
    summary="Delete an authorized job",
    description="Deletes a job belonging to the authenticated user."
)
def delete_job(
    job_id: str,
    owner_id: str = Depends(get_authenticated_user_id),
    client: Any = Depends(get_user_scoped_db)
):
    return JobService.delete_job(job_id, owner_id, client)

@router.post(
    "/{job_id}/payments",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record payment for a job",
    description="Records a payment event and deterministically updates remaining balance and job status."
)
def record_payment(
    job_id: str,
    payload: PaymentCreate,
    owner_id: str = Depends(get_authenticated_user_id),
    client: Any = Depends(get_user_scoped_db)
):
    return JobService.record_payment(job_id, payload, owner_id, client)

@router.get(
    "/{job_id}/payments",
    response_model=List[PaymentResponse],
    summary="List payments for a job",
    description="Returns all individual payment transactions recorded for this job."
)
def list_payments(
    job_id: str,
    owner_id: str = Depends(get_authenticated_user_id),
    client: Any = Depends(get_user_scoped_db)
):
    return JobService.list_payments_for_job(job_id, owner_id, client)
