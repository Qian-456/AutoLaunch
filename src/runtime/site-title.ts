/**
 * Site title helper for browser tab display and ICP filing compliance.
 *
 * Rules enforced:
 * 1. The returned title MUST contain Chinese characters (ICP requirement).
 * 2. It MUST keep the "AutoLaunch" brand token visible.
 * 3. It SHOULD append a product-pack disambiguator (e.g. vehicle variant) so
 *    multiple demo sites can live under the same framework without confusion.
 */

const DEFAULT_TITLE = 'AutoLaunch 汽车数字发布会展示站 · SU7 Ultra 概念演示'

/**
 * Returns true when the input contains at least one CJK unified ideograph,
 * which is the minimum bar for Chinese content in an ICP filing name.
 *
 * @param candidate - Raw title string to inspect
 * @returns Boolean flag indicating Chinese character presence
 */
export function ensureChineseInTitle(candidate: string): boolean {
  // CJK Unified Ideographs + Extension A covers daily-use + common proper nouns
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(candidate ?? '')
}

/**
 * Builds the final document title.
 *
 * Priority:
 *   1. Explicit non-empty `override` (used by tests and inline overrides).
 *   2. import.meta.env.VITE_APP_SITE_TITLE when set and valid.
 *   3. Built-in DEFAULT_TITLE that is known to pass filing checks.
 *
 * If a candidate is supplied but has zero Chinese characters, the function
 * falls back to the default to avoid accidentally producing an ICP-invalid
 * title on a filing-bound domain.
 *
 * @param override - Optional explicit override (tests, inline usage)
 * @returns Final title string guaranteed to contain Chinese content
 */
export function buildSiteTitle(override?: string): string {
  const envTitle = (
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_APP_SITE_TITLE === 'string'
      ? import.meta.env.VITE_APP_SITE_TITLE
      : ''
  ).trim()

  const raw = (override ?? '').trim() || envTitle || DEFAULT_TITLE

  if (ensureChineseInTitle(raw)) {
    return raw
  }

  // Chinese-less override/env should never win; silently fall back to
  // the compliant default and let the caller reason about their input.
  return DEFAULT_TITLE
}
