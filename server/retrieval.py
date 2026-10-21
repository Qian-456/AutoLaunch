"""Local Markdown retrieval. Replace Retriever, not execution/registry contracts."""
from __future__ import annotations

import hashlib
import math
import re
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Protocol

from .contracts import ROOT

ALIASES = {
    '后备箱': ['后备箱', '后备厢', '尾门', '储物', '装东西', '行李', '装载'],
    '加速': ['加速', '零百', '百公里加速', '动力', '性能'],
    '主驾': ['主驾', '驾驶位', '驾驶员'],
    '车窗': ['车窗', '通风', '无框'],
    '家庭': ['家庭', '一家三口', '周末', '出游', '儿童', '家用'],
}
LINK = re.compile(r'\[([^\]]*)\]\((https?://[^\s)]+|/api/registry)\)')


def normalize(text: str) -> str:
    text = re.sub(r'\s+', '', text.lower())
    for canonical, words in ALIASES.items():
        for word in words:
            text = text.replace(word, canonical)
    return text


def terms(text: str) -> list[str]:
    text = normalize(text)
    words = re.findall(r'[a-z0-9]+', text)
    for sequence in re.findall(r'[\u4e00-\u9fff]+', text):
        words.extend(sequence[i:i+2] for i in range(max(1, len(sequence)-1)))
    return words


@dataclass(frozen=True)
class Chunk:
    chunkId: str
    documentPath: str
    heading: str
    text: str
    sources: list[dict]
    modelScope: str
    version: str
    packId: str
    entityId: str
    sourceType: str
    verification: str = 'curated-unverified'

    def public(self):
        return asdict(self)


def chunks_from_markdown(path: Path, pack_id: str) -> list[Chunk]:
    markdown = path.read_text(encoding='utf-8')
    doc_path = 'knowledge/' + path.name
    version = (re.search(r'文档版本[：:]\s*([^\n]+)', markdown) or [None, 'unspecified'])[1]
    # Numbered source links resolve table cells such as “来源 1 / 来源 4”.
    numbered = {}
    for line in markdown.splitlines():
        number = re.match(r'^\s*>?\s*(\d+)\.', line)
        if number and LINK.search(line):
            numbered[number.group(1)] = [{'title': t, 'url': u} for t, u in LINK.findall(line)]
    sections: list[tuple[str, list[str]]] = []
    heading = ''; lines: list[str] = []
    for line in markdown.splitlines():
        if line.startswith('#'):
            if lines: sections.append((heading, lines))
            heading = line.lstrip('# ').strip(); lines = []
        else: lines.append(line)
    if lines: sections.append((heading, lines))
    output = []
    for heading, lines in sections:
        # Intro/version notes and provenance catalogues are not product evidence.
        if not heading or heading == markdown.splitlines()[0].lstrip('# ').strip() or re.search(r'溯源来源|溯源入口|版本范围标注|RAG|关键词|关键字|索引|检索标签', heading, re.I): continue
        section_links = [{'title': t, 'url': u} for t, u in LINK.findall('\n'.join(lines))]
        blocks: list[str] = []; paragraph: list[str] = []; table_header = ''
        def flush():
            if paragraph: blocks.append('\n'.join(paragraph)); paragraph.clear()
        for line in lines:
            if line.startswith('|'):
                flush()
                if re.fullmatch(r'[|\s:\-]+', line): continue
                if not table_header: table_header = line; continue
                blocks.append(table_header + '\n' + line)
            elif not line.strip() or line.strip() == '---': flush(); table_header = ''
            else: paragraph.append(line)
        flush()
        for block in blocks:
            if len(block) < 20: continue
            if re.search(r'可被检索的关键词|可被 RAG|关键词索引', block): continue
            # Tables are scoped per row; section headings carry ordinary-only flags.
            context = heading + '\n' + block
            if re.search(r'仅普通版|普通版对比锚点|普通版\s*SU7\s*对比|普通版实测|普通版\s*SU7\s*1440', context): scope = 'SU7-standard-reference'
            elif '全系列共用' in context: scope = 'SU7-series-shared'
            elif 'Ultra' in context or 'Ultra' in markdown.splitlines()[0]: scope = 'SU7-Ultra'
            else: scope = 'unknown'
            sources = [{'title': t, 'url': u} for t, u in LINK.findall(block)]
            if not sources:
                for n in re.findall(r'来源\s*(\d+)', block): sources.extend(numbered.get(n, []))
            if not sources: sources = section_links[:4]
            if not sources: continue
            source_type = 'runtime-contract' if any(s['url'] == '/api/registry' for s in sources) else 'estimate' if re.search(r'估算|推算|理论|心理预期', block) else 'owner-report' if re.search(r'车主|什么值得买', context) else 'official-report' if any('www.mi.com/' in s['url'] for s in sources) else 'media-report'
            entity = 'trunk' if '后备箱' in normalize(context) else 'window_driver_front' if '车窗' in context else 'vehicle'
            chunk_id = hashlib.sha256((doc_path + heading + block).encode()).hexdigest()[:16]
            output.append(Chunk(chunk_id, doc_path, heading, block, sources, scope, str(version), pack_id, entity, source_type))
    return output


