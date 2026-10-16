import os
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
import httpx
from app.config import settings
from app.services.bolna_tools import BOLNA_FUNCTION_CONTRACTS, BolnaToolExecutor, get_bolna_custom_tasks
from app.database import get_authenticated_user_id, get_user_scoped_client, get_user_scoped_db
from app.schemas import BolnaToolExecutionRequest, BolnaToolExecutionResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Voice Assistant"])

@router.get(
    "/bolna/tools",
    summary="List Bolna Function Contracts",
    description="Returns the registered tool calling schemas for the Bolna Voice Agent in OpenAI tools format and Bolna Custom Task format."
)
def get_bolna_tools(
    format: Optional[str] = Query(default="all", description="Schema format: 'openai', 'bolna_task', or 'all'")
):
    """
    Returns registered function tools configured for Bolna Voice Assistant.
    Supports OpenAI Tool Specifications and Bolna Custom Task specifications.
    Ref: https://docs.bolna.ai/function-calling
    """
    if format == "openai":
        return {"tools": BOLNA_FUNCTION_CONTRACTS}
    elif format == "bolna_task":
        return {"tasks": get_bolna_custom_tasks()}
    else:
        return {
            "tools": BOLNA_FUNCTION_CONTRACTS,
            "custom_tasks": get_bolna_custom_tasks()
        }

@router.post(
    "/bolna-session",
    summary="Mint Bolna WebRTC Session",
    description="Securely mints a short-lived WebRTC session token for the browser @bolna/web-call client."
)
async def mint_bolna_session(
    body: Optional[Dict[str, Any]] = None,
    authorization: Optional[str] = Header(None)
):
    """
    Session minting proxy:
    - Keeps BOLNA_API_KEY safely on server; never exposed to browser bundles.
    - If BOLNA_API_KEY is not configured, returns clear 503 status explaining that Bolna credentials are required.
    """
    bolna_api_key = settings.BOLNA_API_KEY or os.getenv("BOLNA_API_KEY", "")
    bolna_agent_id = settings.BOLNA_AGENT_ID or os.getenv("BOLNA_AGENT_ID", "")

    if not bolna_api_key or not bolna_agent_id or bolna_api_key.startswith("bn-your") or bolna_agent_id.startswith("your-agent"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Bolna Voice Agent is not configured on the backend. Set BOLNA_API_KEY and BOLNA_AGENT_ID in backend/.env."
        )

    user_data = (body or {}).get("user_data", {})
    payload = {
        "agent_id": bolna_agent_id,
        "recipient_phone_number": "webrtc",
        "user_data": user_data
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.bolna.ai/web-call/freeswitch-session",
                headers={
                    "Authorization": f"Bearer {bolna_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload
            )

            if not resp.is_success:
                logger.error("Bolna API call failed: %s %s", resp.status_code, resp.text)
                detail_msg = f"Failed to initialize voice session with Bolna API (HTTP {resp.status_code})"
                try:
                    err_json = resp.json()
                    if isinstance(err_json, dict) and "message" in err_json:
                        detail_msg += f": {err_json['message']}"
                except Exception:
                    pass
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=detail_msg
                )

            return resp.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error communicating with Bolna: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error establishing voice session: {str(e)}"
        )

@router.post(
    "/bolna/tools/execute",
    response_model=BolnaToolExecutionResponse,
    summary="Execute Bolna Function Calling Action",
    description="Validates tool arguments, provides verbal readbacks, requires explicit confirmation for financial writes, and returns structured results."
)
def execute_bolna_tool(
    payload: BolnaToolExecutionRequest,
    tool: Optional[str] = Query(default=None, description="Optional tool name query param"),
    owner_id: str = Depends(get_authenticated_user_id),
    client: Any = Depends(get_user_scoped_db)
):
    """
    Executes one of the official Bolna function tools:
    create_job, list_jobs, record_payment, get_outstanding_balances, create_reminder, list_reminders, correct_record.
    """
    tool_name = (tool or payload.resolved_name).strip()
    if not tool_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tool_name or tool is required in payload or query parameter."
        )

    args = payload.resolved_args
    override_confirmed = payload.confirmed

    return BolnaToolExecutor.execute(
        tool_name=tool_name,
        args=args,
        owner_id=owner_id,
        client=client,
        confirmed_override=override_confirmed
    )
