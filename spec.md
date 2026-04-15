## 日语文章阅读器

请在当前 YomiLens 全栈项目中实现一个“日语文章阅读学习器”（类似捧读 App 的核心功能）。

- 前端：基于现有 React + TypeScript + Vite 项目实现阅读页面与交互。
- 后端：基于现有 Deno + Hono 服务提供解析接口，并在服务端调用 DeepSeek API。
- API Key：保存在服务端 `.env` 文件中，前端不得直接持有或调用 DeepSeek API。

## 功能需求

1. **API 集成**：用户输入或粘贴日语文本，点击“解析”按钮后，由前端调用项目后端接口，再由后端调用 DeepSeek API，返回结构化的日语分析结果。
2. **文章渲染**：将 API 返回的 JSON 数据渲染为美观、可交互的日语文章阅读界面。需要支持：
   - 分段、分句显示。
   - 每个单词（token）独立显示，标点符号也作为 token 返回并参与渲染；前端根据词性（名词、动词、形容词、助词等）显示不同的背景色（前端映射）。
   - 鼠标点击任意单词时，在右侧详情面板显示该单词的详细信息：表层形、原形、读音（片假名）、词性、中文释义、活用信息（如果有）。
   - 每个句子下方显示其中文翻译。
   - 每个单词用 `ruby` 标签显示振假名，振假名内容来自 token 的 `furigana` 字段。
   - 如果 API 返回了语法提示（grammarTips），在句子下方以标签形式展示；点击语法提示时，高亮其关联的 token。
   - 需要展示依存关系信息。`dependencyTree` 为必需字段，前端至少需要在句子区域或详情区域中以可读方式展示句子的依存结构，不能仅保留字段不渲染。
3. **示例数据**：页面加载时自动展示一个示例文章（例如「吾輩は猫である」的解析结果），无需调用 API，让用户立即看到效果。示例数据需符合下面的数据结构。
4. **错误处理与调试**：如果 API 调用失败或返回的 JSON 格式有误，在页面上显示友好的错误信息。同时，在右侧面板底部增加一个“显示模型原始输出”的可折叠区域，展示 DeepSeek API 返回的原始 JSON 文本，方便调试格式问题。
5. **用户体验**：解析过程中显示 loading 状态；API 请求设置 30 秒超时；API Key 存在服务的.env文件

## 数据结构（简化版）

请按照以下简化后的 Token 结构设计前端渲染逻辑（与后端 API 约定的格式一致）：

