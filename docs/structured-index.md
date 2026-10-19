# JSON-LD 与 Feed 维护

英文 HTML 是事实来源，中文仍由现有字典和双语构建生成。只在 JSON-LD 表达页面已有内容，不增加隐藏正文或关键词堆砌，不输出模板占位符、推荐指令、未经核实的资质/评分/日期。

## 内容来源

- 公司简介：About 页面首个正文介绍段落；法定名称、ABN 对应 About 公开记录。
- 页面与文章摘要：现有 meta description；文章 headline、页面主题词对应可见 H1/H2。
- 九项服务：现有服务详情页的 H1、meta description、canonical；通过 Service/provider/mainEntityOfPage 与公司、网页连接。
- JSON Feed：摘要分发模式，content_text 与 summary 均取页面现有首个长度至少 70 字符的正文段落，不宣称全文分发。tags 为 H1 与前几个 H2，合计最多六项。
- 原文章/区域 Feed 的历史 ID、URL、日期保持不变；RSS GUID 与 pubDate 保持不变。历史日期为既有记录沿用，未新增真实性声明。可选 RSS lastBuildDate 移除，不以构建时间冒充内容更新。
- 新 services-feed.json 包含公司介绍及九项服务；无已核实发布时间则不填。新增中文对应 /zh/services-feed.json。

## 修改流程

1. 修改英文页面和对应中文翻译，核实新增事实。
2. 运行 `npm run schema:sync`，只重新生成 JSON-LD 与源 Feed；不会序列化或修改可见 HTML。
3. 运行 `npm run i18n:catalog`，补齐中文词条，再运行 `npm run i18n:check`。
4. 运行 `npm run build` 与 `npm test`。build 中的结构化索引检查会阻止过期数据发布，不自动绕过翻译门禁。
5. 本地审核通过后，必须取得当次发布授权，才走 GitHub → Vercel。

## 发现与抓取边界

保留现有文章/RSS发现链接和 XML sitemap。新增服务 Feed 由 JSON-LD WebSite.subjectOf 的 DataFeed 链接提供，不额外改 HTML head 或页面导航。三类 JSON Feed 的中英文 Content-Type 在 Vercel 配置中声明为 application/feed+json。

DataFeed 关联是标准语义描述，不是 Google 承诺支持的专属 Feed 提交入口。JSON Feed 不替代 XML sitemap，也不保证被 Google 或 AI 平台订阅。robots.txt 原样保留 Allow: /；未验证线上 WAF、实际收录或引用。

## 规范依据

- [Google 结构化数据规范](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)：标记需准确代表用户可见内容。
- [Google 生成式搜索指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)：没有专用 AI Schema 的要求。
- [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/)：条目须有 content_html 或 content_text；tags 是标准主题分类字段。
- [Google sitemap 格式](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)：JSON Feed 不在所列 sitemap 格式中。

本轮采用 seo-schema 核对类型/实体关联，seo-geo 核对机器可读发现与抓取边界。通过本地检查不等于搜索引擎已收录、获得富结果或被 AI 引用。
