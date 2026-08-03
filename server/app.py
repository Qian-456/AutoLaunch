from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_RELATIVE_PATH = Path("assets/2025_xiaomi_su7_ultra.glb")


def resolve_dist_dir(value: str | Path | None = None) -> Path:
    configured = value or os.getenv("AUTOLAUNCH_DIST_DIR", "dist")
    path = Path(configured)
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    return path.resolve()


def validate_deployment(dist_dir: Path) -> None:
    missing = []
    if not (dist_dir / "index.html").is_file():
        missing.append("index.html")
    if not (dist_dir / MODEL_RELATIVE_PATH).is_file():
        missing.append(MODEL_RELATIVE_PATH.as_posix())
    if missing:
        formatted = ", ".join(missing)
        raise RuntimeError(
            f"AutoLaunch 构建产物不完整：缺少 {formatted}。请先运行 npm run build。"
        )


def create_app(dist_dir: str | Path | None = None) -> FastAPI:
    resolved_dist = resolve_dist_dir(dist_dir)
    validate_deployment(resolved_dist)

    application = FastAPI(
        title="AutoLaunch SU7 Ultra",
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )

    @application.get("/api/health")
    async def health() -> dict[str, object]:
        model = resolved_dist / MODEL_RELATIVE_PATH
        return {
            "status": "ok",
            "app": "AutoLaunch",
            "pack": "su7-ultra-concept",
            "model": MODEL_RELATIVE_PATH.as_posix(),
            "modelBytes": model.stat().st_size,
        }

    @application.api_route(
        "/{requested_path:path}", methods=["GET", "HEAD"], include_in_schema=False
    )
    async def frontend(requested_path: str) -> FileResponse:
        relative = Path(requested_path or "index.html")
        candidate = (resolved_dist / relative).resolve()
        try:
            candidate.relative_to(resolved_dist)
        except ValueError as error:
            raise HTTPException(status_code=404, detail="Not found") from error

        if candidate.is_file():
            response = FileResponse(candidate)
            if candidate.suffix.lower() == ".glb":
                response.headers["Cache-Control"] = "public, max-age=86400"
            return response

        return FileResponse(resolved_dist / "index.html")

    return application
