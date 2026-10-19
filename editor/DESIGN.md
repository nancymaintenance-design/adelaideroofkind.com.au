---
version: alpha
colors:
  primary: "#075873"
  navy: "#102b3a"
  surface: "#ffffff"
  background: "#edf5f7"
  accent: "#f3b63f"
  text: "#172f3d"
typography:
  body:
    fontFamily: "Arial, Helvetica, Microsoft YaHei, sans-serif"
rounded:
  panel: "14px"
  control: "6px"
---

# Adelaide Roof Kind 本地后台

## Overview

受众为中文网站维护者，单一任务是准确修改现有内容并保存本地草稿。用户明确要求“和Perth Handymate一样、最快完成”，因此直接复用其双栏预览/编辑界面、类型化操作及蓝白令牌，不重做公共网站。配对英文只读，中文草稿保存后交助手同步，发布另行授权。

## Colors

运行时令牌由 ui/field-design.css 拥有；本文件镜像其 --field-blue/navy/light/yellow/text。ui/editor.css 的 --editor-surface 拥有白色面板。采用既有令牌系统（Model B），不新增一套主题或改变公共 assets/css/global.css。

## Typography

系统无衬线、中文回退字体及清晰工具标题，沿用前两站后台；运行时15px正文、1.6行高。界面中文，网站英文只读对照；修订时间使用北京时间，与现有后台一致。不涉及日语或日本市场。

## Layout

桌面左侧原页面预览、右侧文字编辑，顶部页面搜索及选择。预览有自己的滚动区，编辑面板采用自然文档高度。手机顺序堆叠，不隐藏保存操作。原生 select 的系统弹出菜单是明确选择，避免为本次复用额外引入组件框架。

## Shapes

面板14px、控件6px，来源为现有 CSS；无装饰性动画，保留可见滚动条及键盘焦点。

## Components

操作与错误沿用 ui/client.ts 的统一 message/controls、应用 dialog、IME 保护与状态反馈。恢复历史需要确认，保存不弹多余确认；详见 UX-CONTRACT.md。预览中的“可编辑文字”描边只在指向或焦点时出现，不写入正式网站。

## Do's and Don'ts

保留熟悉操作，不增加自动翻译、云同步、自动发布或网站改版。后台不进入 sitemap/dist；草稿是磁盘文件，不是浏览器缓存。
