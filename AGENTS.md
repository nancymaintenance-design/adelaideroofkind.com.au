# Adelaide Roof Kind 修改规则

遵守 E:/Ellis-Services/AGENTS.md。本站源码只在本目录修改；资料和报告放本站同级 obsidian、reports。

## 中英文同步

- 英文根目录 HTML 是内容与结构来源；简体中文 `/zh/` 页面由 `tools/bilingual.cjs` 与 `content/zh-Hans/*.json` 构建生成。不要直接编辑 dist 或手工维护第二套中文 HTML。
- 新增、改写或删除页面、服务说明、FAQ、价格、案例、表单、图片说明和元数据时，同批更新中文。任何缺失或过期的英文翻译键都会阻止构建；禁止退回英文冒充翻译、跳过检查或只发布一种语言的改动。
- 修改英文文案后运行 `npm run i18n:catalog`，补充或修订对应中文词条；保持 `{areaN}` 地名占位符、数字、价格、联系方式及事实一致。大小写不同的同一词条共用一份翻译。
- 运行 `npm run i18n:sync` 更新英语页面中的双语导航和语言标记，再运行 `npm run i18n:check` 与 `npm run build`。确认双向切换、中文内链、canonical/hreflang、站点地图和动态界面文字同步。
- 通用交互文案在 assets/js 中按页面 lang 提供两种语言；服务提交值继续使用 API 接受的原值，标签可以翻译。
- 屋顶术语统一：gutter 檐沟、downpipe 落水管、ridge capping 屋脊盖瓦、flashing 泛水板、valley 屋面谷沟、bedding 砂浆座层、repointing 重新勾缝、restoration 屋顶翻新、painting 屋顶喷涂。
- 新版本验收应覆盖英文和中文手机及桌面，检查标题、按钮、表单、菜单、FAQ、搜索与关键内链。保留原品牌、联系电话和邮箱，不增加未经证实的资质、施工、价格或服务承诺。

## 发布

本轮双语版本只供本地审核。没有用户针对该版本的明确部署授权，不 push、不触发远端构建、不部署。获准后仍走 GitHub → Vercel 自动构建。
