import os
from google import genai
from dotenv import load_dotenv

# Load env variables
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path)

gemini_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=gemini_key)

try:
    print("Listing available models...")
    for model in client.models.list():
        print(f"Model: {model.name} (Supported actions: {model.supported_generation_methods})")
except Exception as e:
    print(f"Error listing models: {e}")
