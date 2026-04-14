"""Intent classification module using Ollama to produce structured JSON actions.

The classifier maps user text into one of these intents:
- create_file
- write_code
- summarize
- general_chat

It always returns a normalized structured result and falls back safely to
general_chat when parsing fails or the model returns an unknown intent.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Any, Optional

import requests


OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"
ALLOWED_INTENTS = {"create_file", "write_code", "summarize", "general_chat"}


@dataclass
class IntentResult:
	"""Structured intent output used by the app pipeline."""

	intent: str
	filename: Optional[str]
	content: str
	raw_model_output: str = ""
	error: Optional[str] = None


class IntentClassifier:
	"""Classifies transcribed text into a tool-ready intent payload."""

	def __init__(self, model: str = OLLAMA_MODEL, endpoint: str = OLLAMA_URL) -> None:
		self.model = model
		self.endpoint = endpoint

	def _build_prompt(self, text: str) -> str:
		"""Create a strict instruction prompt for JSON-only model output."""
		return (
			"You are an intent classifier for a local voice AI agent.\\n"
			"Return ONLY one valid JSON object and nothing else.\\n"
			"Do not include markdown, code fences, or extra text.\\n"
			"Use exactly this schema:\\n"
			"{\\n"
			'  "intent": "create_file" | "write_code" | "summarize" | "general_chat",\\n'
			'  "filename": "<name if applicable, else null>",\\n'
			'  "content": "<description or text to process>"\\n'
			"}\\n"
			"Rules:\\n"
			"- If user asks to create file/folder, use create_file and infer filename when possible.\\n"
			"- If user asks to generate/modify code, use write_code and filename if provided.\\n"
			"- If user asks to summarize text, use summarize and put source text in content.\\n"
			"- Otherwise use general_chat.\\n"
			"- filename must be null when not applicable.\\n"
			"- content must never be empty; copy the user request if needed.\\n\\n"
			f"User text: {text}"
		)

	def _normalize_result(self, payload: dict[str, Any], fallback_content: str) -> IntentResult:
		"""Normalize raw model JSON into safe, app-consistent fields."""
		raw_intent = str(payload.get("intent", "general_chat")).strip()
		intent = raw_intent if raw_intent in ALLOWED_INTENTS else "general_chat"

		# Accept missing/empty filename as None to simplify downstream handling.
		raw_filename = payload.get("filename")
		filename: Optional[str]
		if raw_filename is None:
			filename = None
		else:
			cleaned = str(raw_filename).strip()
			filename = cleaned if cleaned and cleaned.lower() != "null" else None

		# Ensure content always has something usable.
		raw_content = payload.get("content")
		content = str(raw_content).strip() if raw_content is not None else ""
		if not content:
			content = fallback_content

		return IntentResult(intent=intent, filename=filename, content=content)

	def classify(self, text: str) -> IntentResult:
		"""Classify input text into a structured intent JSON-equivalent object."""
		cleaned_text = text.strip()
		if not cleaned_text:
			return IntentResult(
				intent="general_chat",
				filename=None,
				content="",
				error="No text was provided for intent classification.",
			)

		payload = {
			"model": self.model,
			"prompt": self._build_prompt(cleaned_text),
			"stream": False,
			# Ask Ollama to enforce JSON response structure.
			"format": "json",
			"options": {"temperature": 0},
		}

		try:
			response = requests.post(self.endpoint, json=payload, timeout=60)
			response.raise_for_status()
			response_data = response.json()
			model_text = str(response_data.get("response", "")).strip()

			if not model_text:
				return IntentResult(
					intent="general_chat",
					filename=None,
					content=cleaned_text,
					raw_model_output="",
					error="Model returned an empty response; defaulted to general_chat.",
				)

			decoded = json.loads(model_text)
			result = self._normalize_result(decoded, fallback_content=cleaned_text)
			result.raw_model_output = model_text

			if result.intent == "general_chat" and decoded.get("intent") not in ALLOWED_INTENTS:
				result.error = "Unknown intent from model; defaulted to general_chat."

			return result
		except (requests.RequestException, json.JSONDecodeError) as exc:
			return IntentResult(
				intent="general_chat",
				filename=None,
				content=cleaned_text,
				raw_model_output="",
				error=f"Intent classification failed; defaulted to general_chat. Details: {exc}",
			)


def classify_intent(text: str) -> IntentResult:
	"""Convenience helper for one-shot intent classification."""
	classifier = IntentClassifier()
	return classifier.classify(text)
