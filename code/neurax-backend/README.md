# cofounders.ai — Backend (neurax)

AI-powered task assignment engine. Parses PRDs into structured tasks, extracts skills from resumes, generates CrewAI agent configurations, and executes them in Docker.

---

## Architecture Overview

Two FastAPI servers run in parallel:

| Server | Port | Entry Point | Purpose |
|---|---|---|---|
| Main API (neurax) | 8000 | `main.py` | PRD parsing, resume proxying, crew generation, Docker execution |
| Resume Parser API | 8001 | `resume_parser_api/main.py` | OCR-based PDF extraction + LLM structured parsing |

---

## Prerequisites

- Python 3.11+
- [`uv`](https://docs.astral.sh/uv/) package manager
- Docker Desktop (must be running for `/crew-run`)
- PowerShell (for `start_servers.ps1`)
- Tesseract OCR — bundled at `resume_parser_api/Tesseract-OCR/`
- Poppler — bundled at `resume_parser_api/poppler-23.11.0/Library/bin/`

---

## Setup

### 1. Install dependencies

```bash
# Install uv if you don't have it
pip install uv

# Install main project dependencies
uv sync

# Install resume parser dependencies
cd resume_parser_api
uv sync
cd ..
```

### 2. Configure environment variables

Create a `.env` in the project root:

```env
CREW_MODEL=gemini-2.0-flash
CREW_API_KEY=your_api_key_here
```

Create a separate `.env` inside `resume_parser_api/` for the resume parser's own LLM credentials (OpenAI or Gemini key, depending on your configuration).

### 3. Start all servers

From the `neurax/` directory, run the PowerShell startup script:

```powershell
.\start_servers.ps1
```

This starts:
- Main API on **port 8000**
- Resume Parser API on **port 8001**
- Frontend (neurax-frontend) on **port 3000**

### 4. Start servers manually (alternative)

```bash
# Main API
uv run uvicorn main:app --host 0.0.0.0 --port 8000

# Resume Parser API (separate terminal)
cd resume_parser_api
uv run python main.py
```

---

## API Reference

### Main API — Port 8000

#### `GET /health/`

Health check.

```json
{ "status": "ok" }
```

---

#### `POST /parse-prd`

Parse a PRD document into structured tasks using the task-master CLI.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `text` | string | No* | Raw PRD text |
| `file` | file | No* | `.txt` or `.pdf` upload |

*Provide either `text` or `file`.

**Response:**
```json
{
  "master": {
    "tasks": [
      {
        "id": 1,
        "title": "...",
        "description": "...",
        "details": "...",
        "testStrategy": "...",
        "priority": "high|medium|low",
        "dependencies": [2, 3],
        "status": "pending",
        "subtasks": []
      }
    ],
    "metadata": {}
  }
}
```

---

#### `POST /parse-resume`

Parse a resume PDF. Proxies to the port 8001 resume parser and saves the result locally.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | Yes | PDF resume |

**Response:**
```json
{
  "message": "Resume parsed and saved.",
  "saved_as": "john_doe.json",
  "data": {
    "process_id": "abc123",
    "extracted_info": {
      "name": "John Doe",
      "email": "john@example.com",
      "mobile": "+1-555-0100",
      "skills": ["Python", "FastAPI", "Docker"],
      "companies": ["Acme Corp"],
      "education": ["B.S. Computer Science, MIT"],
      "achievements": ["Led migration to microservices"],
      "is_fresher": false,
      "total_experience_in_months": 36
    },
    "raw_text": "..."
  }
}
```

Parsed resume is saved to `tmp/resumes/<name>.json`.

---

#### `POST /crew-generate`

Generate a complete CrewAI configuration from the parsed PRD tasks and all uploaded resumes. Uses an LLM configured via `CREW_MODEL` and `CREW_API_KEY`.

**Query parameters:**

| Param | Default | Description |
|---|---|---|
| `output_subdir` | `output` | Subdirectory inside `aryaman/` to write generated files |

**Reads from:**
- `.taskmaster/tasks/tasks.json`
- `tmp/resumes/*.json`

**Response:**
```json
{
  "written_files": ["agents.yaml", "tasks.yaml", "crew.py", "main.py"],
  "agents_yaml": "...",
  "tasks_yaml": "...",
  "new_agents": ["developer", "designer"],
  "output_dir": "aryaman/output/",
  "generated_at": "2026-03-15T12:00:00Z"
}
```

Writes `agents.yaml`, `tasks.yaml`, `crew.py`, and `main.py` to `aryaman/output/`.

---

#### `POST /crew-run-stream`

Run the generated CrewAI project in Docker. Streams real-time build and execution logs via Server-Sent Events (SSE).

**Response:** `text/event-stream`

Each SSE event carries a JSON payload:
```
data: {"type": "status"|"log"|"done"|"error", "stream": "build"|"run"|"", "line": "..."}
```

Pipeline: copy files → docker build → docker run → zip output.

---

#### `POST /crew-run`

Same pipeline as `/crew-run-stream` but blocking — waits for completion before returning.

**Response:**
```json
{
  "copied_files": ["agents.yaml", "tasks.yaml", "crew.py", "main.py"],
  "returncode": 0,
  "stdout": "...",
  "stderr": "...",
  "zip_url": "/crew-download"
}
```

---

#### `GET /crew-download`

Download the crew execution output as a zip archive.

**Response:** `crew_output.zip` (binary file download)

---

### Resume Parser API — Port 8001

#### `GET /health`

Health check.

#### `POST /api/v1/resume/parse`

Parse a resume PDF using Tesseract OCR + Poppler for text extraction and OpenAI/Gemini for structured field extraction.

**Request:** `multipart/form-data` — PDF file upload

**Response:** Full parsed resume object matching the `data` shape returned by `/parse-resume` above.

---

## Directory Structure

```
neurax/
├── main.py                      # FastAPI entry point (port 8000)
├── routes/
│   ├── health.py
│   ├── parse_prd.py
│   ├── parse_resume.py
│   ├── generate_crew.py
│   └── run_crew.py
├── services/
│   ├── prd_parser.py            # Calls task-master CLI
│   ├── resume_parser.py         # Proxies to port 8001
│   ├── crew_generator.py        # LLM-based CrewAI config generation
│   └── crew_runner.py           # Docker build + run + SSE streaming
├── resume_parser_api/           # Standalone FastAPI app (port 8001)
│   ├── main.py
│   ├── Tesseract-OCR/           # Bundled Tesseract binary (Windows)
│   ├── poppler-23.11.0/         # Bundled Poppler binary (Windows)
│   └── .env
├── crewai_project/              # Docker context for crew execution
├── aryaman/
│   └── output/                  # Generated CrewAI config files land here
├── tmp/
│   └── resumes/                 # Parsed resume JSON cache
├── .taskmaster/
│   └── tasks/
│       └── tasks.json           # task-master output (read by crew-generate)
├── start_servers.ps1            # Starts all three servers
├── pyproject.toml
└── .env
```

---

## Environment Variables

| Variable | Where | Description | Example |
|---|---|---|---|
| `CREW_MODEL` | `neurax/.env` | LLM model for crew config generation | `gemini-2.0-flash` |
| `CREW_API_KEY` | `neurax/.env` | API key for the crew LLM | `AIza...` |

The resume parser uses its own `.env` inside `resume_parser_api/`. Refer to that directory for its required keys (typically an OpenAI or Gemini API key).

---

## Notes

- CORS is open to all origins (`*`) — this is intentional for local development. Restrict it before any deployment.
- Docker Desktop must be running before calling `/crew-run` or `/crew-run-stream`.
- The Tesseract and Poppler binaries are bundled for Windows and referenced by hardcoded paths inside the resume parser. Do not move or rename those directories.
- Always run `start_servers.ps1` from the `neurax/` root directory, not from a subdirectory.
