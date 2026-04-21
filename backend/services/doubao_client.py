import base64
from typing import List, Optional, Union

import httpx

from config import Settings


class DoubaoClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = settings.doubao_base_url.rstrip("/")
        self.api_key = settings.doubao_api_key.get_secret_value() if settings.doubao_api_key else ""
        self.model = settings.doubao_seedream_model

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _generation_url(self) -> str:
        if self.base_url.endswith("/v1"):
            return f"{self.base_url}/images/generations"
        return f"{self.base_url}/v1/images/generations"

    async def generate_image(
        self,
        prompt: str,
        image: Optional[Union[str, List[str]]] = None,
        size: str = "2K",
        output_format: str = "png",
        response_format: str = "b64_json",
        watermark: bool = False,
    ) -> str:
        if not self.api_key:
            raise ValueError("DOUBAO_API_KEY 未配置")

        payload: dict = {
            "model": self.model,
            "prompt": prompt,
            "size": size,
            "output_format": output_format,
            "response_format": response_format,
            "watermark": watermark,
            "sequential_image_generation": "disabled",
        }

        if image:
            payload["image"] = image

        url = self._generation_url()

        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(url, headers=self._headers(), json=payload)
            response.raise_for_status()
            result = response.json()

        data = result.get("data", [])
        if not data:
            raise ValueError(f"API响应中未找到图像数据。响应结构: {result}")

        first_item = data[0]
        if response_format == "b64_json":
            image_data = first_item.get("b64_json", "")
            if image_data:
                return image_data
            raise ValueError(f"API响应中未找到 Base64 图像数据。响应结构: {result}")

        image_url = first_item.get("url", "")
        if not image_url:
            raise ValueError(f"API响应中未找到图像链接。响应结构: {result}")

        async with httpx.AsyncClient(timeout=180.0) as client:
            image_response = await client.get(image_url)
            image_response.raise_for_status()

        return base64.b64encode(image_response.content).decode("utf-8")
