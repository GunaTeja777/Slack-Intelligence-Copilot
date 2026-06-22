import os
from google import genai

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    # Load from backend/.env
    with open(".env", "r") as f:
        for line in f:
            if line.startswith("GEMINI_API_KEY="):
                api_key = line.split("=")[1].strip().strip('"\'')
                break

if not api_key:
    print("No GEMINI_API_KEY found.")
    exit(1)

client = genai.Client(api_key=api_key)

models_to_test = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
]

for model_name in models_to_test:
    print(f"Testing model: {model_name}...")
    try:
        response = client.models.generate_content(
            model=model_name,
            contents="Say 'Hello'",
        )
        print(f"  SUCCESS! Response: {response.text}")
    except Exception as e:
        print(f"  FAILED: {e}")
