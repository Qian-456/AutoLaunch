"""Generate/check real offline HTTP-contract fixtures without model calls."""
import argparse
import asyncio
import json

from .contracts import ROOT, DirectorRequest, RagRequest
from .gateway import ModelGateway
from .service import LaunchService


async def fixtures():
    service = LaunchService(gateway=ModelGateway(providers=[]))
    pack = service.registry.data['packId']
    director = await service.director(DirectorRequest(requirement='一家三口周末出游，重点看看装东西方便不方便。', packId=pack))
    rag = await service.rag(RagRequest(question='后备箱多大？', packId=pack))
    director['requestId'] = rag['requestId'] = 'contract-fixture'
    return {'director': director, 'rag': rag}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    path = ROOT / 'src/test/fixtures/offline-api.json'
    content = json.dumps(asyncio.run(fixtures()), ensure_ascii=False, indent=2) + '\n'
    if args.check:
        if path.read_text(encoding='utf-8') != content: raise SystemExit('API fixture drift; run python -m server.fixtures')
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')
    print('Offline API contract fixtures verified')
