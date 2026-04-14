"""Tool handlers for safe file and folder creation inside the output directory."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path


OUTPUT_DIR = Path(__file__).resolve().parents[1] / "output"


def _is_within_output(path: Path) -> bool:
	"""Return True when the resolved path is inside the output sandbox."""
	try:
		path.resolve().relative_to(OUTPUT_DIR.resolve())
		return True
	except ValueError:
		return False


def _append_timestamp(path: Path) -> Path:
	"""Append a timestamp when the path already exists."""
	if not path.exists():
		return path

	timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
	if path.suffix:
		return path.with_name(f"{path.stem}_{timestamp}{path.suffix}")
	return path.with_name(f"{path.name}_{timestamp}")


def create_file(filename: str, content: str = "") -> dict[str, str | bool]:
	"""Create a file or folder under output/ only.

	Folder mode is enabled when filename ends with '/' or '\\'.
	"""
	cleaned_name = filename.strip()
	if not cleaned_name:
		return {"success": False, "path": "", "message": "Filename cannot be empty."}

	OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

	# Keep the user-provided relative shape but reject absolute/traversal paths.
	requested_path = OUTPUT_DIR / cleaned_name
	target_path = requested_path.resolve()
	is_folder = cleaned_name.endswith("/") or cleaned_name.endswith("\\")

	if not _is_within_output(target_path):
		return {
			"success": False,
			"path": "",
			"message": "Refused to create path outside output directory.",
		}

	final_path = _append_timestamp(target_path)

	try:
		if is_folder:
			final_path.mkdir(parents=True, exist_ok=False)
			return {
				"success": True,
				"path": str(final_path),
				"message": "Folder created successfully.",
			}

		final_path.parent.mkdir(parents=True, exist_ok=True)
		final_path.write_text(content, encoding="utf-8")
		message = "File created successfully."
		if final_path != target_path:
			message = "File existed, created new file with timestamp."

		return {
			"success": True,
			"path": str(final_path),
			"message": message,
		}
	except Exception as exc:  # noqa: BLE001
		return {
			"success": False,
			"path": "",
			"message": f"Failed to create file/folder: {exc}",
		}
