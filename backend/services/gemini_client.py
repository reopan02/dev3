import base64
import httpx
from typing import Optional
from io import BytesIO
from PIL import Image

from config import Settings


class GeminiClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = settings.gemini_image_base_url.rstrip("/")
        self.api_key = settings.gemini_image_api_key.get_secret_value() if settings.gemini_image_api_key else ""
        self.image_model = settings.image_model

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def generate_image(
        self,
        prompt: str,
        reference_image_base64: Optional[str] = None,
        aspect_ratio: str = "1:1",
        image_size: str = "1K",
        model: Optional[str] = None,
    ) -> str:
        if not self.api_key:
            raise ValueError("GEMINI_IMAGE_API_KEY 未配置")

        effective_model = model or self.image_model
        is_text_to_image = not reference_image_base64 or reference_image_base64.strip() == ""

        if is_text_to_image:
            parts = [{"text": prompt}]
        else:
            img_data = reference_image_base64
            if "," in img_data:
                img_data = img_data.split(",")[1]
            parts = [
                {"inlineData": {"mimeType": "image/jpeg", "data": img_data}},
                {"text": prompt},
            ]

        image_config: dict = {}
        if aspect_ratio and aspect_ratio != "auto":
            image_config["aspectRatio"] = aspect_ratio
        if image_size:
            image_config["imageSize"] = image_size

        payload: dict = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseModalities": ["IMAGE"],
                **({"imageConfig": image_config} if image_config else {}),
            },
        }

        url = f"{self.base_url}/v1beta/models/{effective_model}:generateContent"

        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(url, headers=self._headers(), json=payload)
            response.raise_for_status()
            result = response.json()

        candidates = result.get("candidates", [])
        if not candidates:
            raise ValueError(f"API响应中未找到候选结果。响应结构: {result}")

        for part in candidates[0].get("content", {}).get("parts", []):
            if "inlineData" in part:
                data = part["inlineData"].get("data", "")
                if data:
                    return data
            if "inline_data" in part:
                data = part["inline_data"].get("data", "")
                if data:
                    return data

        raise ValueError(f"API响应中未找到生成的图片。响应结构: {result}")

    def validate_image_base64(self, image_base64: str) -> tuple[bool, str]:
        if not image_base64:
            return False, "图片数据为空"
        try:
            clean_base64 = image_base64
            if "," in image_base64:
                clean_base64 = image_base64.split(",")[1]
            if not clean_base64 or clean_base64.strip() == "":
                return False, "图片数据为空"
            try:
                image_data = base64.b64decode(clean_base64)
            except Exception:
                return False, "无效的Base64编码"
            if len(image_data) > 5 * 1024 * 1024:
                return False, f"图片过大（{len(image_data) / 1024 / 1024:.1f}MB），最大支持5MB"
            try:
                image = Image.open(BytesIO(image_data))
                image.verify()
            except Exception:
                return False, "无效的图片格式，请上传 JPEG、PNG、GIF 或 WebP 格式"
            return True, ""
        except Exception as e:
            return False, f"图片验证失败: {str(e)}"

    def is_valid_image(self, image_base64: str) -> bool:
        is_valid, _ = self.validate_image_base64(image_base64)
        return is_valid
