import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import { Button } from '../../components/ui/button'
import { mockArticle } from './mock-article'
import type { DependencyNode, ParsedArticle, Pos, Sentence } from '../../types'

type ParseErrorState = {
  message: string
} | null

type HighlightState = {
  paragraphIndex: number
  sentenceIndex: number
  tokenIndices: number[]
}

type SelectedBunsetsuState = {
  paragraphIndex: number
  sentenceIndex: number
  groupIndex: number
  activeTokenIndex: number
} | null

const POS_CLASSNAME: Record<Pos, string> = {
  名詞: 'token token-noun',
  動詞: 'token token-verb',
  形容詞: 'token token-adjective',
  形容動詞: 'token token-adjectival-noun',
  助詞: 'token token-particle',
  助動詞: 'token token-auxiliary',
  副詞: 'token token-adverb',
  連体詞: 'token token-attributive',
  接続詞: 'token token-conjunction',
  感動詞: 'token token-interjection',
  代名詞: 'token token-pronoun',
  接頭辞: 'token token-prefix',
  接尾辞: 'token token-suffix',
}

const DEFAULT_INPUT =
  'むかし太田道灌が始めて江戸城を築いた時、城上に間燕の室を置て之これを静勝軒と名付け、東は江戸湾を望み西は富士秩父の連嶺を軒端に眺めた所から、東を泊船亭と曰いい西を含雪斎と曰うたとのことである。静勝軒を題として記述した詩文に、「西嶺当レ※(「窗／心」、第3水準1-89-54)雪界レ天」、又は「西望則逾二原野一而雪嶺界レ天」とある句は、蓋けだし実景をよんだもので、雪嶺或は西嶺は富士山を指したものに外なるまい。道灌は風流二千石といわれた程あって、歌も上手によみ、扇谷の老臣として軍旅に忙しい身でありながら、よくこの静勝軒で歌合や連歌の会などを催した。元より泊船亭や含雪斎の名は、「※(「窗／心」、第3水準1-89-54)含二西嶺千秋雪一、門泊二東呉万里船一」という詩句から取ったものであろうが、当時の江戸城は今の宮城内に在る元の本丸の地であったということであるから、眺望の広闊なることは言う迄もないことで、富士は更なり遠い赤石山脈の悪沢わるさわ岳や荒川岳（塩見岳）の七月上旬に於ける残雪は、恐らく含雪斎の主人公をして、西嶺千秋雪の感を深からしめたことであろうと思う。'

