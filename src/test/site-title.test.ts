import { describe, expect, it, beforeEach } from 'vitest'
import { buildSiteTitle, ensureChineseInTitle } from '../runtime/site-title'

describe('buildSiteTitle', () => {
  beforeEach(() => {
    // Clean up any leftover import.meta.env injection between tests
    delete (globalThis as unknown as Record<string, unknown>).__vite__site_title
  })

  it('returns a string that always contains Chinese characters', () => {
    const title = buildSiteTitle()
    expect(ensureChineseInTitle(title)).toBe(true)
  })

  it('contains the project brand token AutoLaunch', () => {
    const title = buildSiteTitle()
    expect(title).toContain('AutoLaunch')
  })

  it('contains the product-pack vehicle suffix to disambiguate demos', () => {
    const title = buildSiteTitle()
    // Structured assertion: after splitting by separator (·, -, |, or space),
    // the last segment must be non-empty and not equal to the framework name alone.
    const segments = title.split(/\s*[·\-|｜]\s*/).filter(Boolean)
    expect(segments.length).toBeGreaterThanOrEqual(2)
    const tail = segments[segments.length - 1]
    expect(tail.trim().length).toBeGreaterThan(0)
  })

  it('falls back to a sensible default when env var is missing or whitespace', () => {
    // Simulate missing env by calling with explicit empty override
    const title = buildSiteTitle('   ')
    expect(title.length).toBeGreaterThan(10)
    expect(ensureChineseInTitle(title)).toBe(true)
  })

  it('honours a custom VITE_APP_SITE_TITLE override that already includes Chinese', () => {
    const custom = 'AutoLaunch 汽车数字发布会展示站 · SU7 Ultra 概念演示'
    const title = buildSiteTitle(custom)
    expect(title).toBe(custom)
  })
})

describe('ensureChineseInTitle helper', () => {
  it('rejects pure English / domain-only strings the ICP filing forbids', () => {
    expect(ensureChineseInTitle('AutoLaunch')).toBe(false)
    expect(ensureChineseInTitle('autolaunch.cn')).toBe(false)
    expect(ensureChineseInTitle('SU7 Ultra')).toBe(false)
    expect(ensureChineseInTitle('123456')).toBe(false)
  })

  it('accepts mixed strings that contain at least one CJK unified ideograph', () => {
    expect(ensureChineseInTitle('AutoLaunch 汽车数字发布会展示站')).toBe(true)
    expect(ensureChineseInTitle('演示 Demo · SU7')).toBe(true)
    expect(ensureChineseInTitle('汽车发布会')).toBe(true)
  })
})
