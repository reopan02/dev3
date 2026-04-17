import base64 as b64mod
import logging
import re
import uuid
from typing import Optional, Tuple

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import get_settings
from services.gemini_client import GeminiClient

router = APIRouter(prefix="/api/watermark", tags=["watermark"])
logger = logging.getLogger("watermark")

_settings = get_settings()

try:
    _gemini_client = GeminiClient(_settings)
except Exception as e:
    logger.warning(f"GeminiClient not initialized: {e}")
    _gemini_client = None


class TaskRequest(BaseModel):
    image_base64: str
    source_task_id: Optional[str] = None
    aspect_ratio: Optional[str] = None
    quality: Optional[str] = None
    prompt: Optional[str] = None


class TaskResponse(BaseModel):
    task_id: str
    result_image_base64: str
    message: str


ASPECT_RATIOS = ["auto", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]
QUALITY_LEVELS = ["512px", "1K", "2K", "4K"]


def parse_base64_image(raw: str) -> Tuple[str, str]:
    match = re.match(r"^data:(image/\w+);base64,(.+)$", raw, re.DOTALL)
    if match:
        return match.group(1), match.group(2)
    return "image/png", raw


def extract_base64_from_response(text: str) -> Optional[str]:
    match = re.search(r"data:image/\w+;base64,[A-Za-z0-9+/=]+", text)
    if match:
        return match.group(0)
    match = re.search(r"[A-Za-z0-9+/=]{100,}", text)
    if match:
        return f"data:image/png;base64,{match.group(0)}"
    return None


def extract_image_url_from_response(text: str) -> Optional[str]:
    match = re.search(r"!\[.*?\]\((https?://[^\s)]+)\)", text)
    if match:
        return match.group(1)
    match = re.search(r"(https?://\S+\.(?:jpg|jpeg|png|webp|gif))", text, re.IGNORECASE)
    if match:
        return match.group(1)
    return None


async def download_image_as_base64(url: str) -> str:
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        if not content_type.startswith("image/"):
            content_type = "image/jpeg"
        encoded = b64mod.b64encode(resp.content).decode("ascii")
        return f"data:{content_type};base64,{encoded}"


@router.post("/task1", response_model=TaskResponse)
async def task1_remove_watermark(req: TaskRequest):
    grok_key = _settings.grok_api_key.get_secret_value() if _settings.grok_api_key else ""
    if not grok_key:
        raise HTTPException(status_code=500, detail="GROK_API_KEY 未配置")

    mime_type, pure_b64 = parse_base64_image(req.image_base64)
    task_id = f"task1_{uuid.uuid4().hex[:12]}"
    prompt = (req.prompt or "").strip() or "Remove all watermarks and text"

    payload = {
        "model": _settings.grok_model,
        "messages": [{"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{pure_b64}"}},
            {"type": "text", "text": prompt},
        ]}],
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{_settings.grok_base_url}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {grok_key}", "Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()

        choices = data.get("choices", [])
        if not choices:
            raise HTTPException(status_code=502, detail="Grok 模型未返回结果")

        content = choices[0].get("message", {}).get("content", "")
        result_image = None

        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict):
                    if item.get("type") == "image_url":
                        result_image = item["image_url"]["url"]
                        break
                    elif item.get("type") == "image":
                        img_data = item.get("data") or item.get("image", "")
                        if img_data:
                            result_image = f"data:image/png;base64,{img_data}" if not img_data.startswith("data:") else img_data
                            break
        elif isinstance(content, str):
            result_image = extract_base64_from_response(content)
            if not result_image:
                img_url = extract_image_url_from_response(content)
                if img_url:
                    result_image = await download_image_as_base64(img_url)

        if not result_image:
            raise HTTPException(status_code=502, detail="无法从 Grok 响应中提取图像结果")

        return TaskResponse(task_id=task_id, result_image_base64=result_image, message="文字/水印去除完成")

    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Grok API 调用失败: {e.response.status_code} - {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Grok 模型调用失败: {str(e)}")


@router.post("/task2", response_model=TaskResponse)
async def task2_expand_image(req: TaskRequest):
    if _gemini_client is None:
        raise HTTPException(status_code=500, detail="GeminiClient 未初始化")

    gemini_key = _settings.gemini_image_api_key.get_secret_value() if _settings.gemini_image_api_key else ""
    if not gemini_key:
        raise HTTPException(status_code=500, detail="GEMINI_IMAGE_API_KEY 未配置")

    _mime_type, pure_b64 = parse_base64_image(req.image_base64)
    task_id = f"task2_{uuid.uuid4().hex[:12]}"
    aspect_ratio = (req.aspect_ratio or "auto").strip() or "auto"
    quality = (req.quality or "2K").strip() or "2K"

    if aspect_ratio not in ASPECT_RATIOS:
        raise HTTPException(status_code=400, detail="无效的图像比例")
    if quality not in QUALITY_LEVELS:
        raise HTTPException(status_code=400, detail="无效的清晰度")

    try:
        result_b64 = await _gemini_client.generate_image(
            prompt="全画幅展示图像，去除多余元素。",
            reference_image_base64=pure_b64,
            aspect_ratio=aspect_ratio if aspect_ratio != "auto" else "1:1",
            image_size=quality,
        )
        result_image = f"data:image/png;base64,{result_b64}"
        return TaskResponse(task_id=task_id, result_image_base64=result_image, message="画面补全完成")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini 模型调用失败: {str(e)}")


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "grok_configured": bool(_settings.grok_api_key and _settings.grok_api_key.get_secret_value()),
        "gemini_configured": bool(_settings.gemini_image_api_key and _settings.gemini_image_api_key.get_secret_value()),
        "aspect_ratios": ASPECT_RATIOS,
        "quality_levels": QUALITY_LEVELS,
    }
