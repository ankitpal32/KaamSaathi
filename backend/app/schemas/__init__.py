from enum import Enum
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator, ConfigDict

# ==============================================================================
# Domain Enums
# ==============================================================================

class TradeType(str, Enum):
    electrical = "electrical"
    plumbing = "plumbing"
    appliance = "appliance"
    other = "other"

class JobStatus(str, Enum):
    pending = "pending"
    partially_paid = "partially_paid"
    completed = "completed"
    in_progress = "in_progress"

class PaymentMode(str, Enum):
    cash = "cash"
    upi = "upi"
    bank_transfer = "bank_transfer"

class ReminderPriority(str, Enum):
    normal = "normal"
    urgent = "urgent"

# ==============================================================================
# Job Schemas
# ==============================================================================

class JobCreate(BaseModel):
    """
    Request payload to create a new confirmed job.
    Enforces monetary validation, non-empty fields, and explicit user confirmation.
    """
    customer_name: str = Field(..., min_length=1, max_length=100, description="Customer full name")
    customer_phone: Optional[str] = Field(default="", max_length=20, description="Contact phone number")
    trade: TradeType = Field(default=TradeType.other, description="Type of trade/service")
    description: str = Field(..., min_length=1, max_length=500, description="Job scope and description")
    agreed_amount: Decimal = Field(..., gt=0, decimal_places=2, description="Total agreed charge for the job (> 0)")
    amount_paid: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2, description="Initial advance payment received (>= 0)")
    status: Optional[JobStatus] = Field(default=None, description="Initial status; calculated if omitted")
    notes: Optional[str] = Field(default="", max_length=1000, description="Special instructions or notes")
    confirmed: bool = Field(default=False, description="Must be True: Job cannot be created without explicit user confirmation")

    @field_validator("customer_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Customer name cannot be empty or whitespace.")
        return stripped

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Job description cannot be empty or whitespace.")
        return stripped

    @field_validator("amount_paid")
    @classmethod
    def validate_paid_amount(cls, v: Decimal, values) -> Decimal:
        agreed = values.data.get("agreed_amount")
        if agreed is not None and v > agreed:
            raise ValueError(f"Amount paid ({v}) cannot exceed agreed amount ({agreed}).")
        return v

class JobUpdate(BaseModel):
    """
    Request payload to edit an existing job.
    Requires user confirmation when updating financial details (agreed_amount, amount_paid).
    """
    customer_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    customer_phone: Optional[str] = Field(default=None, max_length=20)
    trade: Optional[TradeType] = None
    description: Optional[str] = Field(default=None, min_length=1, max_length=500)
    agreed_amount: Optional[Decimal] = Field(default=None, gt=0, decimal_places=2)
    amount_paid: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    status: Optional[JobStatus] = None
    notes: Optional[str] = Field(default=None, max_length=1000)
    confirmed: bool = Field(default=False, description="Must be True to apply financial/status updates")

class JobResponse(BaseModel):
    """
    Unified Job response representation returned to clients.
    """
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    customer_name: str
    customer_phone: Optional[str] = ""
    trade: str
    description: str
    agreed_amount: Decimal
    amount_paid: Decimal
    remaining_balance: Decimal
    status: str
    notes: Optional[str] = ""
    created_at: str
    updated_at: str

# ==============================================================================
# Payment Schemas
# ==============================================================================

class PaymentCreate(BaseModel):
    """
    Request payload to record an incremental payment on a job.
    """
    amount: Decimal = Field(..., gt=0, decimal_places=2, description="Payment amount in INR (> 0)")
    payment_mode: PaymentMode = Field(..., description="Collection method (cash, upi, bank_transfer)")
    notes: Optional[str] = Field(default="", max_length=500, description="Payment notes or reference")
    confirmed: bool = Field(default=False, description="Must be True: Requires technician confirmation")

class PaymentCorrectionCreate(BaseModel):
    """
    Request payload to correct an erroneous payment entry.
    """
    new_amount: Decimal = Field(..., gt=0, decimal_places=2, description="Corrected payment amount in INR (> 0)")
    reason: str = Field(..., min_length=3, max_length=500, description="Reason for correction or adjustment")
    confirmed: bool = Field(default=False, description="Must be True: Requires technician confirmation")

