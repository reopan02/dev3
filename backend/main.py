import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from dotenv import load_dotenv
from pathlib import Path

# Load .env from project root
_root_env = Path(__file__).parent.parent / ".env"
load_dotenv(_root_env)

from config import get_settings
from routers import generate, refer, watermark

app = FastAPI(title="AI Studio", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate.router)
app.include_router(refer.router)
app.include_router(watermark.router)


@app.get("/app-config.js", include_in_schema=False)
async def app_config():
    settings = get_settings()
    public_config = {
        "generateApiBase": settings.frontend_generate_api_path,
        "referApiBase": settings.frontend_refer_api_path,
        "watermarkApiBase": settings.frontend_watermark_api_path,
    }
    config_json = json.dumps(public_config, ensure_ascii=False)
    content = (
        f"const runtimeConfig = {config_json};"
        "globalThis.__AI_STUDIO_CONFIG__ = runtimeConfig;"
        "export default runtimeConfig;"
    )
    return Response(
        content=content,
        media_type="text/javascript",
        headers={"Cache-Control": "no-store"},
    )

static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = static_dir / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(static_dir / "index.html")


if __name__ == "__main__":
    import uvicorn
    s = get_settings()
    uvicorn.run("main:app", host=s.host, port=s.port, reload=True)
