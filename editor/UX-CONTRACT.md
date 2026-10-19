# 本地后台操作约定

当前用户请求是复用Perth Handymate模式的本地后台和桌面入口；没有本轮发布授权。事实来源为本站 AGENTS.md、docs/local-editor-guide.md 和现有业务页面；不改变运营条款。

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | ui/client.ts + native select | 用户要求复用前两站后台 | 平台菜单 | ../tests/local-editor-browser.test.mjs |
| Form | ui/client.ts | 保存中文草稿，英文只读 | 正文/FAQ/SEO/alt | ../tests/local-editor-content.test.mjs |
| Scrollbar | ui/editor.css + ui/field-design.css | 既有后台令牌 | 预览与自然文档滚动 | ../tests/local-editor-browser.test.mjs |
| Toast | ui/client.ts message + #status live region | 统一保存/错误反馈 | 成功/冲突/失败 | ../tests/local-editor-browser.test.mjs |
| CRUD | ../tools/editor/server.mts + store.mts | 仅本地草稿及历史 | 不提供删除/上线 | ../tests/local-editor.test.mjs |

## 状态与安全

成功保存留在本页；未保存切换需确认；失败保留输入。搜索39页清单（37个正式页面、隐私说明、404）、支持清除、IME完成后更新；短时搜索不持久化，当前页保留URL page参数。原生选择框使用平台键盘交互。历史保留20次，恢复追加修订。

Host/Origin/token共同保护仅127.0.0.1后台，token不进入URL或磁盘。草稿保存与正式源码/译文应用分开；英文待当前助手同步，不调用外部翻译。联系方式、价格、共享导航/页尾锁定。页面或译文基线变化必须核对旧草稿，不能覆盖。启动指纹检查覆盖源码、翻译及构建输入，复用运行服务前也检查。

预览移除网站脚本、外部地图和询盘动作，只保留同源编辑桥；保存内容是纯文本，不执行HTML。路径只能读取登记页面及允许的成品资源，真实路径必须在允许目录内。后台属于同机可信维护工具，不是公网多用户认证系统。
