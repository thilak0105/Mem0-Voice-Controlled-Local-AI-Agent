"""Tool handler for web search using DuckDuckGo."""

from __future__ import annotations

import re

from ddgs import DDGS


def _normalize_query(query: str) -> str:
	"""Normalize common speech-to-text spacing issues in search queries."""
	text = query.strip()
	replacements = (
		(r"\bfast\s+api\b", "FastAPI"),
		(r"\bduck\s+duck\s+go\b", "DuckDuckGo"),
		(r"\bduck\s+duckgo\b", "DuckDuckGo"),
		(r"\bduckduck\s+go\b", "DuckDuckGo"),
		(r"\basync\s+io\b", "asyncio"),
		(r"\bsub\s+process\b", "subprocess"),
	)

	for pattern, replacement in replacements:
		text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

	text = re.sub(r"\s+", " ", text)
	return text.strip()


def _candidate_queries(query: str) -> list[str]:
	"""Generate fallback search queries for noisy voice transcription."""
	base_query = query.strip()
	normalized_query = _normalize_query(base_query)
	candidates: list[str] = []
	seen: set[str] = set()

	def add(candidate: str) -> None:
		candidate_text = candidate.strip()
		if candidate_text and candidate_text not in seen:
			seen.add(candidate_text)
			candidates.append(candidate_text)

	add(base_query)
	add(normalized_query)

	lower_query = normalized_query.lower()
	if "docs" in lower_query:
		add(normalized_query.replace("docs", "documentation"))
		add(f"{normalized_query} documentation")

	if "duckduckgo" in lower_query and "python package" in lower_query:
		add("duckduckgo-search python package")
		add("duckduckgo search python package")

	if "fastapi" in lower_query and "docs" in lower_query:
		add("FastAPI documentation")

	return candidates


def search_web(query: str) -> dict[str, bool | str | list[dict[str, str]]]:
	"""Search the web using DuckDuckGo and return top 3 results.

	Returns {success, query, used_query, results: [{title, url, snippet}]}
	"""
	cleaned_query = query.strip()
	if not cleaned_query:
		return {
			"success": False,
			"query": "",
			"used_query": "",
			"results": [],
			"message": "Search query cannot be empty.",
		}

	last_error: str | None = None
	for candidate_query in _candidate_queries(cleaned_query):
		try:
			with DDGS() as ddgs:
				results_raw = list(ddgs.text(candidate_query, max_results=3))

			results: list[dict[str, str]] = []
			for item in results_raw:
				results.append(
					{
						"title": str(item.get("title", "")),
						"url": str(item.get("href", "")),
						"snippet": str(item.get("body", ""))[:200],
					}
				)

			if results:
				return {
					"success": True,
					"query": cleaned_query,
					"used_query": candidate_query,
					"results": results,
				}
		except Exception as exc:  # noqa: BLE001
			last_error = str(exc)
			continue

		# No results for this candidate; try the next fallback query.

	message = f"No search results found for: {cleaned_query}. Try a shorter query or correct the spelling."
	if last_error:
		message = f"Web search failed: {last_error}"

	return {
		"success": False,
		"query": cleaned_query,
		"used_query": _normalize_query(cleaned_query),
		"results": [],
		"message": message,
	}
