# 全网异动监控台

Cloudflare Pages 部署目录。

## 文件

- `index.html`: 前端页面。
- `data.json`: 静态兜底数据。实时接口失败时页面会读取它。
- `_worker.js`: Cloudflare Pages Functions Advanced mode。部署生效后，`/api/data` 会从东方财富公开接口获取 A 股行情、个股资金和板块资金。

## Cloudflare Pages 设置

连接 GitHub 仓库后使用这些设置：

- Framework preset: `None`
- Build command: 留空
- Build output directory: `.`
- Root directory: `/`

部署成功后检查：

1. 打开 `https://你的项目.pages.dev/api/data`
2. JSON 里应出现 `"source":"cloudflare-worker-eastmoney"`
3. 页面侧边栏应显示 `实时接口`

如果页面显示 `静态兜底`，说明 `_worker.js` 没有被 Cloudflare Pages Functions 执行。
