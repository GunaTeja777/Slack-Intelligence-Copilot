import os
import json
import logging
import asyncio
from typing import Dict, Any, List, Optional, Tuple, AsyncGenerator
from openai import OpenAI
from google import genai
from google.genai import types
from config import settings
from mcp_client import mcp_manager
from rag import rag_layer

logger = logging.getLogger("agent")

# Base system instructions
SYSTEM_PROMPT = """You are the "Slack Intelligence Copilot", a high-performance AI agent that connects to Slack via an MCP (Model Context Protocol) server.
Your goal is to help the user manage, search, analyze, and post to Slack using natural language.

You have access to the following tools via MCP:
{tools_description}

You can also search local knowledge cache if needed, but your primary source of truth for live operations is the MCP tools.

CRITICAL RULES:
1. RECONSTRUCT CHANNEL IDS: If the user refers to a channel by name (e.g. "#general"), you must first search for the channel ID or retrieve the list of channels to find the ID. Slack APIs require channel IDs (e.g., 'C0BC5R8LQ92'), NOT names.
2. RECONSTRUCT USER IDS: If the user refers to a user by name, you must search or list users to find their user ID (e.g., 'U0BBYQ88AA1').
3. CONFIRMATION REQUIRED: For any write action (sending a message, replying to a thread), you must pause and output a write request so the user can approve it. Do not attempt to execute it directly without asking the user.
4. CITATIONS: In your final answer, always cite the channels (e.g. [#general](C0BC5R8LQ92)) and users (e.g. [Teja](U0BBYQ88AA1)) you gathered info from.
5. REPORT FORMATTING: For any analysis request (summaries, sentiment, updates, blocker detection), you must format your final response EXACTLY like this:

### Summary
[Provide an executive-level summary of the discussions or findings]

### Key Insights
- [Insight 1]
- [Insight 2]

### Important Decisions
- [Decision 1 or 'No decisions detected']

### Action Items
- [Action item 1 with assignee if known, or 'None']

### Risks & Blockers
- [Risk 1 or blocker, or 'No significant risks identified']

### Citations
- Channels: [#channel-name](channel_id)
- Users: [User Name](user_id)

### Confidence Score
Score: [0-100]% (Reason: [Explain why, e.g., 'analyzed last 50 messages including thread replies'])

---
PROCESS PROTOCOL:
You must perform tasks step-by-step. At each step, output your thought process, followed by the tool call (if any) or your final answer.
Format your output as:
Thought: <your explanation of what you are doing and why>
Call: {{ "tool": "tool_name", "arguments": {{ ... }} }}

If you do not need to call a tool and are ready to provide the final answer, output:
Thought: I have gathered all necessary information and am ready to answer.
Answer: <your final answer structured according to the formats above>
"""

def extract_json_block(text: str) -> Optional[str]:
    """Extracts a balanced JSON block starting with { and ending with } from the text."""
    start_idx = text.find("{")
    if start_idx == -1:
        return None
    
    brace_count = 0
    in_string = False
    escape_char = False
    
    for i in range(start_idx, len(text)):
        char = text[i]
        
        if escape_char:
            escape_char = False
            continue
            
        if char == '\\':
            escape_char = True
            continue
            
        if char == '"':
            in_string = not in_string
            continue
            
        if not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    return text[start_idx:i+1]
                    
    return None