class PaymentResponse(BaseModel):
    """
    Payment event record representation.
    """
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    job_id: str
    amount: Decimal
    payment_mode: str
    notes: Optional[str] = ""
    recorded_at: str
    remaining_balance: Optional[Decimal] = None
    job_status: Optional[str] = None

# ==============================================================================
# Reminder Schemas
# ==============================================================================

class ReminderCreate(BaseModel):
    """
    Request payload to schedule a customer follow-up.
    """
    task: str = Field(..., min_length=1, max_length=500, description="Reminder task description")
    due_date: str = Field(..., description="Due date (YYYY-MM-DD)")
    job_id: Optional[str] = Field(default=None, description="Optional associated job ID")
    trade: TradeType = Field(default=TradeType.other, description="Associated trade")
    priority: ReminderPriority = Field(default=ReminderPriority.normal, description="Priority level")

    @field_validator("task")
    @classmethod
    def validate_task(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Task cannot be empty or whitespace.")
        return stripped

    @field_validator("due_date")
    @classmethod
    def validate_due_date(cls, v: str) -> str:
        from datetime import datetime
        stripped = v.strip()
        try:
            datetime.strptime(stripped, "%Y-%m-%d")
        except ValueError:
            raise ValueError("due_date must be in valid YYYY-MM-DD format.")
        return stripped

class ReminderUpdate(BaseModel):
    """
    Request payload to update or toggle a reminder.
    """
    task: Optional[str] = Field(default=None, min_length=1, max_length=500)
    due_date: Optional[str] = None
    is_completed: Optional[bool] = None
    trade: Optional[TradeType] = None
    priority: Optional[ReminderPriority] = None

    @field_validator("due_date")
    @classmethod
    def validate_due_date(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        from datetime import datetime
        stripped = v.strip()
        try:
            datetime.strptime(stripped, "%Y-%m-%d")
        except ValueError:
            raise ValueError("due_date must be in valid YYYY-MM-DD format.")
        return stripped

class ReminderResponse(BaseModel):
    """
    Reminder item representation.
    """
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    job_id: Optional[str] = None
    task: str
    due_date: str
    is_completed: bool
    trade: str
    priority: str
    created_at: str

# ==============================================================================
# Dashboard Schemas
# ==============================================================================

class DailyEarnings(BaseModel):
    date: str
    day: str
    amount: Decimal
    jobs_count: int

class DashboardStatsResponse(BaseModel):
    total_jobs: int
    total_agreed: Decimal
    total_collected: Decimal
    total_outstanding: Decimal
    pending_jobs_count: int
    completed_jobs_count: int
    upcoming_reminders_count: int
    weekly_earnings: list[DailyEarnings]

# ==============================================================================
# Bolna Voice Assistant Schemas
# ==============================================================================

class BolnaToolExecutionRequest(BaseModel):
    """
    Payload for executing a Bolna function call.
    Accepts standard, nested, and direct webhook parameter shapes.
    """
    model_config = ConfigDict(extra="allow")

    tool_name: Optional[str] = None
    tool: Optional[str] = None
    name: Optional[str] = None
    arguments: Optional[dict] = None
    parameters: Optional[dict] = None
    confirmed: Optional[bool] = None

    @property
    def resolved_name(self) -> str:
        return (self.tool_name or self.tool or self.name or "").strip()

    @property
    def resolved_args(self) -> dict:
        if self.arguments is not None:
            return self.arguments
        if self.parameters is not None:
            return self.parameters
        # Extract any extra fields passed at the root of the JSON payload
        extras = dict(self.model_extra) if self.model_extra else {}
        return extras

class BolnaToolExecutionResponse(BaseModel):
    success: bool
    requires_confirmation: bool = False
    readback: Optional[str] = None
    message: str
    result: Optional[dict | list | str | int | float | bool] = None

# ==============================================================================
# System Schemas
# ==============================================================================

class HealthResponse(BaseModel):
    """
    Health check response safe for public consumption (no secrets).
    """
    status: str
    app_name: str
    version: str
    database_configured: bool
    environment: str
