import { createServer } from 'vite'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const source = await server.ssrLoadModule('/src/pack/ai-registry.ts')
  const outputs = {
    'registry-whitelist.json': source.registry,
    'persona-chapters.json': source.personaChapters,
    'chapter-pool.json': source.chapterPool,
    'rag-intent-actions.json': source.intentActions,
  }
  await mkdir('public/fallbacks', { recursive: true })
  for (const [name, data] of Object.entries(outputs)) {
    const path = `public/fallbacks/${name}`
    const value = JSON.stringify(data, null, 2) + '\n'
    if (process.argv.includes('--check')) {
      if (await readFile(path, 'utf8') !== value) throw new Error(`${path} has drifted; run npm run registry:export`)
    } else await writeFile(path, value)
  }
  console.log('Pack registries verified')
} finally { await server.close() }
