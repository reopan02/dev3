import logging
import re
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, SecretStr

from config import get_settings

router = APIRouter(prefix="/api/refer", tags=["refer"])

logger = logging.getLogger("refer")

_settings = get_settings()

AVAILABLE_MODELS = ["gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview"]
AVAILABLE_RECOGNIZE_MODELS = ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash"]
RECOGNIZE_PROMPT = "简要高效地描述图像中的人物外貌特征"
STYLE_TRANSFER_PROMPT_TEMPLATE = """目标图："{target_image}"
请基于参考图的风格对目标图进行重绘，使两者在以下三个维度保持一致：
艺术风格与流派 — 包括画风、色彩倾向、笔触质感、渲染方式等
构图与视觉引导 — 包括画面布局、视觉重心、景深层次、留白比例等
线条艺术 — 包括线条粗细、勾勒方式、描边风格、线条疏密等
约束条件（最高优先级）：
严格保留目标图中角色的原始外貌，不做任何修改
不引入参考图中任何角色的外貌特征
仅迁移风格，不迁移内容
简而言之：只改"怎么画"，不改"画的是谁"。
输出要求：图像比例 {aspect_ratio}，分辨率 {quality}。"""

ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]
QUALITY_LEVELS = ["512px", "1K", "2K", "4K"]


class TransferRequest(BaseModel):
    target_image: str
    refer_image: str
    aspect_ratio: Optional[str] = None
    quality: Optional[str] = None


def ensure_data_url(image_data: str, default_mime: str = "image/png") -> str:
    if image_data.startswith("data:"):
        return image_data
    return f"data:{default_mime};base64,{image_data}"


def extract_image_from_response(response) -> Optional[str]:
    if isinstance(response.content, list):
        for block in response.content:
            if isinstance(block, dict):
                if block.get("type") == "image_url":
                    url = block.get("image_url", {}).get("url", "")
                    if url:
                        return url
                if block.get("type") == "image" and block.get("data"):
                    mime = block.get("mime_type", "image/png")
                    return f"data:{mime};base64,{block['data']}"
    if isinstance(response.content, str):
        b64_pattern = r"data:image/[^;]+;base64,[A-Za-z0-9+/=]+"
        match = re.search(b64_pattern, response.content)
        if match:
            return match.group(0)
    return None


def _extract_image_from_openai_response(data: dict) -> Optional[str]:
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "image_url":
                    url = block.get("image_url", {}).get("url", "")
                    if url:
                        return url
                if block.get("type") == "image" and block.get("data"):
                    mime = block.get("mime_type", "image/png")
                    return f"data:{mime};base64,{block['data']}"
    if isinstance(content, str):
        match = re.search(r"data:image/[^;]+;base64,[A-Za-z0-9+/=]+", content)
        if match:
            return match.group(0)
    return None


def resolve_secret(*keys: Optional[SecretStr]) -> str:
    for key in keys:
        if key is not None:
            value = key.get_secret_value().strip()
            if value:
                return value
    return ""


def get_refer_runtime_config() -> dict:
    return {
        "model": _settings.refer_model,
        "recognize_model": _settings.refer_recognize_model,
        "aspect_ratio": "1:1",
        "quality": "1K",
    }


def validate_refer_config(config: dict) -> list[str]:
    errors = []

    if config["model"] not in AVAILABLE_MODELS:
        errors.append(f"REFER_MODEL 无效: {config['model']}")
    if config["recognize_model"] not in AVAILABLE_RECOGNIZE_MODELS:
        errors.append(f"REFER_RECOGNIZE_MODEL 无效: {config['recognize_model']}")

    return errors


def build_effective_refer_config(req: TransferRequest) -> tuple[dict, list[str]]:
    config = get_refer_runtime_config()

    if req.aspect_ratio is not None:
        if req.aspect_ratio not in ASPECT_RATIOS:
            return config, [f"aspect_ratio 无效: {req.aspect_ratio}"]
        config["aspect_ratio"] = req.aspect_ratio
    if req.quality is not None:
        if req.quality not in QUALITY_LEVELS:
            return config, [f"quality 无效: {req.quality}"]
        config["quality"] = req.quality

    errors = validate_refer_config(config)
    return config, errors


