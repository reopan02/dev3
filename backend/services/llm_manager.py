import json
from typing import AsyncGenerator, Optional

import httpx

from config import Settings


class LLMManager:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = settings.analyze_openai_base_url  # already has /v1
        self.api_key = settings.gemini_analyze_api_key.get_secret_value() if settings.gemini_analyze_api_key else ""

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _build_messages(self, messages: list[dict]) -> list[dict]:
        result = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                result.append({"role": "system", "content": str(content)})
            elif role == "user":
                if isinstance(content, str):
                    result.append({"role": "user", "content": content})
                elif isinstance(content, list):
                    parts = []
                    for block in content:
                        block_type = block.get("type", "text")
                        if block_type == "text":
                            parts.append({"type": "text", "text": block.get("text", "")})
                        elif block_type == "image_url":
                            parts.append({"type": "image_url", "image_url": block.get("image_url", {})})
                    result.append({"role": "user", "content": parts})
                else:
                    result.append({"role": "user", "content": str(content)})
        return result

    async def stream_chat(self, messages: list[dict], temperature: Optional[float] = None) -> AsyncGenerator[str, None]:
        if not self.api_key:
            raise RuntimeError("GEMINI_ANALYZE_API_KEY 未配置")

        payload = {
            "model": self.settings.llm_model,
            "messages": self._build_messages(messages),
            "temperature": temperature if temperature is not None else self.settings.llm_temperature,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=self.settings.llm_timeout) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                    except (json.JSONDecodeError, IndexError, KeyError):
                        continue
