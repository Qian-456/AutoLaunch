from __future__ import annotations

import asyncio

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .contracts import ROOT, DirectorRequest, RagRequest
from .service import LaunchService


def create_app(service: LaunchService | None = None):
    service = service or LaunchService()
    app = FastAPI(title='AutoLaunch RAG Director', version='0.2.0')

    # Do not echo user input or validation contexts into errors/logs.
    @app.exception_handler(RequestValidationError)
    async def invalid_request(_request, _exc):
        return JSONResponse(status_code=422, content={'detail': 'invalid_request'})

    async def invoke(request: Request, operation):
        task = asyncio.create_task(operation)
        async def watch_disconnect():
            while not task.done():
                if await request.is_disconnected():
                    task.cancel()
                    return
                await asyncio.sleep(.1)
        watcher = asyncio.create_task(watch_disconnect())
        try:
            return await task
        except ValueError:
            raise HTTPException(422, 'invalid_pack_or_contract') from None
        finally:
            watcher.cancel()
            task.cancel()

    @app.get('/api/health')
    def health():
        model = ROOT / 'public/assets/su7_ultra.glb'
        return {'status': 'ok' if model.is_file() else 'degraded', 'modelBytes': model.stat().st_size if model.is_file() else 0,
                'packId': service.registry.data['packId'], 'registryVersion': service.registry.data['registryVersion'],
                'providersConfigured': [p.name for p in service.gateway.providers]}

    @app.post('/api/ai-director')
    async def director(body: DirectorRequest, request: Request):
        return await invoke(request, service.director(body))

    @app.post('/api/rag')
    async def rag(body: RagRequest, request: Request):
        return await invoke(request, service.rag(body))

    @app.get('/api/knowledge/{chunk_id}')
    def evidence(chunk_id: str):
        chunks = getattr(service.retriever, 'chunks', [])
        chunk = next((c for c in chunks if c.chunkId == chunk_id), None)
        if not chunk: raise HTTPException(404, 'unknown_chunk')
        return chunk.public()

    @app.get('/api/registry')
    def capabilities():
        return service.registry.data

    @app.get('/api/{path:path}')
    def missing_api(path: str):
        raise HTTPException(404, 'unknown_api')

    if (ROOT / 'dist').is_dir():
        app.mount('/', StaticFiles(directory=ROOT / 'dist', html=True), name='frontend')
    return app


app = create_app()