@router.get("/models")
async def get_models():
    config = get_refer_runtime_config()
    errors = validate_refer_config(config)
    return {
        "models": AVAILABLE_MODELS,
        "recognize_models": AVAILABLE_RECOGNIZE_MODELS,
        "aspect_ratios": ASPECT_RATIOS,
        "quality_levels": QUALITY_LEVELS,
        "config": {
            "model": config["model"],
            "recognize_model": config["recognize_model"],
            "aspect_ratio": config["aspect_ratio"],
            "quality": config["quality"],
        },
        "base_url_configured": bool(_settings.refer_base_url),
        "image_api_key_configured": bool(
            resolve_secret(_settings.refer_image_api_key, _settings.gemini_image_api_key)
        ),
        "recognize_api_key_configured": bool(
            resolve_secret(_settings.refer_recognize_api_key, _settings.gemini_analyze_api_key)
        ),
        "config_errors": errors,
    }


@router.post("/transfer")
async def style_transfer(req: TransferRequest):
    base_url = _settings.refer_base_url
    if not base_url:
        raise HTTPException(status_code=500, detail="BASE_URL 未在根目录 .env 中配置")

    runtime_config, config_errors = build_effective_refer_config(req)
    if config_errors:
        raise HTTPException(status_code=500, detail="; ".join(config_errors))

    image_api_key = resolve_secret(_settings.refer_image_api_key, _settings.gemini_image_api_key)
    recognize_api_key = resolve_secret(_settings.refer_recognize_api_key, _settings.gemini_analyze_api_key)
    if not image_api_key:
        raise HTTPException(status_code=500, detail="REFER_IMAGE_API_KEY 或 GEMINI_IMAGE_API_KEY 未在根目录 .env 中配置")
    if not recognize_api_key:
        raise HTTPException(status_code=500, detail="REFER_RECOGNIZE_API_KEY 或 GEMINI_ANALYZE_API_KEY 未在根目录 .env 中配置")

    headers = {"Authorization": f"Bearer {recognize_api_key}", "Content-Type": "application/json"}
    image_headers = {"Authorization": f"Bearer {image_api_key}", "Content-Type": "application/json"}

    try:
        target_url = ensure_data_url(req.target_image)
        refer_url = ensure_data_url(req.refer_image)

        async with httpx.AsyncClient(timeout=60.0) as client:
            rec_resp = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json={
                    "model": runtime_config["recognize_model"],
                    "messages": [{"role": "user", "content": [
                        {"type": "image_url", "image_url": {"url": target_url}},
                        {"type": "text", "text": RECOGNIZE_PROMPT},
                    ]}],
                },
            )
            rec_resp.raise_for_status()
            rec_data = rec_resp.json()

        target_description = rec_data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if isinstance(target_description, list):
            target_description = " ".join(
                block.get("text", "") if isinstance(block, dict) else str(block)
                for block in target_description
            )

        style_prompt = STYLE_TRANSFER_PROMPT_TEMPLATE.format(
            target_image=target_description,
            aspect_ratio=runtime_config["aspect_ratio"],
            quality=runtime_config["quality"],
        )

        async with httpx.AsyncClient(timeout=120.0) as client:
            img_resp = await client.post(
                f"{base_url}/chat/completions",
                headers=image_headers,
                json={
                    "model": runtime_config["model"],
                    "messages": [{"role": "user", "content": [
                        {"type": "image_url", "image_url": {"url": target_url}},
                        {"type": "image_url", "image_url": {"url": refer_url}},
                        {"type": "text", "text": style_prompt},
                    ]}],
                },
            )
            img_resp.raise_for_status()
            img_data = img_resp.json()

        result_image = _extract_image_from_openai_response(img_data)
        text_content = img_data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if isinstance(text_content, list):
            text_content = None

        return {
            "success": True,
            "image": result_image,
            "text": text_content,
            "target_description": target_description,
            "config": runtime_config,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("风格迁移失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
