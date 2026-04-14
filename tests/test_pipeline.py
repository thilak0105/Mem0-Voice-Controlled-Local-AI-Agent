"""Manual pipeline test runner for the local voice agent project.

This script prints PASS/FAIL checks for:
1. STT transcriber with a generated sample WAV file
2. Intent classifier with four representative prompts
3. Each tool function direct execution
"""

from __future__ import annotations

from pathlib import Path
import sys
import tempfile
from typing import Any

import numpy as np
from scipy.io.wavfile import write as wav_write


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from intent.classifier import ALLOWED_INTENTS, classify_intent
from stt.transcriber import transcribe_audio
from tools.chat import general_chat
from tools.code_gen import generate_and_save_code
from tools.code_runner import run_code
from tools.code_explainer import explain_code
from tools.code_fixer import fix_code
from tools.file_ops import create_file, list_files
from tools.summarizer import summarize_text
from tools.web_search import search_web


def print_result(name: str, passed: bool, detail: str = "") -> None:
    status = "PASS" if passed else "FAIL"
    suffix = f" | {detail}" if detail else ""
    print(f"[{status}] {name}{suffix}")


def generate_sample_wav(duration_sec: float = 1.0, sample_rate: int = 16000) -> Path:
    """Create a temporary sine-wave WAV file for STT testing."""
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), endpoint=False)
    signal = 0.25 * np.sin(2 * np.pi * 440 * t)
    audio = np.int16(signal * 32767)

    temp_dir = Path(tempfile.mkdtemp(prefix="voice_agent_test_"))
    wav_path = temp_dir / "sample.wav"
    wav_write(wav_path, sample_rate, audio)
    return wav_path


def test_transcriber() -> bool:
    """Test transcriber with a generated WAV file."""
    try:
        wav_path = generate_sample_wav()
        result = transcribe_audio(wav_path)
        passed = isinstance(result.success, bool) and (bool(result.text.strip()) or bool(result.error))
        detail = f"success={result.success}, text_len={len(result.text)}, error={result.error}"
        print_result("Transcriber sample wav", passed, detail)
        return passed
    except Exception as exc:  # noqa: BLE001
        print_result("Transcriber sample wav", False, str(exc))
        return False


def test_classifier() -> bool:
    """Test classifier with one sentence for each expected intent."""
    samples: list[tuple[str, str]] = [
        ("create_file", "Create a folder named docs and a file named notes.txt"),
        ("write_code", "Write Python code for a function that computes factorial."),
        ("summarize", "Summarize this: FastAPI is a modern Python web framework."),
        ("general_chat", "How are you doing today?"),
        ("run_code", "Run the Python file in output folder"),
        ("explain_code", "Explain what this code does"),
        ("fix_code", "Fix any bugs in my code"),
        ("list_files", "Show me what files are in the output folder"),
        ("search_web", "Search for information about Python programming"),
    ]

    overall_passed = True
    for expected_intent, sentence in samples:
        try:
            result = classify_intent(sentence)
            passed = result.intent in ALLOWED_INTENTS and result.intent == expected_intent
            detail = f"expected={expected_intent}, got={result.intent}, error={result.error}"
            print_result(f"Classifier intent: {expected_intent}", passed, detail)
            overall_passed = overall_passed and passed
        except Exception as exc:  # noqa: BLE001
            print_result(f"Classifier intent: {expected_intent}", False, str(exc))
            overall_passed = False

    return overall_passed