class Retriever(Protocol):
    def search(self, query: str, pack_id: str, limit: int = 5) -> list[Chunk]: ...


class MarkdownRetriever:
    def __init__(self, pack_id: str, directory: Path = ROOT / 'knowledge'):
        self.chunks = [c for path in sorted(directory.glob('*.md')) for c in chunks_from_markdown(path, pack_id)]

    def search(self, query: str, pack_id: str, limit: int = 5) -> list[Chunk]:
        # Filter before ranking: ordinary SU7 measurements never become Ultra facts.
        pool = [c for c in self.chunks if c.packId == pack_id and c.modelScope in {'SU7-Ultra', 'SU7-series-shared'} and c.sourceType != 'estimate']
        if re.search(r'天气|股票|股价|写代码|系统提示|ignore.*instruction|普通版', query, re.I): return []
        normalized = normalize(query)
        topics = [key for key in ALIASES if key in normalized]
        capacity_question = '后备箱' in topics and bool(re.search(r'多大|容量|容积|多少升', query))
        if capacity_question:
            # A capacity question needs capacity evidence, not merely any storage
            # keyword (door pockets and software capability notes are unrelated).
            pool = [c for c in pool if '后备箱' in normalize(c.text) and re.search(r'容积|容量', c.text) and c.sourceType != 'runtime-contract']
        known = topics or any(t in query for t in ['续航', '电池', '充电', '制动', '刹车', '尺寸', '轴距', '座椅', '灯光', '车身', '圈速'])
        if not known: return []
        counts = [Counter(terms(c.heading + c.text)) for c in pool]
        n = len(pool); avg = sum(sum(c.values()) for c in counts) / max(n, 1)
        query_terms = set(terms(query)); scores = []
        for chunk, counts_i in zip(pool, counts):
            text = normalize(chunk.heading + chunk.text)
            # Avoid coincidental bigram overlaps when the main product intent is absent.
            if topics and not any(topic in text for topic in topics): continue
            score = 0.0
            for word in query_terms:
                frequency = counts_i[word]
                if not frequency: continue
                df = sum(word in c for c in counts)
                idf = math.log(1 + (n-df+0.5)/(df+0.5))
                score += idf * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * sum(counts_i.values())/max(avg, 1)))
            # IDF is naturally small after a narrow applicability/intent filter;
            # do not mistake that small filtered corpus for low relevance.
            if score > (0.05 if capacity_question else 1): scores.append((score, chunk))
        scores.sort(key=lambda item: (-item[0], item[1].chunkId))
        return [chunk for _, chunk in scores[:limit]]


def extractive_answer(chunks: list[Chunk]) -> str:
    if not chunks:
        return '当前 SU7 Ultra 知识库没有足够的适用证据，无法确认；请以对应版本的官方资料或实车核验为准。'
    lines = ['以下为本地精选资料摘录（原始链接未实时复核）；不同来源、测试条件及版本保留各自口径：']
    for index, chunk in enumerate(chunks, 1):
        plain = LINK.sub(lambda m: m.group(1), chunk.text)
        plain = plain.replace('**', '').replace('`', '').strip('> \n')
        if plain.startswith('|') and len(plain.splitlines()) == 2:
            header, row = [[cell.strip() for cell in line.strip('|').split('|')] for line in plain.splitlines()]
            plain = '；'.join(f'{key}：{value}' for key, value in zip(header, row))
        lines.append(f'[{index}] {plain}')
    return '\n\n'.join(lines)
