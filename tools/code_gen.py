"""Tool handler for generating and writing code files inside the output directory.

This module generates source code with a local Ollama model and saves it safely
inside the project's output/ directory.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import re
from typing import Optional

import requests


OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"


@dataclass
class CodeGenResult:
	"""Structured result for code generation and save operations."""

	success: bool
	action: str
	output_path: Optional[Path]
	code: str
	error: Optional[str] = None


def _safe_filename(filename: Optional[str]) -> str:
	"""Return a sanitized filename, preserving simple safe characters only."""
	default_name = "generated_code.py"
	if not filename:
		return default_name

	# Keep only the basename to avoid user-provided paths.
	base_name = Path(filename).name.strip()
	if not base_name:
		return default_name

	# Replace unsafe characters with underscores.
	sanitized = re.sub(r"[^A-Za-z0-9._-]", "_", base_name)
	if not sanitized:
		return default_name

	# Ensure the file has a Python extension for generated code.
	if "." not in sanitized:
		sanitized = f"{sanitized}.py"

	return sanitized


def _ensure_within_output(candidate: Path, output_dir: Path) -> bool:
	"""Verify resolved candidate path stays inside output_dir."""
	try:
		candidate.resolve().relative_to(output_dir.resolve())
		return True
	except ValueError:
		return False


def _with_timestamp_if_exists(path: Path) -> Path:
	"""Append timestamp to filename when destination already exists."""
	if not path.exists():
		return path

	timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
	return path.with_name(f"{path.stem}_{timestamp}{path.suffix}")


def _build_prompt(task_description: str) -> str:
	"""Create a prompt that asks the model for clean, executable code."""
	return (
		"You are a senior Python developer.\\n"
		"Generate only code for the requested task.\\n"
		"Do not include markdown fences or explanations.\\n"
		"Return valid, runnable Python code.\\n\\n"
		f"Task: {task_description}"
	)


def _generate_code_with_ollama(task_description: str) -> str:
	"""Call Ollama to generate code text from a natural language description."""
	payload = {
		"model": OLLAMA_MODEL,
		"prompt": _build_prompt(task_description),
		"stream": False,
		"options": {"temperature": 0.2},
	}
	response = requests.post(OLLAMA_URL, json=payload, timeout=90)
	response.raise_for_status()
	response_json = response.json()
	return str(response_json.get("response", "")).strip()


def generate_and_save_code(
	task_description: str,
	filename: Optional[str],
	output_dir: Path,
) -> CodeGenResult:
	"""Generate code for a task and save it to a safe file under output_dir."""
	cleaned_task = task_description.strip()
	if not cleaned_task:
		return CodeGenResult(
			success=False,
			action="No action taken",
			output_path=None,
			code="",
			error="Code generation request is empty.",
		)

	output_dir.mkdir(parents=True, exist_ok=True)

	safe_name = _safe_filename(filename)
	target_path = output_dir / safe_name

	# Enforce output sandbox rules.
	if not _ensure_within_output(target_path, output_dir):
		return CodeGenResult(
			success=False,
			action="Blocked unsafe path",
			output_path=None,
			code="",
			error="Refused to write outside output directory.",
		)

	final_path = _with_timestamp_if_exists(target_path)

	try:
		generated_code = _generate_code_with_ollama(cleaned_task)
	except requests.RequestException as exc:
		return CodeGenResult(
			success=False,
			action="Code generation failed",
			output_path=None,
			code="",
			error=f"Could not reach Ollama service: {exc}",
		)
	except Exception as exc:  # noqa: BLE001
		return CodeGenResult(
			success=False,
			action="Code generation failed",
			output_path=None,
			code="",
			error=f"Unexpected error during code generation: {exc}",
		)

	if not generated_code:
		return CodeGenResult(
			success=False,
			action="No code generated",
			output_path=None,
			code="",
			error="Model returned an empty code response.",
		)

	try:
		final_path.write_text(generated_code, encoding="utf-8")
	except Exception as exc:  # noqa: BLE001
		return CodeGenResult(
			success=False,
			action="Write failed",
			output_path=None,
			code=generated_code,
			error=f"Failed to save generated code: {exc}",
		)

	action_message = (
		f"Generated code saved to {final_path.name}"
		if final_path == target_path
		else f"File existed, saved with timestamp as {final_path.name}"
	)
	return CodeGenResult(
		success=True,
		action=action_message,
		output_path=final_path,
		code=generated_code,
		error=None,
	)
