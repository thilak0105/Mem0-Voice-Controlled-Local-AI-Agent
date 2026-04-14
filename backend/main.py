"""FastAPI backend for the local voice-controlled AI agent.

Routes:
- POST /transcribe: audio file -> text
- POST /process: text -> classify -> execute tool
- POST /agent: full pipeline with SSE progress events
- GET /history: last 10 actions from in-memory session history
- GET /health: Ollama status and model presence
"""

from __future__ import annotations

from datetime import datetime
import json
from pathlib import Path
import tempfile
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import requests

from intent.classifier import classify_intent
from stt.transcriber import transcribe_audio
from tools.chat import general_chat
from tools.code_gen import generate_and_save_code
from tools.file_ops import create_file
from tools.summarizer import summarize_text


OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2:3b"
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "output"


app = FastAPI(title="Voice Agent Backend", version="1.0.0")

# Allow Vite frontend during local development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple in-memory session history storage.
app.state.history: list[dict[str, Any]] = []


class ProcessRequest(BaseModel):
    """Input schema for transcription processing."""

    transcription: str


def _record_history(entry: dict[str, Any]) -> None:
    """Append action to app history and keep only recent items."""
    app.state.history.append(entry)
    # Keep history bounded while preserving enough recent context.
    if len(app.state.history) > 100:
        app.state.history = app.state.history[-100:]


