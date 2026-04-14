"""Tool handler for fixing code using Ollama."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import requests


OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "output"


def _get_most_recent_file(directory: Path) -> Optional[Path]:
	"""Return the most recently modified Python file in the directory."""
	if not directory.exists():
		return None

	py_files = sorted(directory.glob("*.py"), key=lambda p: p.stat().st_mtime, reverse=True)
	return py_files[0] if py_files else None


def _is_within_output(path: Path) -> bool:
	"""Return True when the resolved path is inside the output sandbox."""
	try:
		path.resolve().relative_to(OUTPUT_DIR.resolve())
		return True
	except ValueError:
		return False


def _list_files_in_output() -> str:
	"""Return a comma-separated list of files in output/."""
	if not OUTPUT_DIR.exists():
		return "No files found."

	files = sorted([f.name for f in OUTPUT_DIR.glob("*.py")])
	return ", ".join(files) if files else "No Python files found."


def fix_code(filename: Optional[str] = None) -> dict[str, str | bool]:
	"""Fix bugs in a Python file using Ollama.

	If filename is not provided, uses the most recently modified file.
	Overwrites the file with fixed code.
	Returns {success, original_code, fixed_code, filename}
	"""
	OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

	# Resolve which file to fix
	if filename:
		target_path = (OUTPUT_DIR / filename).resolve()
		selected_filename = filename
	else:
		most_recent = _get_most_recent_file(OUTPUT_DIR)
		if not most_recent:
			return {
				"success": False,
				"original_code": "",
				"fixed_code": "",
				"filename": "",
				"message": f"No Python files found in output/. Available files: {_list_files_in_output()}",
			}
		target_path = most_recent
		selected_filename = most_recent.name

	# Safety check: file must be in output/ directory
	if not _is_within_output(target_path):
		return {
			"success": False,
			"original_code": "",
			"fixed_code": "",
			"filename": selected_filename,
			"message": f"Refused to fix file outside output directory: {filename}",
		}

	# Check if file exists
	if not target_path.exists():
		return {
			"success": False,
			"original_code": "",
			"fixed_code": "",
			"filename": selected_filename,
			"message": f"File '{selected_filename}' was not found in the output/ folder. Please check the filename and try again. Available files: {_list_files_in_output()}",
		}

	try:
		original_code = target_path.read_text(encoding="utf-8")
		if not original_code.strip():
			return {
				"success": False,
				"original_code": "",
				"fixed_code": "",
				"filename": selected_filename,
				"message": f"File '{selected_filename}' is empty.",
			}

		prompt = f"Fix any bugs in this code and return only the corrected code with no explanation:\n\n{original_code}"

		payload = {
			"model": OLLAMA_MODEL,
			"prompt": prompt,
			"stream": False,
		}

		response = requests.post(OLLAMA_URL, json=payload, timeout=60)
		response.raise_for_status()
		response_data = response.json()
		fixed_code = str(response_data.get("response", "")).strip()

		if not fixed_code:
			return {
				"success": False,
				"original_code": original_code,
				"fixed_code": "",
				"filename": selected_filename,
				"message": "Model returned empty fixed code.",
			}

		# Save fixed code back to file
		target_path.write_text(fixed_code, encoding="utf-8")

		return {
			"success": True,
			"original_code": original_code,
			"fixed_code": fixed_code,
			"filename": selected_filename,
		}
	except requests.RequestException as exc:
		return {
			"success": False,
			"original_code": "",
			"fixed_code": "",
			"filename": selected_filename,
			"message": f"Failed to call Ollama: {exc}",
		}
	except Exception as exc:  # noqa: BLE001
		return {
			"success": False,
			"original_code": "",
			"fixed_code": "",
			"filename": selected_filename,
			"message": f"Failed to fix code in {selected_filename}: {exc}",
		}
