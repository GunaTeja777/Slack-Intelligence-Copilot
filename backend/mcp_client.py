import os
import sys
import json
import asyncio
import logging
import shlex
from typing import Dict, Any, List, Optional
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

logger = logging.getLogger("mcp_client")

class MCPClientManager:
    def __init__(self):
        self.session: Optional[ClientSession] = None
        self.exit_stack = None
        self.read_stream = None
        self.write_stream = None
        self.connected = False
        self.tools = []
        self.logs = [] # In-memory list of logs for the execution panel
        self.server_command = "python"
        self.server_args = ["slack_mcp_server.py"]
        self.current_task = None

    def add_log(self, level: str, message: str, tool_call: Optional[Dict[str, Any]] = None):
        log_entry = {
            "timestamp": asyncio.get_event_loop().time() if asyncio.get_event_loop().is_running() else 0,
            "level": level,
            "message": message,
            "tool_call": tool_call
        }
        self.logs.append(log_entry)
        # Keep logs capped
        if len(self.logs) > 500:
            self.logs.pop(0)
        logger.info(f"[{level}] {message}")

    async def connect(self, command: str = "python", args: List[str] = ["slack_mcp_server.py"], env_override: Optional[Dict[str, str]] = None) -> bool:
        """Connect to the MCP server via Stdio."""
        if self.connected:
            await self.disconnect()

        self.server_command = command
        self.server_args = args
        self.add_log("INFO", f"Connecting to MCP server: {command} {' '.join(args)}")

        # Construct environment variables
        env = dict(os.environ)
        if env_override:
            env.update(env_override)

        # Make sure SLACK_BOT_TOKEN is set
        if "SLACK_BOT_TOKEN" not in env:
            # Fallback check if it was set elsewhere
            from config import settings
            if settings.SLACK_BOT_TOKEN:
                env["SLACK_BOT_TOKEN"] = settings.SLACK_BOT_TOKEN

        # On Windows, executing cmd /c or npx sometimes requires Shell=True or full path resolution.
        # StdioServerParameters handles subprocess creation.
        # Let's adjust command/args if on Windows.
        executable = command
        run_args = list(args)
        
        # If command is 'npx' on Windows, we should execute 'npx.cmd' or use cmd.exe /c
        if os.name == 'nt':
            if command == 'npx':
                executable = 'npx.cmd'
            elif command == 'npm':
                executable = 'npm.cmd'

        server_params = StdioServerParameters(
            command=executable,
            args=run_args,
            env=env
        )

        try:
            self.exit_stack = contextlib_asynccontextmanager = stdio_client(server_params)
            self.read_stream, self.write_stream = await self.exit_stack.__aenter__()
            self.session = ClientSession(self.read_stream, self.write_stream)
            await self.session.__aenter__()
            
            # Initialize session
            self.add_log("INFO", "Initializing MCP session...")
            await self.session.initialize()
            self.connected = True
            self.add_log("INFO", "MCP session initialized successfully!")
            
            # Discover tools
            await self.refresh_tools()
            return True
        except Exception as e:
            self.add_log("ERROR", f"Failed to connect to MCP server: {e}")
            self.connected = False
            self.session = None
            if self.exit_stack:
                try:
                    await self.exit_stack.__aexit__(None, None, None)
                except:
                    pass
                self.exit_stack = None
            return False

    async def disconnect(self):
        """Disconnect and cleanup."""
        if not self.connected:
            return
            
        self.add_log("INFO", "Disconnecting from MCP server...")
        self.connected = False
        
        if self.session:
            try:
                await self.session.__aexit__(None, None, None)
            except Exception as e:
                logger.error(f"Error exiting MCP session: {e}")
            self.session = None

        if self.exit_stack:
            try:
                await self.exit_stack.__aexit__(None, None, None)
            except Exception as e:
                logger.error(f"Error exiting stdio client: {e}")
            self.exit_stack = None

        self.tools = []
        self.add_log("INFO", "Disconnected from MCP server.")

    async def refresh_tools(self) -> List[Dict[str, Any]]:
        """Query the MCP server for available tools."""
        if not self.connected or not self.session:
            self.add_log("WARNING", "Cannot refresh tools: not connected.")
            return []
            
        try:
            self.add_log("INFO", "Querying available tools from MCP server...")
            response = await self.session.list_tools()
            
            # Extract tools list
            tools_list = []
            # response is typically a ListToolsResult containing a list of Tool objects
            # Let's inspect the structure.
            raw_tools = getattr(response, "tools", [])
            for tool in raw_tools:
                tools_list.append({
                    "name": tool.name,
                    "description": tool.description,
                    "inputSchema": tool.inputSchema if hasattr(tool, "inputSchema") else getattr(tool, "input_schema", {})
                })
            self.tools = tools_list
            self.add_log("INFO", f"Discovered {len(self.tools)} tools: {', '.join([t['name'] for t in self.tools])}")
            return self.tools
        except Exception as e:
            self.add_log("ERROR", f"Failed to refresh tools: {e}")
            return []

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool on the connected MCP server."""
        if not self.connected or not self.session:
            error_msg = f"Cannot call tool '{tool_name}': not connected to MCP server."
            self.add_log("ERROR", error_msg)
            return {"ok": False, "error": error_msg}

        self.add_log("INFO", f"Calling tool '{tool_name}' with args: {json.dumps(arguments)}", tool_call={"name": tool_name, "arguments": arguments})
        
        try:
            # call_tool returns a CallToolResult which contains contents (e.g. TextContent)
            response = await self.session.call_tool(tool_name, arguments)
            
            # Extract content from response
            contents = getattr(response, "content", [])
            text_result = ""
            for content in contents:
                if hasattr(content, "text"):
                    text_result += content.text
                elif isinstance(content, dict) and "text" in content:
                    text_result += content["text"]
                    
            # Check if it looks like JSON and parse it
            try:
                parsed_result = json.loads(text_result)
                self.add_log("INFO", f"Tool '{tool_name}' succeeded!")
                return parsed_result
            except json.JSONDecodeError:
                self.add_log("INFO", f"Tool '{tool_name}' succeeded (raw text format).")
                return {"ok": True, "result": text_result}
                
        except Exception as e:
            error_msg = f"Error executing tool '{tool_name}': {e}"
            self.add_log("ERROR", error_msg)
            return {"ok": False, "error": str(e)}

# Singleton manager
mcp_manager = MCPClientManager()
