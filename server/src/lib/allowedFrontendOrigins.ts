export function parseAllowedFrontendOrigins(): Set<string> {
  const raw = Deno.env.get('ALLOWED_FRONTEND_ORIGINS')?.trim()
  if (!raw) return new Set()
  const out = new Set<string>()
  for (const part of raw.split(',')) {
    const t = part.trim()
    if (!t) continue
    try {
      const base = t.includes('://') ? t : `https://${t}`
      out.add(new URL(base).origin)
    } catch {
      // Ignore invalid entries.
    }
  }
  return out
}

export function normalizeRequestOrigin(originHeader: string | undefined): string | null {
  if (!originHeader?.trim()) return null
  try {
    return new URL(originHeader).origin
  } catch {
    return null
  }
}