```typescript
// ==================== 枚举定义 ====================

// 词性大类
export enum Pos {
  名詞 = "名詞",
  動詞 = "動詞",
  形容詞 = "形容詞",
  形容動詞 = "形容動詞",
  助詞 = "助詞",
  助動詞 = "助動詞",
  副詞 = "副詞",
  連体詞 = "連体詞",
  接続詞 = "接続詞",
  感動詞 = "感動詞",
  代名詞 = "代名詞",
  接頭辞 = "接頭辞",
  接尾辞 = "接尾辞",
}

// 依存关系类型
export enum Relation {
  root = "root",
  nsubj = "nsubj",
  dobj = "dobj",
  iobj = "iobj",
  advmod = "advmod",
  aux = "aux",
  auxpass = "auxpass",
  mark = "mark",
  case = "case",
  nmod = "nmod",
  amod = "amod",
  det = "det",
  neg = "neg",
  cc = "cc",
  conj = "conj",
  punct = "punct",
  compound = "compound",
  nummod = "nummod",
}

// 难度级别
export enum Difficulty {
  beginner = "beginner",
  intermediate = "intermediate",
  advanced = "advanced",
}

// 活用类别（精简版）
export enum ConjugationType {
  五段 = "五段",
  一段 = "一段",
  カ変 = "カ変",
  サ変 = "サ変",
  形容詞 = "形容詞",
  形容動詞 = "形容動詞",
}

// 活用形（学校文法，区分两种未然形和两种连用形）
export enum ConjugationForm {
  未然形A = "未然形A",
  未然形B = "未然形B",
  連用形A = "連用形A",
  連用形B = "連用形B",
  終止形 = "終止形",
  連体形 = "連体形",
  仮定形 = "仮定形",
  命令形 = "命令形",
}

// 附属词种类
export enum AuxiliaryKind {
  助動詞 = "助動詞",
  助詞 = "助詞",
}

// ==================== 接口定义 ====================

// 活用信息（仅动词、形容词等需要）
export interface Conjugation {
  type: ConjugationType;        // 活用类别
  form: ConjugationForm;        // 活用形
  auxiliary?: {                 // 接续的附属词（可选）
    kind: AuxiliaryKind;
    text: string;               // 如 "ない", "ます", "て", "た", "う", "よう", "ば"
  };
}

// 词元（Token）
export interface Token {
  surface: string;          // 表层形
  lemma: string;            // 原形（辞书形）
  reading: string;          // 读音（片假名，用于详情面板展示）
  furigana: string;         // 振假名纯文本，用于 ruby 展示
  pos: Pos;                 // 词性大类
  meaning: string;          // 中文释义
  conjugation?: Conjugation; // 活用信息（仅可活用词有）
}

// 依存树节点
export interface DependencyNode {
  text: string;                 // 文节文本
  tokenIndices: number[];       // 该文节包含的词元在句子 tokens 数组中的索引
  relation: Relation;           // 依存关系
  children: DependencyNode[];   // 子节点
}

// 语法推荐
export interface GrammarTip {
  point: string;                // 语法点名称（如 "〜てしまう"）
  description: string;          // 说明
  difficulty: Difficulty;       // 难度
  tokenIndices: number[];       // 关联的词元索引
}

// 句子
export interface Sentence {
  originalText: string;         // 句子原文
  tokens: Token[];              // 词元列表
  translation?: string;         // 句子翻译
  dependencyTree: DependencyNode; // 依存树的根节点（必需）
  grammarTips?: GrammarTip[];   // 语法推荐列表（可选）
}

// 段落
export interface Paragraph {
  originalText: string;         // 段落原文
  sentences: Sentence[];        // 句子列表
}

// 文章
export interface ParsedArticle {
  title?: string;              // 文章标题（可选）
  paragraphs: Paragraph[];      // 段落列表
}

```

## API 调用细节

- 项目内前后端接口约定：

```ts
POST /api/articles/parse

// request
{
  text: string
}

// response
{
  article: ParsedArticle
  rawModelOutput: string
}

// error response
{
  error: string
  rawModelOutput?: string
}
```

- 前端只调用项目自己的 `/api/articles/parse` 接口，不直接请求 DeepSeek。
- 后端负责读取 `.env` 中的 API Key，组装 prompt，请求 DeepSeek，并校验返回 JSON 结构。
- 请求地址：`https://api.deepseek.com/v1/chat/completions`
- 请求头：`Authorization: Bearer {API Key}`，`Content-Type: application/json`
- 请求体参考：

```json
{
  "model": "deepseek-chat",
  "messages": [
    {"role": "system", "content": "你是一个日语自然语言处理专家，请输出符合上述结构的JSON..."},
    {"role": "user", "content": "{用户输入的日语文章}"}
  ],
  "response_format": {"type": "json_object"}
}
```

其中 system prompt 需包含对输出格式的严格要求，明确要求输出纯 JSON，字段需与上面的 TypeScript 接口一致，至少包含 `paragraphs`，可选包含 `title`，且必须包含 `dependencyTree`。在服务端调用大模型。

后端需要对模型输出做两层校验：

- 第一层：是否为合法 JSON。
- 第二层：是否符合 `ParsedArticle` 结构；如果不符合，需要向前端返回错误信息，并尽可能附带 `rawModelOutput` 供调试。

## 前端样式要求

- 现代、清爽、类似笔记应用的风格，白色背景，圆角卡片，适合阅读。
- 响应式布局：左侧为文章阅读区，右侧为详情面板（宽度约 320px），移动端自动堆叠。
- 词性着色规则：名词用浅蓝色、动词用浅橙色、形容词用浅绿色、助词用浅灰色等。
- 右侧底部有可折叠区域，展示 API 原始返回的 JSON（便于调试）。

## 实现说明

- 当前仓库不是单文件 HTML Demo，而是已有前后端分离项目；实现应基于现有项目结构完成，不新增“独立 HTML 页面”作为主交付物。
- 示例数据建议以前端本地 mock 数据形式内置，确保页面首屏无需依赖后端即可看到完整效果。
- 解析失败时，前端应保留最近一次成功解析的文章内容，同时单独展示错误状态与调试信息。