class CopilotAgent:
    def __init__(self):
        self.max_steps = 10

    def _get_tools_description(self) -> str:
        tools = mcp_manager.tools
        if not tools:
            return "No tools available. Connect to the MCP server."
            
        desc = ""
        for t in tools:
            desc += f"- `{t['name']}`: {t['description']}\n"
            desc += f"  Schema: {json.dumps(t['inputSchema'])}\n\n"
        return desc

    async def _call_llm(
        self, 
        provider: str, 
        api_key: str, 
        messages: List[Dict[str, str]]
    ) -> str:
        """Call the configured LLM API (Gemini, OpenAI, or Ollama)."""
        if provider == "gemini":
            client = genai.Client(api_key=api_key)
            
            # Extract system instruction if present
            system_instruction = None
            start_idx = 0
            if messages and messages[0]["role"] == "system":
                system_instruction = messages[0]["content"]
                start_idx = 1
                
            # Build contents
            contents = []
            for msg in messages[start_idx:]:
                role = "user" if msg["role"] == "user" else "model"
                contents.append(types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg["content"])]
                ))
            
            # Generate content using Client
            response = client.models.generate_content(
                model="gemini-3.5-flash",
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.2
                )
            )
            return response.text
            
        elif provider == "openai":
            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.2
            )
            return response.choices[0].message.content
            
        elif provider == "local":
            # Call Ollama API
            import requests
            url = f"{settings.OLLAMA_API_URL}/api/chat"
            payload = {
                "model": settings.OLLAMA_MODEL,
                "messages": messages,
                "stream": False,
                "options": {"temperature": 0.2}
            }
            try:
                res = requests.post(url, json=payload, timeout=30)
                if res.status_code == 200:
                    return res.json().get("message", {}).get("content", "")
                else:
                    return f"Error from Ollama ({res.status_code}): {res.text}"
            except Exception as e:
                return f"Error connecting to Ollama: {e}"
        else:
            raise ValueError(f"Unknown LLM provider: {provider}")

    async def run_query(
        self, 
        query: str, 
        chat_history: List[Dict[str, str]],
        provider: str, 
        api_key: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Run the ReAct agent loop, yielding steps as they occur."""
        # 1. Build prompt
        tools_desc = self._get_tools_description()
        system_content = SYSTEM_PROMPT.format(tools_description=tools_desc)
        
        # Prepare workspace message history
        agent_messages = [{"role": "system", "content": system_content}]
        
        # Add past user-assistant interactions (limit to last 4 for context size)
        for h in chat_history[-4:]:
            agent_messages.append({"role": h["role"], "content": h["content"]})
            
        agent_messages.append({"role": "user", "content": query})
        
        step_count = 0
        while step_count < self.max_steps:
            step_count += 1
            yield {"type": "status", "message": f"Thinking (Step {step_count})..."}
            
            try:
                # Get response from LLM
                response_text = await self._call_llm(provider, api_key, agent_messages)
                logger.info(f"Agent Step {step_count} Response: {response_text}")
                
                # Check for Thought and Call/Answer
                thought = ""
                call_json = None
                answer = ""
                
                # Simple parsing of Thought: and Call: / Answer:
                thought_match = re.search(r"(?i)thought:\s*(.*?)(?=\n(?:call|answer|thought):|$)", response_text, re.DOTALL)
                call_match = re.search(r"(?i)call:\s*(.*)", response_text, re.DOTALL)
                answer_match = re.search(r"(?i)answer:\s*(.*)", response_text, re.DOTALL)
                
                if thought_match:
                    thought = thought_match.group(1).strip()
                else:
                    # Fallback if the model didn't use prefixes
                    thought = response_text
                    
                yield {"type": "thought", "thought": thought}
                
                extracted_call_str = None
                if call_match:
                    extracted_call_str = extract_json_block(call_match.group(1))
                
                if extracted_call_str:
                    call_str = extracted_call_str.strip()
                    try:
                        call_json = json.loads(call_str)
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse call JSON: {call_str}")
                        yield {"type": "error", "message": f"Model generated invalid tool call: {call_str}"}
                        break
                        
                elif answer_match:
                    answer = answer_match.group(1).strip()
                    yield {"type": "answer", "answer": answer}
                    break
                else:
                    # If it didn't explicitly write "Answer:", check if it just wrote the response directly
                    if "thought:" not in response_text.lower() and "call:" not in response_text.lower():
                        yield {"type": "answer", "answer": response_text}
                        break
                    else:
                        # Yield what we have as final
                        yield {"type": "answer", "answer": thought}
                        break

                # If there's a tool call
                if call_json:
                    tool_name = call_json.get("tool") or call_json.get("name")
                    arguments = call_json.get("arguments", {})
                    
                    yield {"type": "tool_start", "tool": tool_name, "arguments": arguments}
                    
                    # Intercept WRITE actions to ask for confirmation
                    if tool_name and (tool_name in ["slack_post_message", "slack_reply_to_thread"] or "post" in tool_name or "send" in tool_name):
                        # Suspend execution, ask for user confirmation
                        yield {
                            "type": "confirmation_required",
                            "tool": tool_name,
                            "arguments": arguments,
                            "preview": {
                                "channel_id": arguments.get("channel_id") or arguments.get("channel"),
                                "text": arguments.get("text"),
                                "thread_ts": arguments.get("thread_ts")
                            }
                        }
                        return # Terminate agent run until confirmed

                    if not tool_name:
                        yield {"type": "error", "message": "Model generated a tool call with no tool/name specified."}
                        break

                    # Execute read-only tools immediately
                    tool_result = await mcp_manager.call_tool(tool_name, arguments)
                    
                    yield {"type": "tool_end", "tool": tool_name, "result": tool_result}
                    
                    # Feed tool output back to agent
                    agent_messages.append({"role": "assistant", "content": response_text})
                    agent_messages.append({
                        "role": "user", 
                        "content": f"Tool '{tool_name}' returned: {json.dumps(tool_result)}"
                    })
                    
            except Exception as e:
                logger.error(f"Agent error at step {step_count}: {e}")
                yield {"type": "error", "message": f"Agent error: {str(e)}"}
                break
        else:
            yield {"type": "error", "message": "Max reasoning steps exceeded without reaching an answer."}

# Singleton instance
agent_runner = CopilotAgent()
import re
