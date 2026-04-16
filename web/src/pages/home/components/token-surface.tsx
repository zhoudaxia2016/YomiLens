import type { Token } from '@/types'
import { needsRuby } from '../utils'

type TokenSurfaceProps = {
  token: Token
}

export function TokenSurface({ token }: TokenSurfaceProps) {
  if (needsRuby(token.surface) && token.furigana) {
    return (
      <ruby>
        {token.surface}
        <rt>{token.furigana}</rt>
      </ruby>
    )
  }

  return <span>{token.surface}</span>
}
