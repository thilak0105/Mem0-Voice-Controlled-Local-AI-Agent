"""Speech-to-text module using Whisper to transcribe audio into text.

This module provides a reusable transcriber class and helper functions for:
1. Loading the Whisper model (default: small)
2. Selecting Apple Metal (MPS) when available on macOS
3. Converting audio files into cleaned text output
4. Returning friendly errors for unintelligible or invalid audio
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Union

import torch
import whisper


PathLike = Union[str, Path]


@dataclass
class TranscriptionResult:
	"""Structured output from a transcription request."""

	success: bool
	text: str
	error: Optional[str] = None


class WhisperTranscriber:
	"""Handles loading and running Whisper transcription locally."""

	def __init__(self, model_size: str = "small") -> None:
		self.model_size = model_size
		# Prefer Apple Metal (MPS) on M1/M2 Macs, otherwise use CPU.
		self.device = "mps" if torch.backends.mps.is_available() else "cpu"
		self._model: Optional[whisper.Whisper] = None

	def _get_model(self) -> whisper.Whisper:
		"""Lazily load and cache the Whisper model for reuse."""
		if self._model is None:
			self._model = whisper.load_model(self.model_size, device=self.device)
		return self._model

	def transcribe(self, audio_path: PathLike) -> TranscriptionResult:
		"""Transcribe an audio file and return a structured result.

		Args:
			audio_path: Path to a supported audio file.

		Returns:
			TranscriptionResult containing text or a friendly error message.
		"""
		path = Path(audio_path)

		# Validate file existence early to provide actionable feedback.
		if not path.exists() or not path.is_file():
			return TranscriptionResult(
				success=False,
				text="",
				error=f"Audio file not found: {path}",
			)

		try:
			model = self._get_model()
			# fp16 is disabled for MPS/CPU for broad compatibility.
			raw_result = model.transcribe(str(path), fp16=False)
		except Exception:  # noqa: BLE001
			return TranscriptionResult(
				success=False,
				text="",
				error=(
					"I could not process that audio. Please try a clearer recording "
					"or upload a different file."
				),
			)

		transcript = str(raw_result.get("text", "")).strip()

		# Treat empty transcription as unintelligible input.
		if not transcript:
			return TranscriptionResult(
				success=False,
				text="",
				error=(
					"I could not clearly understand the audio. "
					"Please speak louder, reduce background noise, and try again."
				),
			)

		return TranscriptionResult(success=True, text=transcript, error=None)


def transcribe_audio(audio_path: PathLike, model_size: str = "small") -> TranscriptionResult:
	"""Convenience wrapper to transcribe a file without manual class handling."""
	transcriber = WhisperTranscriber(model_size=model_size)
	return transcriber.transcribe(audio_path)