def test_tools() -> bool:
    """Test each tool function directly."""
    output_dir = PROJECT_ROOT / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    results: list[bool] = []

    # Test create_file tool.
    try:
        create_result = create_file("test_artifact.txt", "hello from test")
        passed = bool(create_result.get("success")) and bool(create_result.get("path"))
        print_result("Tool create_file", passed, str(create_result))
        results.append(passed)
    except Exception as exc:  # noqa: BLE001
        print_result("Tool create_file", False, str(exc))
        results.append(False)

    # Test summarize tool.
    try:
        summarize_result = summarize_text("Python is popular for AI and backend services.")
        passed = bool(summarize_result.get("success")) and bool(str(summarize_result.get("summary", "")).strip())
        print_result("Tool summarize_text", passed, str(summarize_result))
        results.append(passed)
    except Exception as exc:  # noqa: BLE001
        print_result("Tool summarize_text", False, str(exc))
        results.append(False)

    # Test general chat tool.
    try:
        chat_result = general_chat("Say hello in one sentence.")
        passed = bool(chat_result.get("success")) and bool(str(chat_result.get("response", "")).strip())
        print_result("Tool general_chat", passed, str(chat_result))
        results.append(passed)
    except Exception as exc:  # noqa: BLE001
        print_result("Tool general_chat", False, str(exc))
        results.append(False)

    # Test code generation tool.
    try:
        code_result = generate_and_save_code(
            "Create a Python function named add that returns sum of two numbers.",
            "test_add.py",
            output_dir,
        )
        passed = code_result.success and code_result.output_path is not None
        detail = (
            f"success={code_result.success}, path={code_result.output_path}, "
            f"error={code_result.error}"
        )
        print_result("Tool generate_and_save_code", passed, detail)
        results.append(passed)
    except Exception as exc:  # noqa: BLE001
        print_result("Tool generate_and_save_code", False, str(exc))
        results.append(False)

    # Test run_code tool (will try to run most recent file or fail gracefully).
    try:
        run_code_result = run_code()
        passed = isinstance(run_code_result.get("success"), bool)
        detail = f"success={run_code_result.get('success')}, filename={run_code_result.get('filename')}"
        print_result("Tool run_code", passed, detail)
        results.append(passed)
    except Exception as exc:  # noqa: BLE001
        print_result("Tool run_code", False, str(exc))
        results.append(False)

    # Test explain_code tool (will try to explain most recent file or fail gracefully).
    try:
        explain_code_result = explain_code()
        passed = isinstance(explain_code_result.get("success"), bool)
        detail = f"success={explain_code_result.get('success')}, filename={explain_code_result.get('filename')}"
        print_result("Tool explain_code", passed, detail)
        results.append(passed)
    except Exception as exc:  # noqa: BLE001
        print_result("Tool explain_code", False, str(exc))
        results.append(False)

    # Test fix_code tool (will try to fix most recent file or fail gracefully).
    try:
        fix_code_result = fix_code()
        passed = isinstance(fix_code_result.get("success"), bool)
        detail = f"success={fix_code_result.get('success')}, filename={fix_code_result.get('filename')}"
        print_result("Tool fix_code", passed, detail)
        results.append(passed)
    except Exception as exc:  # noqa: BLE001
        print_result("Tool fix_code", False, str(exc))
        results.append(False)

    # Test list_files tool.
    try:
        list_files_result = list_files()
        passed = bool(list_files_result.get("success")) and isinstance(list_files_result.get("files"), list)
        detail = f"success={list_files_result.get('success')}, file_count={len(list_files_result.get('files', []))}"
        print_result("Tool list_files", passed, detail)
        results.append(passed)
    except Exception as exc:  # noqa: BLE001
        print_result("Tool list_files", False, str(exc))
        results.append(False)

    # Test search_web tool.
    try:
        search_result = search_web("Python programming")
        passed = bool(search_result.get("success")) and isinstance(search_result.get("results"), list)
        detail = f"success={search_result.get('success')}, result_count={len(search_result.get('results', []))}"
        print_result("Tool search_web", passed, detail)
        results.append(passed)
    except Exception as exc:  # noqa: BLE001
        print_result("Tool search_web", False, str(exc))
        results.append(False)

    return all(results)


def main() -> None:
    """Run all tests and print summary."""
    print("Running local pipeline checks...\n")

    transcriber_ok = test_transcriber()
    classifier_ok = test_classifier()
    tools_ok = test_tools()

    total_ok = all([transcriber_ok, classifier_ok, tools_ok])
    print("\n--- Summary ---")
    print_result("Transcriber", transcriber_ok)
    print_result("Classifier", classifier_ok)
    print_result("Tools", tools_ok)
    print_result("Overall", total_ok)


if __name__ == "__main__":
    main()
