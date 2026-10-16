"""
Bolna AI Voice Function Calling Specifications and Contracts
Defines strict schemas for the Bolna conversational agent.
Every tool requires explicit confirmation before performing financial mutations.
"""

BOLNA_FUNCTION_CONTRACTS = [
    {
        "name": "create_job",
        "description": "Records a newly confirmed job assignment for the technician with agreed fee and initial advance payment. Must be confirmed by the technician before invoking.",
        "parameters": {
            "type": "object",
            "properties": {
                "customer_name": {
                    "type": "string",
                    "description": "Full name of the customer (e.g. 'Suman Ghosh', 'Ramesh Babu')"
                },
                "customer_phone": {
                    "type": "string",
                    "description": "Contact phone number of the customer"
                },
                "trade": {
                    "type": "string",
                    "enum": ["electrical", "plumbing", "appliance", "other"],
                    "description": "Trade service category"
                },
                "description": {
                    "type": "string",
                    "description": "Scope of work or repair description"
                },
                "agreed_amount": {
                    "type": "number",
                    "description": "Total contracted amount in INR (must be strictly > 0)"
                },
                "amount_paid": {
                    "type": "number",
                    "description": "Initial advance payment received from customer (>= 0)"
                },
                "status": {
                    "type": "string",
                    "enum": ["pending", "in_progress", "partially_paid", "completed"],
                    "description": "Initial status of the job"
                },
                "notes": {
                    "type": "string",
                    "description": "Special instructions or promises made"
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "Must be true. Technician explicitly confirmed the job details verbally."
                }
            },
            "required": ["customer_name", "trade", "description", "agreed_amount", "confirmed"]
        }
    },
    {
        "name": "list_jobs",
        "description": "Lists authorized jobs for the technician, optionally filtered by status.",
        "parameters": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["pending", "partially_paid", "completed", "in_progress"],
                    "description": "Optional status filter"
                }
            }
        }
    },
    {
        "name": "record_payment",
        "description": "Records an incremental cash or UPI payment on an existing job and reconciles remaining udhaar balance.",
        "parameters": {
            "type": "object",
            "properties": {
                "job_id": {
                    "type": "string",
                    "description": "UUID of the job receiving payment"
                },
                "amount": {
                    "type": "number",
                    "description": "Payment amount received in INR (> 0)"
                },
                "payment_mode": {
                    "type": "string",
                    "enum": ["cash", "upi", "bank_transfer"],
                    "description": "Mode of payment"
                },
                "notes": {
                    "type": "string",
                    "description": "Transaction reference or remarks"
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "Must be true. Explicit verbal confirmation from the technician."
                }
            },
            "required": ["job_id", "amount", "payment_mode", "confirmed"]
        }
    },
    {
        "name": "get_outstanding_balances",
        "description": "Queries all customer debts ('udhaar') where remaining balance is greater than 0.",
        "parameters": {
            "type": "object",
            "properties": {
                "customer_name": {
                    "type": "string",
                    "description": "Optional customer name filter to check a specific individual's balance"
                }
            }
        }
    },
    {
        "name": "create_reminder",
        "description": "Schedules a follow-up reminder for the technician (e.g. testing AC cooling, collecting balance).",
        "parameters": {
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "The reminder task description"
                },
                "due_date": {
                    "type": "string",
                    "description": "Due date in YYYY-MM-DD format"
                },
                "job_id": {
                    "type": "string",
                    "description": "Optional associated job UUID"
                },
                "trade": {
                    "type": "string",
                    "enum": ["electrical", "plumbing", "appliance", "other"]
                },
                "priority": {
                    "type": "string",
                    "enum": ["normal", "urgent"]
                }
            },
            "required": ["task", "due_date"]
        }
    },
    {
        "name": "list_reminders",
        "description": "Lists pending follow-up reminders for the technician.",
        "parameters": {
            "type": "object",
            "properties": {
                "include_completed": {
                    "type": "boolean",
                    "description": "Whether to include already completed reminders (default false)"
                }
            }
        }
    },
    {
        "name": "complete_reminder",
        "description": "Marks an existing technician follow-up reminder as completed.",
        "parameters": {
            "type": "object",
            "properties": {
                "reminder_id": {
                    "type": "string",
                    "description": "UUID of the reminder to mark as completed"
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "Technician confirmed completion"
                }
            },
            "required": ["reminder_id"]
        }
    },
    {
        "name": "correct_record",
        "description": "Corrects an erroneous record (e.g., misspelled name or corrected payment amount) after verbal confirmation.",
        "parameters": {
            "type": "object",
            "properties": {
                "entity_type": {
                    "type": "string",
                    "enum": ["job", "payment", "reminder"],
                    "description": "Type of entity to correct"
                },
                "entity_id": {
                    "type": "string",
                    "description": "UUID of the entity to correct"
                },
                "field_name": {
                    "type": "string",
                    "description": "Field name to update (e.g., 'customer_name', 'notes')"
                },
                "new_value": {
                    "type": "string",
                    "description": "New value to set"
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "Must be true. Verified confirmation from the technician."
                }
            },
            "required": ["entity_type", "entity_id", "field_name", "new_value", "confirmed"]
        }
    },
    {
        "name": "answer_ledger_question",
        "description": "Answers natural language questions about the technician's saved jobs, earnings, customer debts (udhaar), and reminders using their authenticated ledger records.",
        "parameters": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "The technician's question in plain English, Hindi, or Bengali (e.g., 'Who owes me money?', 'How much did Ramesh pay?', 'What follow-ups are due today?')"
                }
            },
            "required": ["question"]
        }
    }
]

