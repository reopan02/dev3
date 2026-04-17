import json
import traceback
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from models.schemas import AnalyzeRequest, GenerateRequest, GenerateResponse, FusePromptRequest, RecognizeProductRequest
from services.gemini_client import GeminiClient
from services.llm_manager import LLMManager
from config import get_settings

router = APIRouter(prefix="/api/generate", tags=["generate"])

_REVERSE_PROMPT = """
请根据我提供的这张动漫角色卡片图片，反向分析并生成一段完整、可复现的图像生成提示词（Prompt）。

你从以下维度进行详细拆解并整合成一段自然语言提示词：

角色立绘构图：角色在卡面中的位置、占比、裁切方式、是否溢出边框、姿态与动态感
边框与装饰元素：卡片边框样式（金属 / 魔法 / 科技等）、圆角、装饰纹理、稀有度标识（星级 / 金边 / 全息等）、属性图标
背景与特效：背景渐变、光晕特效、元素粒子、属性色调、氛围渲染
文字与数值排版：角色名位置与字体风格、属性标签、数值显示（ATK / DEF / HP 等）、技能描述区域
整体风格与氛围：奇幻 / 科幻 / 古风 / 赛博朋克等视觉风格、色调倾向、画面氛围
卡片尺寸与布局：卡片宽高比、内容区域划分、元素层次关系

最终请输出：

一段完整的中文 Prompt（可直接用于生成图片）
输出内容不要解释过程
""".strip()

_FUSE_PROMPT = """
你是动漫角色卡片提示词融合专家。你的任务是将参考卡片风格模板中的**卡面视觉与排版元素**提取出来，结合用户提供的目标角色信息，生成一段新的动漫角色卡片图像生成提示词。

## 输入

1. **参考卡片风格模板**：从现有动漫角色卡片图片反推得到的卡面构图、边框样式、背景特效、文字排版、整体风格等描述（注意：其中包含原角色的描述，必须剔除）
2. **目标角色信息**：用户输入的角色名称、外观特征、服装风格、性格气质、能力设定等信息（这是唯一的角色内容来源）

## 融合规则

1. **保留视觉元素**：仅保留模板中与卡面排版、边框风格、背景特效、光影质感、整体风格、视角、色调氛围、文字布局、数值区域设计等**与具体角色无关的视觉描述**
2. **彻底剔除原角色描述**：必须完全移除模板中关于原角色的一切描述，包括但不限于：角色姓名、种族、性别、外貌特征、发色发型、服装与配饰、武器与道具、职业与身份、属性与阵营、具体技能与数值设定
3. **以目标角色信息为准**：所有与角色相关的内容（外观、服装、武器、动作、表情、职业、种族、属性、能力等）**只能**来源于「目标角色信息」，严禁从参考卡片风格模板中继承任何角色设定
4. **不捏造信息**：如果「目标角色信息」中未提及某项角色属性（例如具体武器种类、服装细节、具体数值等），则不得自行编造，直接省略该信息，仅用中性或抽象描述保持画面完整性
5. **格式可直接复用**：输出结果需整合为一段自然流畅的中文 Prompt，同时兼顾卡面视觉布局与角色形象描述，能够直接用于动漫角色卡片图像生成

## 输出要求

直接输出融合后的中文提示词，不要解释过程，不要添加额外说明。
""".strip()

_RECOGNIZE_TEMPLATE = """
# 动漫角色识别

请分析图片中的动漫角色。

## 要求

1. 基于图片内容进行识别，可适当推断，重点描述角色外观特征。
2. 描述服装与配饰信息，包括服装风格与颜色、武器/法杖/盾牌等装备、饰品等。
3. 识别画风与风格（如赛璐璐、厚涂、水彩、像素等）以及姿态与动作（如站姿、战斗姿态、坐姿等肢体语言）。
5. 语言专业简洁，使用中文输出；不编造角色背景故事，不回复任何与描述无关的信息；突出角色的视觉辨识度和个性特征。
""".strip()

_settings = get_settings()

try:
    _gemini_client = GeminiClient(_settings)
    _llm_manager = LLMManager(_settings)
