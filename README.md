# Slack Intelligence Copilot 🚀

An AI-driven workspace intelligence dashboard and conversational auditor for Slack. It leverages the Model Context Protocol (MCP) to interact securely with Slack workspace data, index conversations locally, enable keyword/semantic search, and run ReAct-style reasoning loops to summarize channels, track decisions, and draft posts with human-in-the-loop validation.

---

## 📂 Project Architecture

The codebase is split into two independent services:

```
├── backend/                  # FastAPI & Python backend
│   ├── agent.py              # ReAct Agent loop logic (Gemini/OpenAI/Ollama)
│   ├── config.py             # Configuration & Environment Settings
│   ├── dashboard.py          # Metrics & Analytics Compilation
│   ├── main.py               # FastAPI server entry point and CORS setup
│   ├── mcp_client.py         # Client managing connections to the MCP Server
│   ├── rag.py                # Database indexing, caching & vector search (RAG)
│   ├── slack_mcp_server.py   # Slack MCP server (FastMCP) serving slack tools
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Template for backend secrets
│
├── frontend/                 # React, TypeScript, and Vite frontend
│   ├── src/                  # React dashboard & chat components
│   ├── public/               # Static assets
│   ├── package.json          # Frontend npm dependencies
│   ├── vite.config.ts        # Vite build tool setup
│   └── .env.example          # Template for frontend environment variables
```

---

## ⚙️ Prerequisites

- **Python 3.10+** (for Backend)
- **Node.js 18+** & **npm** (for Frontend)
- A **Slack Bot Token** (`xoxb-...`) with scopes:
  - `channels:read`, `groups:read`, `channels:history`, `groups:history`, `users:read`, `chat:write`
- A **Gemini API Key** or **OpenAI API Key** (for LLM reasoning & vector embeddings)

---

## 🚀 Local Development Setup

### 1. Backend Setup

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```

2. Create a Python Virtual Environment:
   ```bash
   python -m venv venv
   ```

3. Activate the Virtual Environment:
   - **Windows (CMD/PowerShell)**:
     ```powershell
     .\venv\Scripts\activate
     ```
   - **macOS/Linux**:
     ```bash
     source venv/bin/activate
     ```

4. Install the Dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Set up Environment Variables:
   Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your `SLACK_BOT_TOKEN`, `GEMINI_API_KEY` (or `OPENAI_API_KEY`).

6. Run the FastAPI Server:
   ```bash
   python main.py
   ```
   The backend will start on [http://127.0.0.1:8000](http://127.0.0.1:8000) and initialize the local SQLite database (`slack_copilot.db`).

---

### 2. Frontend Setup

1. Navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```

2. Install Node Dependencies:
   ```bash
   npm install
   ```

3. Set up Environment Variables (optional, defaults to local API):
   Create a `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Run the Dev Server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser to interact with the dashboard!

---

## ☁️ Deployment Guidelines

Because the codebase is separated, you can host them independently on platforms optimized for each service:

### Backend Deployment (e.g., Render, Railway, Fly.io)

1. **Deploy Python Web Service**:
   - Point the build context to the `/backend` folder or specify `backend` as the Root Directory.
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

2. **Environment Variables**:
   Define `SLACK_BOT_TOKEN`, `GEMINI_API_KEY`, etc., in your host provider's dashboard.

3. **Persistent Disk (Optional)**:
   By default, the SQLite database (`slack_copilot.db`) is stored locally. For production data persistence, mount a small persistent disk (e.g., 1GB) and set your database path settings accordingly.

---

### Frontend Deployment (e.g., Vercel, Netlify, Cloudflare Pages)

1. **Deploy static Vite App**:
   - Set the Root Directory to `frontend`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

2. **Environment Variables**:
   - Set `VITE_API_BASE` to your hosted Backend API URL (e.g. `https://your-backend.onrender.com/api/v1`).