import logging
from decimal import Decimal
from typing import Dict, Any, Optional
from fastapi import HTTPException
from supabase import Client
from app.schemas import (
    JobCreate, 
    JobStatus,
    PaymentCreate, 
    ReminderCreate, 
    PaymentCorrectionCreate, 
    JobUpdate,
    TradeType,
    PaymentMode,
    ReminderPriority,
    BolnaToolExecutionResponse
)
from app.services.jobs import JobService
from app.services.reminders import ReminderService

logger = logging.getLogger(__name__)

def get_bolna_custom_tasks(base_api_url: str = "http://127.0.0.1:8000") -> list:
    """
    Returns official Bolna Custom Task format schemas for Agent Studio configuration.
    Ref: https://docs.bolna.ai/function-calling
    """
    tasks = []
    for tool in BOLNA_FUNCTION_CONTRACTS:
        name = tool["name"]
        props = tool.get("parameters", {}).get("properties", {})
        param_mapping = {prop: f"%({prop})s" for prop in props}
        tasks.append({
            "name": name,
            "description": tool["description"],
            "pre_call_message": f"Checking and updating your ledger for {name.replace('_', ' ')}...",
            "parameters": tool["parameters"],
            "key": "custom_task",
            "value": {
                "method": "POST",
                "url": f"{base_api_url.rstrip('/')}/api/bolna/tools/execute",
                "param": {
                    "tool_name": name,
                    "arguments": param_mapping
                },
                "api_token": "Bearer %(auth_token)s",
                "headers": {
                    "Content-Type": "application/json"
                }
            }
        })
    return tasks

