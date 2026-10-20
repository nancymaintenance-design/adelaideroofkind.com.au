# 双语 llms.txt 维护

适用网站仅为 `https://www.adelaideroofkind.com.au/`（Ellis Services Group）。英文根 HTML、现有中文字典及生成页仍是事实与 Owner URL 来源。不要从同账号其他网站复制品牌、服务或联系方式。

## 单一内容源

手工精选的根 `llms.txt` 是唯一可编辑目录。构建时原样复制到既有 `/zh/llms.txt`，保留兼容地址，不再按 sitemap 全量生成第二份目录。正文采用 UTF-8 Markdown；每个链接有独立说明，中英 Owner 分别链接，项目照片仅使用已有锚点。

不生成 llms-full.txt 或公开 .md 页面副本。不把这个可选导航描述成 Google 排名、索引或 AI 推荐开关。

## 更新流程

1. 阅读目标页现有正文后修改目录名称/摘要；一个语言变动同时核对对应语言。照片为清洗前状况时不能改写为完工证明。
2. 保持原 Owner URL 和语言配对。新增或删除服务须先确认实际服务范围；不要为了目录创建同义页或批量增加街区页。
3. `npm run build`：按既有双语构建生成候选文件，不联网、调用模型或按请求重新抓站。
4. `npm run llms:check`：确定性检查格式、必要双语入口、目标文件、初始正文、canonical、hreflang、noindex、sitemap、案例锚点和已有内链。该命令不代替人工事实审校。
5. `npm run llms:live`：明确执行只读 GET，低并发 2、15 秒超时及最多一次重试；同一正文 URL 复用响应，记录每个候选链接的最终 URL、状态、正文摘录、语言和索引标记。另抽样四种搜索 User-Agent 访问中英首页。超时记为传输失败，不直接称网站 404。
6. `npm test`：全套回归。测试包括真实本地 GET、不同 Accept-Language、同一中英文文件输出、错误目录、none/noindex 和报告版本错配。

## 报告解释

内部结果写在本站同级 `reports/llms-bilingual-YYYY-MM-DD/`，执行日期按 Asia/Singapore。它们不进入 dist。

- `selection-and-evidence.json`：精选项、用途、配对、Owner、纳入原因、正文摘录及本地检查；摘录不保证覆盖摘要每项事实，人工需看完整目标正文。
- `language-pairs.md`：英文、中文及案例锚点逐一配对。
- `live-access.json`：该次真实网络检查；`candidatePublished` 根据正式文件是否与候选相同得出，不能把正常的旧文件 GET 当成候选已上线。
- `verification-state.json`：本地候选 SHA-256、页面内容快照、最近线上时间和问题数量。`liveAppliesToCurrentCandidate` 仅说明版本匹配，不等于检查通过或仍然新鲜；查看线上检查时间及 issues。版本不符必须重跑 `llms:live`。

本地校验保留先前网络报告，不静默宣称其已验证新内容。公开文件不写每日更新时间；只有内容或导航实际变化才修改。

## 安全与发布

不要顺手更改 URL、Owner、canonical、hreflang、robots、训练爬虫策略、WAF 或后台访问控制。有问题先记录证据及最小建议，另行审批。

模拟 User-Agent 只能证明测试请求可达；真实 bot 需要日志和官方身份验证。当前通用 robots 策略原样保留，搜索与训练用途不混淆。

本轮只本地交付，不推送、不合并 main、不发布。日后获明确上线授权后，先检查自动部署影响，按 GitHub → Vercel 发布，再 GET 正式 `/llms.txt` 与 `/zh/llms.txt` 复验；回退仅限本任务文件，不覆盖其他成果。