except Exception as e:
    print(f"[generate] Warning: clients not initialized: {e}")
    _gemini_client = None
    _llm_manager = None


def _sse_chunk(content: str, done: bool = False) -> str:
    return f"data: {json.dumps({'content': content, 'done': done}, ensure_ascii=False)}\n\n"


def _sse_error(message: str) -> str:
    return f"data: {json.dumps({'error': message, 'done': True}, ensure_ascii=False)}\n\n"


def _require_clients():
    if _gemini_client is None or _llm_manager is None:
        raise HTTPException(status_code=503, detail="Generate tool not configured: check GEMINI_ANALYZE_API_KEY and GEMINI_IMAGE_API_KEY")


@router.post("/analyze")
async def analyze_competitor_image(request: AnalyzeRequest):
    _require_clients()
    is_valid, error_msg = _gemini_client.validate_image_base64(request.image)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    raw_image = request.image.split(",")[1] if "," in request.image else request.image

    async def generate() -> AsyncGenerator[str, None]:
        try:
            messages = [
                {"role": "system", "content": _REVERSE_PROMPT},
                {"role": "user", "content": [
                    {"type": "text", "text": "请分析这张动漫卡片并生成卡面风格提示词"},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{raw_image}"}}
                ]}
            ]
            async for chunk in _llm_manager.stream_chat(messages):
                yield _sse_chunk(chunk)
            yield _sse_chunk("", done=True)
        except Exception as e:
            traceback.print_exc()
            yield _sse_error(f"图片分析失败: {str(e)}")

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/generate", response_model=GenerateResponse)
async def generate_product_image(request: GenerateRequest):
    _require_clients()
    try:
        is_text_to_image = not request.target_image or request.target_image.strip() == ""
        if not is_text_to_image:
            is_valid, error_msg = _gemini_client.validate_image_base64(request.target_image)
            if not is_valid:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
        if not request.prompt or len(request.prompt.strip()) == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="提示词不能为空")

        generated_image = await _gemini_client.generate_image(
            prompt=request.prompt,
            reference_image_base64=request.target_image if not is_text_to_image else None,
            aspect_ratio=request.aspect_ratio,
            image_size=request.image_size,
            model=request.model
        )
        return GenerateResponse(generated_image=generated_image)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"图片生成失败: {str(e)}")


@router.post("/fuse-prompt")
async def fuse_prompt(request: FusePromptRequest):
    _require_clients()
    if not request.analysis_result or len(request.analysis_result.strip()) < 10:
        raise HTTPException(status_code=400, detail="参考卡片分析结果过短")
    if not request.product_info or len(request.product_info.strip()) < 2:
        raise HTTPException(status_code=400, detail="请输入角色信息")

    async def generate() -> AsyncGenerator[str, None]:
        try:
            messages = [
                {"role": "system", "content": _FUSE_PROMPT},
                {"role": "user", "content": f"## 参考卡片风格模板\n\n{request.analysis_result}\n\n## 目标角色信息\n\n{request.product_info}"}
            ]
            async for chunk in _llm_manager.stream_chat(messages):
                yield _sse_chunk(chunk)
            yield _sse_chunk("", done=True)
        except Exception as e:
            traceback.print_exc()
            yield _sse_error(f"提示词融合失败: {str(e)}")

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/recognize-product")
async def recognize_product(request: RecognizeProductRequest):
    _require_clients()
    is_valid, error_msg = _gemini_client.validate_image_base64(request.image)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    raw_image = request.image.split(",")[1] if "," in request.image else request.image

    async def generate() -> AsyncGenerator[str, None]:
        try:
            messages = [
                {"role": "system", "content": _RECOGNIZE_TEMPLATE},
                {"role": "user", "content": [
                    {"type": "text", "text": "请识别这张图片中的动漫角色信息"},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{raw_image}"}}
                ]}
            ]
            async for chunk in _llm_manager.stream_chat(messages, temperature=_settings.llm_recognize_temperature):
                yield _sse_chunk(chunk)
            yield _sse_chunk("", done=True)
        except Exception as e:
            traceback.print_exc()
            yield _sse_error(f"角色识别失败: {str(e)}")

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
