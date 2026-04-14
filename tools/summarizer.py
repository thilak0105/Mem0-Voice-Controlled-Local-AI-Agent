"""Tool handler for summarizing text content locally."""

from __future__ import annotations

import requests


OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"


def summarize_text(text: str) -> dict[str, bool | str]:
	"""Summarize input text using a local Ollama model."""
	cleaned_text = text.strip()
	if not cleaned_text:
		return {
			"success": False,
			"summary": "No text provided to summarize.",
		}

	prompt = (
		"Summarize the following text clearly and concisely. "
		"Keep key points and avoid adding new information.\\n\\n"
		f"Text:\\n{cleaned_text}"
	)

	payload = {
		"model": OLLAMA_MODEL,
		"prompt": prompt,
		"stream": False,
		"options": {"temperature": 0.2},
	}

	try:
		response = requests.post(OLLAMA_URL, json=payload, timeout=60)
		response.raise_for_status()
		data = response.json()
		summary = str(data.get("response", "")).strip()
		if not summary:
			return {
				"success": False,
				"summary": "Summarization failed: model returned an empty response.",
			}
		return {"success": True, "summary": summary}
	except requests.RequestException as exc:
		return {
			"success": False,
			"summary": f"Summarization failed: could not reach Ollama ({exc}).",
		}
	except Exception as exc:  # noqa: BLE001
		return {"success": False, "summary": f"Summarization failed: {exc}"}
