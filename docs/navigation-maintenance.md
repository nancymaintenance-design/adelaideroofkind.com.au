# 双语客户导航维护

适用本站：Ellis Services Group / https://www.adelaideroofkind.com.au/。不跨品牌复用联系方式或页面关系。

## 单一映射与现有构建

content/navigation-map.json 是导航关系、简短标签和相关资源的唯一来源。path 与 zhPath 均为明确存在的规范路径；不从 slug 或目录拆分猜父级。en/zh 标签和资源名称同批维护，basis 仅为内部选择依据，不输出到客户页面。

英文 HTML 和 content/zh-Hans 字典仍负责页面正文。tools/build-static.cjs 在现有 bilingual.buildBilingual 之后执行 navigation.applyNavigation，生成中英文的初始 HTML 导航、配套 BreadcrumbList、指南服务入口及服务页资源链接。因此不要直接修改 dist。没有新增客户端路由或外部组件依赖。

调整页面关系时，核对目标正文、核心需求和地区，不迁移现有 Owner。首页继续承接 broad Adelaide roof repairs；瓦片、屋脊、泛水板维修页承接具体构件需求。综合排水指南同时涉及清理和维修，保持行业指南栏目父级，通过两种明确服务按钮承接，不强指定单一商业页面。项目照片是服务页内锚点，不是独立案例页面。

上级服务页会自动展示真实下级指南，以及映射中明确列出的项目照片/相关指南。不能用资源标题暗示不存在的完工结果，尤其 roof-cleaning 的照片为清洗前状况。构建检查公开源页是否漏映射、父级存在、循环、语言、关联服务类型、资源路径与真实锚点。隐私工具页、别名及 404 不进入商业层级。

## 维护命令

1. 更新正文时沿用项目 i18n:catalog / i18n:sync / i18n:check；导航标签在映射 en/zh 同步更新。
2. npm run build：现有内容/翻译门禁 + 静态导航输出 + 现有 Clarity 安装。
3. node --test tests/breadcrumb-paths.test.mjs tests/breadcrumb-browser.test.mjs：映射、真实响应和浏览器路径检查。
4. node tools/navigation-report.cjs：实际 HTML a href 图、分语言 BFS 距离、按导航/面包屑/正文分别去重的来源页面及逐页映射；报告在同级 reports/breadcrumb-service-paths-2026-10-20。
5. npm test、npm run editor:typecheck；测试后再 build，恢复完整预览产物。项目没有独立 lint 命令，新增 JS 使用 node --check。

首次 --baseline 只在改动前执行，已有 before.json 会拒绝覆盖。统计不是从 URL 目录深度或 breadcrumb 节点数推算；同一来源页面多次链接只算一份支持，语言切换不算额外同语言支持。不要把导航新增链接、正文重复按钮误报为新增来源页面。

## 行为测量与平台待配置

本轮未发现运行中的 GA4/GTM loader/config，也没有可访问的本站 GSC/GA4 数据或有效询盘导出；不安装第二套追踪、不冒用其他站点 ID。现有 Clarity 及同意设置、表单 API 与提交成功逻辑保持原样。

将来核实并获准使用本站分析配置后，记录 breadcrumb_click（非获客转化）：source_path、target_path、locale、position、owner_id。现有 data-breadcrumb、data-breadcrumb-position 和 data-owner-id 可供一个委托监听器读取。只允许映射中的规范 pathname；去除 query/hash，不读表单值或上传 PII；使用原有同意状态，不在未同意时补发队列。不要同时调用 gtag 与推送重复 GTM 事件。平台监听器、GA4 自定义维度、DebugView 验证在未配置前均不得宣称已完成。

表单成功只在服务器接受成功后计数，电话点击仅表示点击、邮件点击仅表示打开邮件入口；有效询盘必须与实际收到的咨询单独核对。本轮未新增分析发送脚本，现有电话与咨询行为不受拦截。

部署前取完整 28 天为基线；部署后 28/56 天用相同 Owner/查询组，按语言、设备、地区、品牌/非品牌比较展示、自然点击、平均排名和实际有效询盘。对外只报告真实数据，未取得数据用 null/未验证，不以 0 代替，不将同时发生的其他变化全归因给导航。此次未发布，观察周期尚未开始。