export function HomePage() {
  const [input, setInput] = useState(DEFAULT_INPUT)
  const [article, setArticle] = useState<ParsedArticle>(mockArticle)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ParseErrorState>(null)
  const [highlightState, setHighlightState] = useState<HighlightState>({
    paragraphIndex: 0,
    sentenceIndex: 0,
    tokenIndices: [0],
  })
  const [selectedBunsetsu, setSelectedBunsetsu] = useState<SelectedBunsetsuState>(null)
  const activeBunsetsuRef = useRef<HTMLDivElement | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = input.trim()
    if (!text) {
      setError({ message: '请输入要解析的日语文章。' })
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await api.parseArticle(text)
      setArticle(result.article)
      setSelectedBunsetsu(null)
      setHighlightState({ paragraphIndex: 0, sentenceIndex: 0, tokenIndices: [] })
    } catch (err) {
      const message = err instanceof Error ? err.message : '解析失败'
      setError({ message })
    } finally {
      setLoading(false)
    }
  }

  function selectBunsetsu(
    paragraphIndex: number,
    sentenceIndex: number,
    groupIndex: number,
    tokenIndices: number[],
  ) {
    const firstIndex = tokenIndices[0]
    if (typeof firstIndex === 'number') {
      setSelectedBunsetsu({ paragraphIndex, sentenceIndex, groupIndex, activeTokenIndex: firstIndex })
    }
    setHighlightState({ paragraphIndex, sentenceIndex, tokenIndices })
  }

  function selectBunsetsuToken(
    paragraphIndex: number,
    sentenceIndex: number,
    groupIndex: number,
    tokenIndex: number,
    tokenIndices: number[],
  ) {
    setSelectedBunsetsu({ paragraphIndex, sentenceIndex, groupIndex, activeTokenIndex: tokenIndex })
    setHighlightState({ paragraphIndex, sentenceIndex, tokenIndices })
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!selectedBunsetsu) return
      const target = event.target
      if (!(target instanceof Node)) return
      if (activeBunsetsuRef.current?.contains(target)) return
      setSelectedBunsetsu(null)
      setHighlightState({ paragraphIndex: 0, sentenceIndex: 0, tokenIndices: [] })
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [selectedBunsetsu])

  return (
    <section className="reader-layout">
      <section className="reader-main">
        <form className="composer-card" onSubmit={handleSubmit}>
          <div className="composer-head">
            <div>
              <p className="section-kicker">输入</p>
              <h2>解析日语文章</h2>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? '解析中…' : '解析文章'}
            </Button>
          </div>
          <textarea
            className="article-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="在这里粘贴日语文章"
            rows={7}
          />
          {error ? <p className="error-banner">{error.message}</p> : null}
        </form>

        <section className="article-card">
          <div className="article-card-head">
            <div>
              <p className="section-kicker">结果</p>
              <h2>{article.title ?? '未命名文章'}</h2>
            </div>
            <p className="article-status">点击文节查看词语详情</p>
          </div>

          <div className="article-flow">
            {article.paragraphs.map((paragraph, paragraphIndex) => (
              <article className="paragraph-card" key={`${paragraph.originalText}-${paragraphIndex}`}>
                {paragraph.sentences.map((sentence, sentenceIndex) => (
                  <section className="sentence-card" key={`${sentence.originalText}-${sentenceIndex}`}>
                    <div className="bunsetsu-row">
                      {buildBunsetsuGroups(sentence).map((group, groupIndex) => {
                        const isSelected =
                          selectedBunsetsu?.paragraphIndex === paragraphIndex
                          && selectedBunsetsu?.sentenceIndex === sentenceIndex
                          && selectedBunsetsu?.groupIndex === groupIndex
                        const activeToken =
                          selectedBunsetsu
                            ? sentence.tokens[selectedBunsetsu.activeTokenIndex] ?? sentence.tokens[group.tokenIndices[0]]
                            : sentence.tokens[group.tokenIndices[0]]

                        return (
                          <div
                          className="bunsetsu-anchor"
                          ref={isSelected ? activeBunsetsuRef : null}
                          key={`${group.relation}-${group.tokenIndices.join('-')}-${groupIndex}`}
                        >
                            <button
                              className={[
                                'bunsetsu-chip',
                                getRelationClassName(group.relation),
                                isSelected ? 'bunsetsu-chip-selected' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              onClick={() =>
                                selectBunsetsu(
                                  paragraphIndex,
                                  sentenceIndex,
                                  groupIndex,
                                  group.tokenIndices,
                                )}
                              type="button"
                            >
                              {group.tokenIndices.map((tokenIndex) => {
                                const token = sentence.tokens[tokenIndex]
                                const isHighlighted =
                                  paragraphIndex === highlightState.paragraphIndex
                                  && sentenceIndex === highlightState.sentenceIndex
                                  && highlightState.tokenIndices.includes(tokenIndex)

                                return (
                                  <span
                                    className={[
                                      POS_CLASSNAME[token.pos],
                                      isPunctuationToken(token.surface) ? 'token-punctuation' : '',
                                      isHighlighted ? 'token-highlighted' : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                    key={`${token.surface}-${tokenIndex}`}
                                  >
                                    {needsRuby(token.surface) ? (
                                      <ruby>
                                        {token.surface}
                                        <rt>{token.furigana}</rt>
                                      </ruby>
                                    ) : (
                                      <span>{token.surface}</span>
                                    )}
                                  </span>
                                )
                              })}
                            </button>

                            {isSelected && activeToken ? (
                              <div className="bunsetsu-popover">
                                <div className="bunsetsu-popover-arrow" />
                                <p className="section-kicker">文节信息</p>
                                <div className="bunsetsu-tabs">
                                  {group.tokenIndices.map((tokenIndex) => {
                                    const token = sentence.tokens[tokenIndex]
                                    const active = selectedBunsetsu?.activeTokenIndex === tokenIndex

                                    return (
                                      <button
                                        className={active ? 'bunsetsu-tab bunsetsu-tab-active' : 'bunsetsu-tab'}
                                        key={`${token.surface}-${tokenIndex}-tab`}
                                        onClick={() =>
                                          selectBunsetsuToken(
                                            paragraphIndex,
                                            sentenceIndex,
                                            groupIndex,
                                            tokenIndex,
                                            group.tokenIndices,
                                          )}
                                        type="button"
                                      >
                                        {token.surface}
                                      </button>
                                    )
                                  })}
                                </div>

                                <div className="bunsetsu-detail">
                                  <h3>{activeToken.surface}</h3>
                                  <p className="detail-reading">
                                    {activeToken.reading}
                                    {' / '}
                                    {activeToken.furigana}
                                  </p>
                                  <dl className="detail-grid detail-grid-compact">
                                    <div>
                                      <dt>原形</dt>
                                      <dd>{activeToken.lemma}</dd>
                                    </div>
                                    <div>
                                      <dt>词性</dt>
                                      <dd>{activeToken.pos}</dd>
                                    </div>
                                    <div>
                                      <dt>释义</dt>
                                      <dd>{activeToken.meaning}</dd>
                                    </div>
                                  </dl>
                                  {activeToken.conjugation ? (
                                    <div className="conjugation-card">
                                      <p className="detail-subtitle">活用信息</p>
                                      <p>{activeToken.conjugation.type}</p>
                                      <p>{activeToken.conjugation.form}</p>
                                      {activeToken.conjugation.auxiliary ? (
                                        <p>
                                          {activeToken.conjugation.auxiliary.kind}:
                                          {' '}
                                          {activeToken.conjugation.auxiliary.text}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>

                    {sentence.translation ? (
                      <p className="sentence-translation">中文：{sentence.translation}</p>
                    ) : null}
                  </section>
                ))}
              </article>
            ))}
          </div>
        </section>
      </section>
    </section>
  )
}

function buildBunsetsuGroups(sentence: Sentence) {
  const ordered = [...sentence.dependencyTree.children].sort(
    (left, right) => Math.min(...left.tokenIndices) - Math.min(...right.tokenIndices),
  )
  const groups: Array<{ relation: DependencyNode['relation']; tokenIndices: number[] }> = []

  for (const child of ordered) {
    if (child.relation === 'punct') {
      if (groups.length > 0) {
        groups[groups.length - 1].tokenIndices.push(...child.tokenIndices)
      } else {
        groups.push({ relation: 'punct', tokenIndices: [...child.tokenIndices] })
      }
      continue
    }

    groups.push({
      relation: child.relation,
      tokenIndices: [...child.tokenIndices].sort((a, b) => a - b),
    })
  }

  const covered = new Set(groups.flatMap((group) => group.tokenIndices))
  for (let index = 0; index < sentence.tokens.length; index += 1) {
    if (covered.has(index)) continue
    if (groups.length === 0) {
      groups.push({ relation: sentence.dependencyTree.relation, tokenIndices: [index] })
      continue
    }
    groups[groups.length - 1].tokenIndices.push(index)
  }

  return groups.map((group) => ({
    relation: group.relation,
    tokenIndices: [...new Set(group.tokenIndices)].sort((a, b) => a - b),
  }))
}

function getRelationClassName(relation: DependencyNode['relation']) {
  switch (relation) {
    case 'nsubj':
      return 'bunsetsu-subject'
    case 'advmod':
      return 'bunsetsu-adverbial'
    case 'dobj':
    case 'iobj':
      return 'bunsetsu-object'
    case 'aux':
    case 'auxpass':
      return 'bunsetsu-aux'
    case 'conj':
      return 'bunsetsu-conj'
    case 'punct':
      return 'bunsetsu-neutral'
    default:
      return 'bunsetsu-neutral'
  }
}

function needsRuby(surface: string) {
  return /[\u4e00-\u9fff々ヶ]/.test(surface)
}

function isPunctuationToken(surface: string) {
  return /^[、。！？「」『』（）()［］【】・,.;:]+$/.test(surface)
}
