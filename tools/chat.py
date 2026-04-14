"""Tool handler for general conversational fallback responses via local LLM."""

from __future__ import annotations

import requests


OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"


def general_chat(message: str) -> dict[str, bool | str]:
	"""Generate a conversational response for general chat requests."""
	cleaned_message = message.strip()
	if not cleaned_message:
		return {
			"success": False,
			"response": "Please provide a message to chat about.",
		}

	payload = {
		"model": OLLAMA_MODEL,
		"prompt": cleaned_message,
		"stream": False,
		"options": {"temperature": 0.7},
	}

	try:
		response = requests.post(OLLAMA_URL, json=payload, timeout=60)
		response.raise_for_status()
		data = response.json()
		text = str(data.get("response", "")).strip()
		if not text:
			return {
				"success": False,
				"response": "Chat failed: model returned an empty response.",
			}
		return {"success": True, "response": text}
	except requests.RequestException as exc:
		return {
			"success": False,
			"response": f"Chat failed: could not reach Ollama ({exc}).",
		}
	except Exception as exc:  # noqa: BLE001
		return {"success": False, "response": f"Chat failed: {exc}"}
