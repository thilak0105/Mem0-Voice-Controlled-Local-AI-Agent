"""Tool handler for safely executing Python files inside the output directory."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Optional


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


def run_code(filename: Optional[str] = None) -> dict[str, str | bool]:
	"""Execute a Python file from the output/ directory.

	If filename is not provided, uses the most recently modified file.
	Returns {success, output, error, filename}
	"""
	OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

	# Resolve which file to run
	if filename:
		target_path = (OUTPUT_DIR / filename).resolve()
		selected_filename = filename
	else:
		most_recent = _get_most_recent_file(OUTPUT_DIR)
		if not most_recent:
			return {
				"success": False,
				"output": "",
				"error": f"No Python files found in output/. Available files: {_list_files_in_output()}",
				"filename": "",
			}
		target_path = most_recent
		selected_filename = most_recent.name

	# Safety check: file must be in output/ directory
	if not _is_within_output(target_path):
		return {
			"success": False,
			"output": "",
			"error": f"Refused to run file outside output directory: {filename}",
			"filename": selected_filename,
		}

	# Check if file exists
	if not target_path.exists():
		return {
			"success": False,
			"output": "",
			"error": f"File '{selected_filename}' was not found in the output/ folder. Please check the filename and try again. Available files: {_list_files_in_output()}",
			"filename": selected_filename,
		}

	try:
		result = subprocess.run(
			["python", str(target_path)],
			capture_output=True,
			text=True,
			timeout=10,
		)

		if result.returncode != 0:
			return {
				"success": False,
				"output": result.stdout,
				"error": result.stderr or "Process exited with non-zero status.",
				"filename": selected_filename,
			}

		return {
			"success": True,
			"output": result.stdout,
			"error": "",
			"filename": selected_filename,
		}
	except subprocess.TimeoutExpired:
		return {
			"success": False,
			"output": "",
			"error": f"Execution timed out after 10 seconds while running {selected_filename}.",
			"filename": selected_filename,
		}
	except Exception as exc:  # noqa: BLE001
		return {
			"success": False,
			"output": "",
			"error": f"Failed to execute {selected_filename}: {exc}",
			"filename": selected_filename,
		}