class BolnaToolExecutor:
    """
    Executes Bolna AI Voice tool calls with:
    - Server-side validation of tool arguments
    - Read-backs of names, amounts, and dates
    - Strict confirmation checks before committing financial mutations
    - Deterministic financial reconciliation
    """

    @classmethod
    def execute(
        cls, 
        tool_name: str, 
        args: Dict[str, Any], 
        owner_id: str, 
        client: Client, 
        confirmed_override: Optional[bool] = None
    ) -> BolnaToolExecutionResponse:
        name = tool_name.strip()
        is_confirmed = confirmed_override if confirmed_override is not None else bool(args.get("confirmed", False))

        if name == "create_job":
            return cls._handle_create_job(args, is_confirmed, owner_id, client)
        elif name == "list_jobs":
            return cls._handle_list_jobs(args, owner_id, client)
        elif name == "record_payment":
            return cls._handle_record_payment(args, is_confirmed, owner_id, client)
        elif name == "get_outstanding_balances":
            return cls._handle_get_outstanding_balances(args, owner_id, client)
        elif name == "create_reminder":
            return cls._handle_create_reminder(args, is_confirmed, owner_id, client)
        elif name == "list_reminders":
            return cls._handle_list_reminders(args, owner_id, client)
        elif name in ["complete_reminder", "toggle_reminder", "finish_reminder"]:
            return cls._handle_complete_reminder(args, is_confirmed, owner_id, client)
        elif name == "correct_record":
            return cls._handle_correct_record(args, is_confirmed, owner_id, client)
        elif name in ["answer_ledger_question", "ask_question", "query_ledger"]:
            return cls._handle_answer_question(args, owner_id, client)
        else:
            return BolnaToolExecutionResponse(
                success=False,
                message=f"Unknown tool '{name}'. Valid tools: {[t['name'] for t in BOLNA_FUNCTION_CONTRACTS]}"
            )

    @classmethod
    def _handle_create_job(cls, args: Dict[str, Any], confirmed: bool, owner_id: str, client: Client) -> BolnaToolExecutionResponse:
        c_name = str(args.get("customer_name", "")).strip()
        if not c_name:
            return BolnaToolExecutionResponse(
                success=False,
                message="Missing required parameter: customer_name is required."
            )

        desc = str(args.get("description", "")).strip()
        if not desc:
            return BolnaToolExecutionResponse(
                success=False,
                message="Missing required parameter: description is required."
            )

        trade_str = str(args.get("trade", "other")).strip().lower()
        try:
            trade = TradeType(trade_str)
        except ValueError:
            trade = TradeType.other

        raw_agreed = args.get("agreed_amount")
        if raw_agreed is None or str(raw_agreed).strip() == "":
            return BolnaToolExecutionResponse(
                success=False,
                message="Missing required parameter: agreed_amount is required."
            )

        try:
            agreed = Decimal(str(raw_agreed))
        except Exception:
            return BolnaToolExecutionResponse(
                success=False,
                message="Invalid amount: agreed_amount must be a valid number."
            )

        if agreed <= 0:
            return BolnaToolExecutionResponse(
                success=False,
                message="Invalid amount: agreed_amount must be greater than zero."
            )

        raw_paid = args.get("amount_paid", 0)
        try:
            paid = Decimal(str(raw_paid if raw_paid is not None else 0))
        except Exception:
            return BolnaToolExecutionResponse(
                success=False,
                message="Invalid amount: amount_paid must be a valid number."
            )

        if paid < 0:
            return BolnaToolExecutionResponse(
                success=False,
                message="Invalid amount: amount_paid cannot be negative."
            )

        if paid > agreed:
            return BolnaToolExecutionResponse(
                success=False,
                message=f"Invalid payment: amount_paid (₹{paid:g}) cannot exceed agreed_amount (₹{agreed:g})."
            )

        status_val = None
        if "status" in args and args["status"]:
            try:
                status_val = JobStatus(str(args["status"]).strip().lower())
            except ValueError:
                return BolnaToolExecutionResponse(
                    success=False,
                    message=f"Invalid job status '{args['status']}'. Must be one of: pending, in_progress, partially_paid, completed."
                )

        balance = agreed - paid
        readback = f"Job for {c_name} ({trade.value}): '{desc}', agreed ₹{agreed:g}, advance received ₹{paid:g}, balance due ₹{balance:g}."

        if not confirmed:
            return BolnaToolExecutionResponse(
                success=False,
                requires_confirmation=True,
                readback=readback,
                message=f"Please confirm: {readback}"
            )

        try:
            payload = JobCreate(
                customer_name=c_name,
                customer_phone=str(args.get("customer_phone", "")).strip(),
                trade=trade,
                description=desc,
                agreed_amount=agreed,
                amount_paid=paid,
                status=status_val,
                notes=str(args.get("notes", "")).strip(),
                confirmed=True
            )
            created = JobService.create_job(payload, owner_id, client)
            return BolnaToolExecutionResponse(
                success=True,
                message=f"Successfully created job for {c_name} (ID: {created['id']}). Balance due: ₹{balance:g}.",
                result=created
            )
        except HTTPException as he:
            return BolnaToolExecutionResponse(success=False, message=str(he.detail))
        except Exception as e:
            logger.error("Error creating job via Bolna: %s", str(e))
            return BolnaToolExecutionResponse(success=False, message=f"Failed to create job: {str(e)}")

    @classmethod
    def _handle_list_jobs(cls, args: Dict[str, Any], owner_id: str, client: Client) -> BolnaToolExecutionResponse:
        status_filter = args.get("status")
        try:
            jobs = JobService.list_jobs(owner_id, client, status=status_filter)
            count = len(jobs)
            summary = f"Found {count} jobs" + (f" with status '{status_filter}'" if status_filter else "") + "."
            return BolnaToolExecutionResponse(
                success=True,
                message=summary,
                result={"total": count, "jobs": jobs}
            )
        except Exception as e:
            return BolnaToolExecutionResponse(success=False, message=f"Failed to list jobs: {str(e)}")

    @classmethod
    def _handle_record_payment(cls, args: Dict[str, Any], confirmed: bool, owner_id: str, client: Client) -> BolnaToolExecutionResponse:
        job_id = str(args.get("job_id", "")).strip()
        try:
            amount = Decimal(str(args.get("amount", 0)))
        except Exception:
            return BolnaToolExecutionResponse(success=False, message="Invalid payment amount.")

        mode_str = str(args.get("payment_mode", "cash")).strip().lower()
        try:
            mode = PaymentMode(mode_str)
        except ValueError:
            mode = PaymentMode.cash

        if not job_id or amount <= 0:
            return BolnaToolExecutionResponse(success=False, message="job_id and a positive payment amount are required.")

        try:
            job = JobService.get_job_by_id(job_id, owner_id, client)
            agreed = Decimal(str(job["agreed_amount"]))
            current_paid = Decimal(str(job["amount_paid"]))
            current_remaining = max(Decimal("0.00"), agreed - current_paid)

            if amount > current_remaining:
                return BolnaToolExecutionResponse(
                    success=False,
                    message=f"Payment of ₹{amount:g} exceeds outstanding balance of ₹{current_remaining:g}."
                )

            new_balance = current_remaining - amount
            readback = f"Record ₹{amount:g} payment via {mode.value.upper()} for {job['customer_name']}. New balance will be ₹{new_balance:g}."

            if not confirmed:
                return BolnaToolExecutionResponse(
                    success=False,
                    requires_confirmation=True,
                    readback=readback,
                    message=f"Please confirm: {readback}"
                )

            payload = PaymentCreate(
                amount=amount,
                payment_mode=mode,
                notes=str(args.get("notes", "")).strip(),
                confirmed=True
            )
            created_pay = JobService.record_payment(job_id, payload, owner_id, client)
            return BolnaToolExecutionResponse(
                success=True,
                message=f"Payment of ₹{amount:g} recorded. Updated balance: ₹{new_balance:g}.",
                result=created_pay
            )
        except HTTPException as he:
            return BolnaToolExecutionResponse(success=False, message=he.detail)
        except Exception as e:
            return BolnaToolExecutionResponse(success=False, message=f"Failed to record payment: {str(e)}")

    @classmethod
    def _handle_get_outstanding_balances(cls, args: Dict[str, Any], owner_id: str, client: Client) -> BolnaToolExecutionResponse:
        target_customer = str(args.get("customer_name", "")).strip().lower()
        try:
            jobs = JobService.list_jobs(owner_id, client)
            debtors = []
            total_udhaar = Decimal("0.00")

            for j in jobs:
                rem = Decimal(str(j.get("remaining_balance", 0)))
                c_name = j.get("customer_name", "")
                if rem > 0:
                    if target_customer and target_customer not in c_name.lower():
                        continue
                    debtors.append({
                        "job_id": j["id"],
                        "customer_name": c_name,
                        "phone": j.get("customer_phone", ""),
                        "trade": j.get("trade", ""),
                        "agreed_amount": float(j.get("agreed_amount", 0)),
                        "amount_paid": float(j.get("amount_paid", 0)),
                        "remaining_balance": float(rem)
                    })
                    total_udhaar += rem

            msg = f"Total outstanding udhaar: ₹{total_udhaar:g} across {len(debtors)} jobs."
            return BolnaToolExecutionResponse(
                success=True,
                message=msg,
                result={"total_outstanding": float(total_udhaar), "debtors": debtors}
            )
        except Exception as e:
            return BolnaToolExecutionResponse(success=False, message=f"Failed to get balances: {str(e)}")

    @classmethod
    def _handle_create_reminder(cls, args: Dict[str, Any], confirmed: bool, owner_id: str, client: Client) -> BolnaToolExecutionResponse:
        task = str(args.get("task", "")).strip()
        due_date = str(args.get("due_date", "")).strip()
        trade_str = str(args.get("trade", "other")).strip().lower()
        prio_str = str(args.get("priority", "normal")).strip().lower()

        try:
            trade = TradeType(trade_str)
        except ValueError:
            trade = TradeType.other

        try:
            prio = ReminderPriority(prio_str)
        except ValueError:
            prio = ReminderPriority.normal

        if not task or not due_date:
            return BolnaToolExecutionResponse(success=False, message="task and due_date (YYYY-MM-DD) are required.")

        readback = f"Schedule reminder '{task}' due on {due_date} ({prio.value} priority)."
        if not confirmed:
            return BolnaToolExecutionResponse(
                success=False,
                requires_confirmation=True,
                readback=readback,
                message=f"Please confirm: {readback}"
            )

        try:
            payload = ReminderCreate(
                task=task,
                due_date=due_date,
                job_id=args.get("job_id"),
                trade=trade,
                priority=prio
            )
            created = ReminderService.create_reminder(payload, owner_id, client)
            return BolnaToolExecutionResponse(
                success=True,
                message=f"Reminder scheduled for {due_date}.",
                result=created
            )
        except HTTPException as he:
            return BolnaToolExecutionResponse(success=False, message=he.detail)
        except Exception as e:
            return BolnaToolExecutionResponse(success=False, message=f"Failed to create reminder: {str(e)}")

    @classmethod
    def _handle_list_reminders(cls, args: Dict[str, Any], owner_id: str, client: Client) -> BolnaToolExecutionResponse:
        include_completed = bool(args.get("include_completed", False))
        try:
            rems = ReminderService.list_reminders(owner_id, client, include_completed=include_completed)
            return BolnaToolExecutionResponse(
                success=True,
                message=f"Found {len(rems)} reminders.",
                result={"total": len(rems), "reminders": rems}
            )
        except Exception as e:
            return BolnaToolExecutionResponse(success=False, message=f"Failed to list reminders: {str(e)}")

    @classmethod
    def _handle_complete_reminder(cls, args: Dict[str, Any], confirmed: bool, owner_id: str, client: Client) -> BolnaToolExecutionResponse:
        rem_id = str(args.get("reminder_id", "")).strip()
        if not rem_id:
            return BolnaToolExecutionResponse(success=False, message="reminder_id is required.")
        
        try:
            completed = ReminderService.toggle_reminder(rem_id, owner_id, client, is_completed=True)
            task_name = completed.get("task", rem_id)
            return BolnaToolExecutionResponse(
                success=True,
                message=f"Reminder '{task_name}' marked as completed.",
                result=completed
            )
        except HTTPException as he:
            return BolnaToolExecutionResponse(success=False, message=str(he.detail))
        except Exception as e:
            return BolnaToolExecutionResponse(success=False, message=f"Failed to complete reminder: {str(e)}")

    @classmethod
    def _handle_correct_record(cls, args: Dict[str, Any], confirmed: bool, owner_id: str, client: Client) -> BolnaToolExecutionResponse:
        entity_type = str(args.get("entity_type", "")).strip().lower()
        entity_id = str(args.get("entity_id", "")).strip()
        field_name = str(args.get("field_name", "")).strip().lower()
        new_val = args.get("new_value")

        if not entity_type or not entity_id or not field_name or new_val is None:
            return BolnaToolExecutionResponse(
                success=False,
                message="entity_type, entity_id, field_name, and new_value are required."
            )

        readback = f"Correct {field_name} of {entity_type} {entity_id} to '{new_val}'."
        if not confirmed:
            return BolnaToolExecutionResponse(
                success=False,
                requires_confirmation=True,
                readback=readback,
                message=f"Please confirm: {readback}"
            )

        try:
            if entity_type == "payment":
                new_amount = Decimal(str(new_val))
                correction_payload = PaymentCorrectionCreate(
                    new_amount=new_amount,
                    reason=f"Voice correction: {field_name} -> {new_val}",
                    confirmed=True
                )
                res = JobService.correct_payment(entity_id, correction_payload, owner_id, client)
                return BolnaToolExecutionResponse(
                    success=True,
                    message=f"Payment corrected to ₹{new_amount:g}. Updated balance: ₹{res.get('remaining_balance', 0)}.",
                    result=res
                )
            elif entity_type == "job":
                update_args: Dict[str, Any] = {"confirmed": True}
                if field_name == "agreed_amount":
                    update_args["agreed_amount"] = Decimal(str(new_val))
                elif field_name == "amount_paid":
                    update_args["amount_paid"] = Decimal(str(new_val))
                elif field_name == "customer_name":
                    update_args["customer_name"] = str(new_val)
                elif field_name == "description":
                    update_args["description"] = str(new_val)
                elif field_name == "notes":
                    update_args["notes"] = str(new_val)
                else:
                    return BolnaToolExecutionResponse(
                        success=False, 
                        message=f"Field '{field_name}' not supported for correction on jobs."
                    )
                
                payload = JobUpdate(**update_args)
                res = JobService.update_job(entity_id, payload, owner_id, client)
                return BolnaToolExecutionResponse(
                    success=True,
                    message=f"Job record updated. Field {field_name} set to {new_val}.",
                    result=res
                )
            elif entity_type == "reminder":
                if field_name in ["is_completed", "status", "complete"]:
                    is_comp = str(new_val).lower() in ["true", "1", "yes", "completed"]
                    res = ReminderService.toggle_reminder(entity_id, owner_id, client, is_completed=is_comp)
                    return BolnaToolExecutionResponse(
                        success=True,
                        message=f"Reminder completion status updated to {is_comp}.",
                        result=res
                    )
                else:
                    return BolnaToolExecutionResponse(
                        success=False,
                        message=f"Field '{field_name}' not supported for reminder correction."
                    )
            else:
                return BolnaToolExecutionResponse(
                    success=False,
                    message=f"Unknown entity_type '{entity_type}'. Must be 'job', 'payment', or 'reminder'."
                )
        except HTTPException as he:
            return BolnaToolExecutionResponse(success=False, message=he.detail)
        except Exception as e:
            return BolnaToolExecutionResponse(success=False, message=f"Correction failed: {str(e)}")

    @classmethod
    def _handle_answer_question(cls, args: Dict[str, Any], owner_id: str, client: Client) -> BolnaToolExecutionResponse:
        question = str(args.get("question", "")).strip().lower()
        if not question:
            return BolnaToolExecutionResponse(
                success=False,
                message="Question cannot be empty. Please ask about your jobs, debts, earnings, or follow-ups."
            )

        try:
            jobs = JobService.list_jobs(owner_id, client)
            reminders = ReminderService.list_reminders(owner_id, client)

            # 1. Customer specific inquiry
            for j in jobs:
                c_name = str(j.get("customer_name", ""))
                if c_name and c_name.lower() in question:
                    agreed = float(j.get("agreed_amount", 0))
                    paid = float(j.get("amount_paid", 0))
                    rem = float(j.get("remaining_balance", 0))
                    status_str = j.get("status", "pending")
                    msg = (
                        f"For {c_name} ({j.get('trade', 'trade')}): "
                        f"Agreed fee is ₹{agreed:g}, paid so far is ₹{paid:g}, "
                        f"and remaining balance is ₹{rem:g} (status: {status_str})."
                    )
                    return BolnaToolExecutionResponse(
                        success=True,
                        message=msg,
                        result={"job": j, "type": "customer_inquiry"}
                    )

            # 2. Debts / Udhaar / Outstanding balances
            if any(w in question for w in ["owe", "baki", "udhaar", "debt", "balance", "due", "pending payment", "বাকি"]):
                debtors = [j for j in jobs if float(j.get("remaining_balance", 0)) > 0]
                total_due = sum(float(j.get("remaining_balance", 0)) for j in debtors)
                if not debtors:
                    msg = "All customer balances are fully settled. You have zero pending udhaar."
                else:
                    names_str = ", ".join(f"{j['customer_name']} (₹{float(j['remaining_balance']):g})" for j in debtors[:5])
                    if len(debtors) > 5:
                        names_str += f", and {len(debtors) - 5} others"
                    msg = f"You have ₹{total_due:g} in pending udhaar across {len(debtors)} customers: {names_str}."
                return BolnaToolExecutionResponse(
                    success=True,
                    message=msg,
                    result={"total_outstanding": total_due, "debtors": debtors, "type": "udhaar_inquiry"}
                )

            # 3. Follow-ups / Reminders
            if any(w in question for w in ["reminder", "follow up", "follow-up", "task", "onusmarok", "অনুস্মারক", "কাজ"]):
                pending_rems = [r for r in reminders if not r.get("is_completed")]
                if not pending_rems:
                    msg = "You have no pending follow-up reminders."
                else:
                    tasks_str = "; ".join(f"'{r['task']}' due {r['due_date']}" for r in pending_rems[:4])
                    msg = f"You have {len(pending_rems)} upcoming reminders: {tasks_str}."
                return BolnaToolExecutionResponse(
                    success=True,
                    message=msg,
                    result={"reminders": pending_rems, "type": "reminders_inquiry"}
                )

            # 4. Earnings / Revenue / Collections
            if any(w in question for w in ["earn", "collected", "revenue", "income", "today", "aaj", "টাকা", "উপার্জন"]):
                total_collected = sum(float(j.get("amount_paid", 0)) for j in jobs)
                completed_count = sum(1 for j in jobs if j.get("status") == "completed")
                msg = f"Your total recorded collections are ₹{total_collected:g} across {len(jobs)} jobs ({completed_count} completed)."
                return BolnaToolExecutionResponse(
                    success=True,
                    message=msg,
                    result={"total_collected": total_collected, "total_jobs": len(jobs), "completed": completed_count, "type": "earnings_inquiry"}
                )

            # 5. Pending / Active jobs
            if any(w in question for w in ["pending job", "active job", "in progress"]):
                active_jobs = [j for j in jobs if j.get("status") in ["pending", "in_progress", "partially_paid"]]
                if not active_jobs:
                    msg = "You have no active or pending jobs right now."
                else:
                    jobs_summary = ", ".join(f"{j['customer_name']} ({j['description']})" for j in active_jobs[:3])
                    msg = f"You have {len(active_jobs)} active jobs: {jobs_summary}."
                return BolnaToolExecutionResponse(
                    success=True,
                    message=msg,
                    result={"active_jobs": active_jobs, "type": "jobs_inquiry"}
                )

            # 6. Default overview
            total_jobs = len(jobs)
            debtors = [j for j in jobs if float(j.get("remaining_balance", 0)) > 0]
            total_due = sum(float(j.get("remaining_balance", 0)) for j in debtors)
            pending_rems = sum(1 for r in reminders if not r.get("is_completed"))
            msg = (
                f"Ledger summary: You have {total_jobs} total jobs, "
                f"₹{total_due:g} in pending udhaar across {len(debtors)} customers, "
                f"and {pending_rems} upcoming follow-up reminders."
            )
            return BolnaToolExecutionResponse(
                success=True,
                message=msg,
                result={"total_jobs": total_jobs, "total_outstanding": total_due, "reminders_count": pending_rems, "type": "summary"}
            )
        except Exception as e:
            logger.error("Error answering ledger question: %s", str(e))
            return BolnaToolExecutionResponse(
                success=False,
                message=f"Could not retrieve answer from ledger: {str(e)}"
            )
