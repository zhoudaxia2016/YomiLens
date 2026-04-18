import type { Token } from '@/types'
import { needsRuby } from '../utils'

type TokenSurfaceProps = {
  token: Token
}

export function TokenSurface({ token }: TokenSurfaceProps) {
  if (needsRuby(token.surface) && token.furigana) {
    return (
      <span className="relative inline-flex items-center leading-none">
        <span className="token-body">
          <span className="relative z-10">{token.surface}</span>
        </span>
        <span className="pointer-events-none absolute bottom-[calc(100%-0.02em)] left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] leading-none text-muted-foreground">
          {token.furigana}
        </span>
      </span>
    )
  }

  return (
    <span className="token-body">
      <span className="relative z-10">{token.surface}</span>
    </span>
  )
}
