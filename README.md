# Voice-Controlled Local AI Agent

Local AI agent that accepts audio input, transcribes with Whisper, classifies intent with Ollama, executes tool actions safely inside output, and streams progress to a React frontend.

## Features

- Local speech-to-text with Whisper small model
- Local intent classification with Ollama llama3.2:3b
- Tool routing for create_file, write_code, summarize, and general_chat
- SSE streaming pipeline updates from backend to frontend
- Safety guardrail: generated files are restricted to output

## Architecture

```text
      +--------------------------------------------------+
      |                 React + Vite UI                  |
      |  AudioInput | PipelineStatus | Result | History  |
      +---------------------------+----------------------+
                                  |
                                  | HTTP + SSE
                                  v
      +--------------------------------------------------+
      |                  FastAPI Backend                 |
      |  POST /transcribe  POST /process  POST /agent    |
      |  GET  /history     GET  /health                  |
      +--------------------+-----------------------------+
                           |
           +---------------+---------------+
           |                               |
           v                               v
   +---------------+               +----------------------+
   | Whisper small |               | Ollama llama3.2:3b   |
   | transcriber   |               | intent + generation  |
   +-------+-------+               +----------+-----------+
           |                                  |
           +------------------+---------------+
                              v
                    +----------------------+
                    | Tool Router          |
                    | create_file          |
                    | write_code           |
                    | summarize            |
                    | general_chat         |
                    +----------+-----------+
                               |
                               v
                          output/ (safe zone)
```

Flow summary:
1. Frontend sends audio to POST /agent
2. Backend transcribes audio via Whisper
3. Backend classifies intent via Ollama
4. Backend executes matching tool
5. Backend streams progress + final result using SSE
6. Frontend updates stage indicators and result cards in real time

## Repository Structure

```text
voice-agent/
  backend/main.py
  stt/transcriber.py
  intent/classifier.py
  tools/
    file_ops.py
    code_gen.py
    summarizer.py
    chat.py
  utils/recorder.py
  output/
  frontend/
    src/
  tests/test_pipeline.py
  requirements.txt
  start.sh
```

## System Requirements

- macOS (tested on MacBook Air M1, 8GB RAM)
- Python 3.11+
- Node.js 18+
- Ollama installed locally
- Homebrew (for ffmpeg)

## Hardware Workarounds Used (Apple Silicon M1)

These are the specific workarounds applied to make the project stable on M1 with 8GB RAM:

1. Whisper model size selection
- Used small model instead of medium/large to reduce memory and startup cost.

2. MPS acceleration fallback strategy
- In [stt/transcriber.py](stt/transcriber.py), device is selected as mps when available, else cpu.

3. Mixed precision compatibility
- Whisper transcription is called with fp16=False to avoid MPS/CPU precision issues.

4. First-run model download behavior
- Whisper downloads model once to cache directory:
  - /Users/thilak/.cache/whisper/small.pt

5. Local LLM size choice for RAM constraints
- Used Ollama model llama3.2:3b for reliable local inference on 8GB RAM.

6. Service orchestration
- start.sh checks if Ollama is already running before attempting ollama serve, preventing duplicate service conflicts.

## Installation

1. Clone/open this project and move to root:

```bash
cd "/Users/thilak/PythonFiles/MemO AI/voice-agent"
```

2. Install ffmpeg:

```bash
brew install ffmpeg
```

3. Create and activate virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

4. Install Python dependencies:

```bash
pip install -r requirements.txt
```

5. Install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

6. Pull Ollama model:

```bash
ollama pull llama3.2:3b
```

## Running the Project

### Recommended (single command)

```bash
./start.sh
```

This launches:
- Ollama service (if not already running)
- FastAPI backend on port 8000
- Vite frontend on port 5173

### Manual (three terminals)

Terminal 1:

```bash
ollama serve
```

Terminal 2:

```bash
cd "/Users/thilak/PythonFiles/MemO AI/voice-agent"
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000
```

Terminal 3:

```bash
cd "/Users/thilak/PythonFiles/MemO AI/voice-agent/frontend"
npm run dev
```

Frontend URL:
- http://localhost:5173

Backend URL:
- http://localhost:8000

## API Endpoints

- POST /transcribe
  - Input: multipart audio file
  - Output: transcription text

- POST /process
  - Input: {"transcription": "..."}
  - Output: intent, filename, action_taken, output, success

- POST /agent
  - Input: multipart audio file
  - Output: SSE stream with stages:
    - transcribing
    - classifying
    - executing
    - done

- GET /history
  - Output: last 10 actions from in-memory session history

- GET /health
  - Output: service status, Ollama reachability, model availability

## Testing

Run local pipeline test script:

```bash
python tests/test_pipeline.py
```

It validates:
- Transcriber using generated sample wav
- Classifier behavior across four sample intents
- Direct tool execution for all tool modules

Note:
- On first run, Whisper model download can take time.

## Troubleshooting

1. ollama serve returns error or exits
- Usually means Ollama is already running. Verify using:
  - curl http://localhost:11434/api/tags

2. Whisper errors during transcription
- Confirm ffmpeg is installed and available in PATH.

3. Frontend cannot connect to backend
- Confirm backend is running on port 8000.
- Confirm frontend is running on port 5173.

4. Slow first request
- Expected when downloading/loading Whisper model initially.

## Demo Video

- Submission demo link: <DEMO_VIDEO_LINK>

## Author Notes

This implementation prioritizes local execution, beginner-friendly structure, and safe file operations for internship evaluation.
