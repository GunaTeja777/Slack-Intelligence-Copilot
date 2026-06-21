import asyncio
import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from agent import agent_runner

async def main():
    try:
        async for chunk in agent_runner.run_query("hello", [], "gemini", "fake_key"):
            print("Chunk:", chunk)
    except Exception as e:
        import traceback
        print("EXCEPTION RAISED:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
