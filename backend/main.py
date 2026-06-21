import os
import sys
import json
import logging
import asyncio

# Ensure backend directory is in the sys.path so direct imports work
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from mcp_client import mcp_manager
from rag import rag_layer
from dashboard import dashboard_manager
from agent import agent_runner

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("main")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up FastAPI application...")
    # Read command and args from settings
    cmd = settings.MCP_SERVER_COMMAND
    server_args = settings.MCP_SERVER_ARGS
    
    if isinstance(server_args, str):
        if os.path.exists(server_args):
            args = [server_args]
        else:
            import shlex
            args = shlex.split(server_args, posix=False) if os.name == 'nt' else shlex.split(server_args)
            args = [a.strip('"\'') for a in args]
    else:
        args = server_args
        
    logger.info(f"Connecting to MCP server: {cmd} with args {args}")
    # Try connecting in background
    asyncio.create_task(mcp_manager.connect(command=cmd, args=args))
    yield
    logger.info("Shutting down FastAPI application...")
    await mcp_manager.disconnect()

app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

# Enable CORS for React frontend (Vite defaults to port 5173 or similar)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class ConnectRequest(BaseModel):
    command: str
    args: List[str]
    slack_token: Optional[str] = None

class MessageHistoryItem(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    history: List[MessageHistoryItem]
    provider: Optional[str] = None
    api_key: Optional[str] = None

class ConfirmRequest(BaseModel):
    tool: str
    arguments: Dict[str, Any]

class SearchRequest(BaseModel):
    query: str
    channel_id: Optional[str] = None
    user_id: Optional[str] = None
    semantic: bool = False
    limit: Optional[int] = 10

class SettingsUpdateRequest(BaseModel):
    provider: str
    api_key: Optional[str] = None
    slack_token: Optional[str] = None
    server_command: Optional[str] = None
    server_args: Optional[str] = None

# Background Task for Syncing
async def run_sync_task():
    rag_layer.log_audit("SYNC_START", "Initiating background sync from Slack API...")
    if not mcp_manager.connected:
        logger.error("Sync failed: Not connected to MCP server.")
        rag_layer.log_audit("SYNC_ERROR", "Sync failed: Not connected to MCP server.")
        return
        
    try:
        # 1. Fetch and Sync Channels
        channels_res = await mcp_manager.call_tool("slack_get_channels", {})
        if channels_res.get("ok"):
            channels = channels_res.get("channels", [])
            rag_layer.save_channels(channels)
            
            # 2. Fetch and Sync Messages for active channels
            for ch in channels[:5]:  # Sync top 5 channels to avoid token rate limits during demo
                history_res = await mcp_manager.call_tool("slack_get_history", {"channel_id": ch["id"], "limit": 50})
                if history_res.get("ok"):
                    messages = history_res.get("messages", [])
                    rag_layer.save_messages(ch["id"], messages)
                    
                    # If messages have threads, sync replies
                    for msg in messages:
                        if msg.get("reply_count", 0) > 0 and msg.get("thread_ts"):
                            thread_res = await mcp_manager.call_tool(
                                "slack_get_thread", 
                                {"channel_id": ch["id"], "thread_ts": msg["thread_ts"], "limit": 20}
                            )
                            if thread_res.get("ok"):
                                thread_messages = thread_res.get("messages", [])
                                # Save thread replies as well (same table, channel_id matches)
                                rag_layer.save_messages(ch["id"], thread_messages)
        
        # 3. Fetch and Sync Users
        users_res = await mcp_manager.call_tool("slack_get_users", {})
        if users_res.get("ok"):
            users = users_res.get("users", [])
            rag_layer.save_users(users)

        # 4. Trigger Vector Indexing if API keys are set
        provider = rag_layer.get_setting("provider", settings.LLM_PROVIDER)
        api_key = rag_layer.get_setting("api_key", settings.GEMINI_API_KEY or settings.OPENAI_API_KEY)
        if api_key:
            indexed = rag_layer.index_messages(provider, api_key)
            logger.info(f"Automatically indexed {indexed} messages.")
            
        rag_layer.log_audit("SYNC_COMPLETE", "Successfully completed full workspace sync.")
    except Exception as e:
        logger.error(f"Error in sync task: {e}")
        rag_layer.log_audit("SYNC_ERROR", f"Error during sync: {e}")

# API Endpoints
@app.get("/api/v1/status")
async def get_status():
    """Return connection status, logs, and list of discovered tools."""
    return {
        "connected": mcp_manager.connected,
        "tools": mcp_manager.tools,
        "logs": mcp_manager.logs,
        "config": {
            "server_command": mcp_manager.server_command,
            "server_args": mcp_manager.server_args,
            "provider": rag_layer.get_setting("provider", settings.LLM_PROVIDER),
            "has_api_key": bool(rag_layer.get_setting("api_key") or settings.GEMINI_API_KEY or settings.OPENAI_API_KEY),
            "slack_token_configured": bool(os.environ.get("SLACK_BOT_TOKEN") or settings.SLACK_BOT_TOKEN)
        }
    }

@app.post("/api/v1/connect")
async def connect_mcp(req: ConnectRequest):
    """Manually connect or reconnect to an MCP server."""
    env = {}
    if req.slack_token:
        env["SLACK_BOT_TOKEN"] = req.slack_token
        # Update setting
        os.environ["SLACK_BOT_TOKEN"] = req.slack_token
        
    success = await mcp_manager.connect(command=req.command, args=req.args, env_override=env)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to connect to MCP server. Check logs.")
        
    return {"status": "connected", "tools": mcp_manager.tools}

@app.post("/api/v1/chat")
async def chat(req: ChatRequest):
    """Interact with the Agent, streaming thoughts, tool calls, and final answers."""
    # Resolve provider and API key
    provider = req.provider or rag_layer.get_setting("provider") or settings.LLM_PROVIDER
    api_key = req.api_key or rag_layer.get_setting("api_key")
    
    # Fallback to config settings if not explicitly saved in settings
    if not api_key:
        if provider == "gemini":
            api_key = settings.GEMINI_API_KEY
        elif provider == "openai":
            api_key = settings.OPENAI_API_KEY

    # Allow local (Ollama) to run without API key
    if provider != "local" and not api_key:
        raise HTTPException(
            status_code=400, 
            detail=f"API Key for provider '{provider}' is missing. Please save it in the settings panel first."
        )

    # Convert history items to dicts
    history_dicts = [{"role": h.role, "content": h.content} for h in req.history]

    async def event_generator():
        try:
            async for chunk in agent_runner.run_query(req.query, history_dicts, provider, api_key):
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            logger.error(f"Error in chat event stream: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/v1/confirm")
async def confirm_action(req: ConfirmRequest):
    """Execute a pending write action after user confirmation."""
    tool_name = req.tool
    arguments = req.arguments
    
    # Audit log entry before executing write
    details = f"User confirmed write action: {tool_name} with arguments: {json.dumps(arguments)}"
    rag_layer.log_audit("WRITE_CONFIRMED", details)
    
    # Run the tool via MCP Client
    res = await mcp_manager.call_tool(tool_name, arguments)
    
    # Audit log result
    rag_layer.log_audit("WRITE_EXECUTED", f"Write action result: {json.dumps(res)}")
    return res

@app.post("/api/v1/sync")
async def trigger_sync(background_tasks: BackgroundTasks):
    """Trigger background sync of Slack workspace."""
    if not mcp_manager.connected:
        raise HTTPException(status_code=400, detail="Cannot sync: not connected to Slack MCP server.")
        
    background_tasks.add_task(run_sync_task)
    return {"status": "sync_started", "message": "Slack workspace sync started in the background."}

@app.post("/api/v1/search")
async def search_workspace(req: SearchRequest):
    """Search cached messages using keyword or semantic vector search."""
    # Resolve provider and API key for semantic search
    provider = rag_layer.get_setting("provider", settings.LLM_PROVIDER)
    api_key = rag_layer.get_setting("api_key") or settings.GEMINI_API_KEY or settings.OPENAI_API_KEY
    
    if req.semantic:
        if not api_key and provider != "local":
            raise HTTPException(
                status_code=400, 
                detail="API Key is required to run semantic search. Please configure it first."
            )
        results = rag_layer.search_semantic(
            query=req.query,
            provider=provider,
            api_key=api_key,
            channel_id=req.channel_id,
            user_id=req.user_id,
            limit=req.limit
        )
    else:
        results = rag_layer.search_keyword(
            query=req.query,
            channel_id=req.channel_id,
            user_id=req.user_id,
            limit=req.limit
        )
        
    return {"query": req.query, "semantic": req.semantic, "results": results}

@app.get("/api/v1/dashboard")
async def get_dashboard():
    """Return dashboard analytics charts and metrics."""
    stats = dashboard_manager.get_stats()
    return stats

@app.get("/api/v1/channels")
async def get_channels():
    """Return cached channels."""
    return {"channels": rag_layer.get_cached_channels()}

@app.get("/api/v1/users")
async def get_users():
    """Return cached users."""
    return {"users": rag_layer.get_cached_users()}

@app.get("/api/v1/messages")
async def get_messages(channel_id: Optional[str] = None, limit: Optional[int] = 100):
    """Return cached messages."""
    return {"messages": rag_layer.get_cached_messages(channel_id, limit)}

@app.get("/api/v1/audit-logs")
async def get_audit_logs():
    """Return secure write actions audit trail."""
    with rag_layer._get_connection() as conn:
        cursor = conn.cursor()
        rows = cursor.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100").fetchall()
        return {"logs": [dict(r) for r in rows]}

@app.post("/api/v1/settings")
async def update_settings(req: SettingsUpdateRequest):
    """Save API keys, provider choice, and custom MCP details."""
    rag_layer.set_setting("provider", req.provider)
    if req.api_key:
        rag_layer.set_setting("api_key", req.api_key)
        
    if req.slack_token:
        os.environ["SLACK_BOT_TOKEN"] = req.slack_token
        # Update configuration in config
        settings.SLACK_BOT_TOKEN = req.slack_token
        
    if req.server_command:
        settings.MCP_SERVER_COMMAND = req.server_command
        
    if req.server_args:
        settings.MCP_SERVER_ARGS = req.server_args

    rag_layer.log_audit("SETTINGS_UPDATED", f"Provider updated to '{req.provider}'")
    return {"status": "success", "message": "Settings updated successfully."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
