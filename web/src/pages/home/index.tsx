import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { mockArticleText } from "./mock-article";
import type { Chunk, ParsedArticle, Pos } from "../../types";

type ParseErrorState = {
  message: string;
} | null;

type SelectionState = {
  paragraphIndex: number;
  sentenceIndex: number;
  chunkIndex: number;
  activeTokenIndex: number;
} | null;

const POS_CLASSNAME: Record<Pos, string> = {
  名詞: "token token-noun",
  動詞: "token token-verb",
  形容詞: "token token-adjective",
  形容動詞: "token token-adjectival-noun",
  助詞: "token token-particle",
  助動詞: "token token-auxiliary",
  副詞: "token token-adverb",
  連体詞: "token token-attributive",
  接続詞: "token token-conjunction",
  感動詞: "token token-interjection",
  代名詞: "token token-pronoun",
  接頭辞: "token token-prefix",
  接尾辞: "token token-suffix",
  記号: "token token-punctuation",
};

export function HomePage() {
  const [input, setInput] = useState(mockArticleText);
  const [article, setArticle] = useState<ParsedArticle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ParseErrorState>(null);
  const [selection, setSelection] = useState<SelectionState>(null);
  const activeChunkRef = useRef<HTMLDivElement | null>(null);

  async function requestParse(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      setError({ message: "请输入要解析的日语文章。" });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api.parseArticle(trimmed);
      setArticle(result.article);
      setSelection(findInitialSelection(result.article));
    } catch (err) {
      const message = err instanceof Error ? err.message : "解析失败";
      setError({ message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void requestParse(mockArticleText);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!selection) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (activeChunkRef.current?.contains(target)) return;
      setSelection(null);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [selection]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestParse(input);
  }

  const selectedContext = useMemo(() => {
    if (!article || !selection) return null;
    const paragraph = article.paragraphs[selection.paragraphIndex];
    const sentence = paragraph?.sentences[selection.sentenceIndex];
    const chunk = sentence?.chunks[selection.chunkIndex];
    const token =
      sentence?.tokens.find((item) => item.index === selection.activeTokenIndex) ??
      (chunk ? sentence.tokens[chunk.tokenIndices[0]] : null);

    if (!sentence || !chunk || !token) return null;
    return { sentence, chunk, token };
  }, [article, selection]);

  return (
    <section className="reader-layout">
      <section className="reader-main">
        <form className="composer-card" onSubmit={handleSubmit}>
          <div className="composer-head">
            <div>
              <p className="section-kicker">Input</p>
              <h2>请求本地 parse 接口</h2>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "解析中…" : "重新解析"}
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
              <p className="section-kicker">Result</p>
              <h2>{article?.title ?? "本地解析结果"}</h2>
            </div>
            <p className="article-status">默认展示语块；点语块看 token 详情</p>
          </div>

          <div className="article-flow">
            {article?.paragraphs.map((paragraph, paragraphIndex) => (
              <article className="paragraph-card" key={`${paragraph.originalText}-${paragraphIndex}`}>
                {paragraph.sentences.map((sentence, sentenceIndex) => (
                  <section className="sentence-card" key={`${sentence.originalText}-${sentenceIndex}`}>
                    <div className="chunk-row">
                      {sentence.chunks.map((chunk, chunkIndex) => {
                        const isSelected =
                          selection?.paragraphIndex === paragraphIndex &&
                          selection?.sentenceIndex === sentenceIndex &&
                          selection?.chunkIndex === chunkIndex;

                        return (
                          <div
                            className="chunk-anchor"
                            key={`${sentence.originalText}-${chunkIndex}`}
                            ref={isSelected ? activeChunkRef : null}
                          >
                            <button
                              className={[
                                "chunk-chip",
                                getChunkClassName(chunk),
                                isSelected ? "chunk-chip-selected" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              type="button"
                              onClick={() =>
                                setSelection({
                                  paragraphIndex,
                                  sentenceIndex,
                                  chunkIndex,
                                  activeTokenIndex: chunk.tokenIndices[0],
                                })}
                            >
                              {chunk.tokenIndices.map((tokenIndex) => {
                                const token = sentence.tokens[tokenIndex];
                                const isActive = isSelected && selection?.activeTokenIndex === tokenIndex;

                                return (
                                  <span
                                    className={[
                                      POS_CLASSNAME[token.pos],
                                      isPunctuationToken(token.surface) ? "token-punctuation" : "",
                                      isActive ? "token-highlighted" : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                    key={`${token.surface}-${token.index}`}
                                  >
                                    {needsRuby(token.surface) && token.furigana ? (
                                      <ruby>
                                        {token.surface}
                                        <rt>{token.furigana}</rt>
                                      </ruby>
                                    ) : (
                                      <span>{token.surface}</span>
                                    )}
                                  </span>
                                );
                              })}
                            </button>

                            {isSelected && selectedContext?.chunk.index === chunk.index ? (
                              <div className="chunk-popover">
                                <div className="chunk-popover-arrow" />
                                <p className="section-kicker">Chunk</p>
                                <div className="chunk-tabs">
                                  {chunk.tokenIndices.map((tokenIndex) => {
                                    const token = sentence.tokens[tokenIndex];
                                    const active = selection?.activeTokenIndex === tokenIndex;

                                    return (
                                      <button
                                        className={active ? "chunk-tab chunk-tab-active" : "chunk-tab"}
                                        key={`${token.surface}-${token.index}-tab`}
                                        type="button"
                                        onClick={() =>
                                          setSelection({
                                            paragraphIndex,
                                            sentenceIndex,
                                            chunkIndex,
                                            activeTokenIndex: tokenIndex,
                                          })}
                                      >
                                        {token.surface}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="chunk-detail">
                                  <h3>{selectedContext.token.surface}</h3>
                                  <p className="detail-reading">
                                    {selectedContext.token.reading}
                                    {selectedContext.token.furigana
                                      ? ` / ${selectedContext.token.furigana}`
                                      : ""}
                                  </p>
                                  <dl className="detail-grid detail-grid-compact">
                                    <div>
                                      <dt>原形</dt>
                                      <dd>{selectedContext.token.lemma}</dd>
                                    </div>
                                    <div>
                                      <dt>词性</dt>
                                      <dd>{selectedContext.token.pos}</dd>
                                    </div>
                                    <div>
                                      <dt>语块</dt>
                                      <dd>{selectedContext.chunk.text}</dd>
                                    </div>
                                    <div>
                                      <dt>语块角色</dt>
                                      <dd>{selectedContext.chunk.roleHint}</dd>
                                    </div>
                                  </dl>
                                  {selectedContext.token.conjugation ? (
                                    <div className="conjugation-card">
                                      <p className="detail-subtitle">活用信息</p>
                                      <p>{selectedContext.token.conjugation.type}</p>
                                      <p>{selectedContext.token.conjugation.form}</p>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </article>
            ))}
          </div>
        </section>
      </section>
    </section>
  );
}

function findInitialSelection(article: ParsedArticle): SelectionState {
  for (const [paragraphIndex, paragraph] of article.paragraphs.entries()) {
    for (const [sentenceIndex, sentence] of paragraph.sentences.entries()) {
      const firstChunk = sentence.chunks[0];
      if (firstChunk) {
        return {
          paragraphIndex,
          sentenceIndex,
          chunkIndex: firstChunk.index,
          activeTokenIndex: firstChunk.tokenIndices[0],
        };
      }
    }
  }

  return null;
}

function getChunkClassName(chunk: Chunk) {
  switch (chunk.roleHint) {
    case "subject":
      return "chunk-subject";
    case "topic":
      return "chunk-conj";
    case "object":
      return "chunk-object";
    case "modifier":
      return "chunk-adverbial";
    case "predicate":
      return "chunk-aux";
    default:
      return "chunk-neutral";
  }
}

function needsRuby(surface: string) {
  return /[\u4e00-\u9fff々ヶ]/.test(surface);
}

function isPunctuationToken(surface: string) {
  return /^[、。！？「」『』（）()［］【】・,.;:]+$/.test(surface);
}