def _execute_intent(intent: str, filename: str | None, content: str) -> dict[str, Any]:
    """Route an intent to the appropriate tool and normalize result fields."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if intent == "create_file":
        target_name = filename or "new_file.txt"
        tool_result = create_file(target_name, content)
        return {
            "intent": intent,
            "filename": target_name,
            "action_taken": tool_result.get("message", "create_file executed"),
            "output": str(tool_result.get("path", "")),
            "success": bool(tool_result.get("success", False)),
        }

    if intent == "write_code":
        tool_result = generate_and_save_code(content, filename, OUTPUT_DIR)
        return {
            "intent": intent,
            "filename": (tool_result.output_path.name if tool_result.output_path else filename),
            "action_taken": tool_result.action,
            "output": tool_result.code if tool_result.success else (tool_result.error or "Code generation failed."),
            "success": tool_result.success,
        }

    if intent == "summarize":
        tool_result = summarize_text(content)
        return {
            "intent": intent,
            "filename": None,
            "action_taken": "Text summarization executed",
            "output": str(tool_result.get("summary", "")),
            "success": bool(tool_result.get("success", False)),
        }

    # Unknown intent fallback is handled here as general_chat.
    tool_result = general_chat(content)
    return {
        "intent": "general_chat",
        "filename": None,
        "action_taken": "General chat response generated",
        "output": str(tool_result.get("response", "")),
        "success": bool(tool_result.get("success", False)),
    }


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)) -> dict[str, str]:
    """Accept an uploaded audio file and return transcribed text."""
    suffix = Path(file.filename or "upload.wav").suffix or ".wav"
    temp_path: Path | None = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            temp_path = Path(tmp.name)
            file_bytes = await file.read()
            tmp.write(file_bytes)

        transcription_result = await run_in_threadpool(transcribe_audio, temp_path)
        if not transcription_result.success:
            raise HTTPException(status_code=400, detail=transcription_result.error or "Transcription failed.")

        return {"transcription": transcription_result.text}
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to transcribe audio: {exc}") from exc
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink(missing_ok=True)


@app.post("/process")
async def process(request: ProcessRequest) -> dict[str, Any]:
    """Classify transcription and execute mapped tool."""
    transcription = request.transcription.strip()
    if not transcription:
        raise HTTPException(status_code=400, detail="transcription cannot be empty")

    intent_result = await run_in_threadpool(classify_intent, transcription)
    normalized_intent = intent_result.intent if intent_result.intent else "general_chat"

    result = await run_in_threadpool(
        _execute_intent,
        normalized_intent,
        intent_result.filename,
        intent_result.content,
    )

    _record_history(
        {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "transcription": transcription,
            "intent": result["intent"],
            "filename": result["filename"],
            "action_taken": result["action_taken"],
            "success": result["success"],
        }
    )

    return result


@app.post("/agent")
async def agent(file: UploadFile = File(...)) -> StreamingResponse:
    """Run full pipeline and stream stage updates using SSE."""
    suffix = Path(file.filename or "upload.wav").suffix or ".wav"
    temp_path: Path | None = None

    async def event_stream() -> Any:
        nonlocal temp_path
        try:
            # Stage 1: transcribing
            yield 'data: {"stage": "transcribing"}\n\n'

            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                temp_path = Path(tmp.name)
                file_bytes = await file.read()
                tmp.write(file_bytes)

            transcription_result = await run_in_threadpool(transcribe_audio, temp_path)
            if not transcription_result.success:
                done_payload = {
                    "stage": "done",
                    "result": {
                        "intent": "general_chat",
                        "filename": None,
                        "action_taken": "Transcription failed",
                        "output": transcription_result.error or "Transcription failed.",
                        "success": False,
                    },
                }
                yield f"data: {json.dumps(done_payload)}\n\n"
                return

            # Stage 2: classifying
            classify_payload = {
                "stage": "classifying",
                "transcription": transcription_result.text,
            }
            yield f"data: {json.dumps(classify_payload)}\n\n"

            intent_result = await run_in_threadpool(classify_intent, transcription_result.text)
            normalized_intent = intent_result.intent if intent_result.intent else "general_chat"

            # Stage 3: executing
            executing_payload = {
                "stage": "executing",
                "intent": normalized_intent,
            }
            yield f"data: {json.dumps(executing_payload)}\n\n"

            result = await run_in_threadpool(
                _execute_intent,
                normalized_intent,
                intent_result.filename,
                intent_result.content,
            )

            _record_history(
                {
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "transcription": transcription_result.text,
                    "intent": result["intent"],
                    "filename": result["filename"],
                    "action_taken": result["action_taken"],
                    "success": result["success"],
                }
            )

            # Stage 4: done
            done_payload = {"stage": "done", "result": result}
            yield f"data: {json.dumps(done_payload)}\n\n"
        except Exception as exc:  # noqa: BLE001
            error_done_payload = {
                "stage": "done",
                "result": {
                    "intent": "general_chat",
                    "filename": None,
                    "action_taken": "Pipeline failed",
                    "output": f"Unexpected server error: {exc}",
                    "success": False,
                },
            }
            yield f"data: {json.dumps(error_done_payload)}\n\n"
        finally:
            if temp_path and temp_path.exists():
                temp_path.unlink(missing_ok=True)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/history")
async def history() -> list[dict[str, Any]]:
    """Return last 10 recorded actions from session history."""
    return app.state.history[-10:]


@app.get("/health")
async def health() -> dict[str, Any]:
    """Return backend health plus Ollama availability and model status."""
    tags_url = f"{OLLAMA_BASE_URL}/api/tags"
    status_payload: dict[str, Any] = {
        "service": "voice-agent-backend",
        "ollama_url": OLLAMA_BASE_URL,
        "model": OLLAMA_MODEL,
        "ollama_reachable": False,
        "model_available": False,
    }

    try:
        response = await run_in_threadpool(requests.get, tags_url, timeout=10)
        response.raise_for_status()
        data = response.json()
        models = data.get("models", []) if isinstance(data, dict) else []

        available_model_names = {str(model.get("name", "")) for model in models if isinstance(model, dict)}
        status_payload["ollama_reachable"] = True
        status_payload["model_available"] = OLLAMA_MODEL in available_model_names
        status_payload["available_models"] = sorted(available_model_names)
    except Exception as exc:  # noqa: BLE001
        status_payload["error"] = f"Ollama health check failed: {exc}"

    return status_payload


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
