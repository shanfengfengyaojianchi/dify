# 工作间 · AI 工具超市

10 款中文业务工具：探店脚本、工厂宣传、小红书文案、短视频选题、商品卖点、客服、销售跟进、会议纪要、周报、资料提取。

每款有独立表单、业务规则和固定案例。结果支持复制、文本/Markdown 下载，资料提取支持 CSV。示例是预先编写的案例，不是实时 AI 结果。未配置时明确显示示例模式；配置后通过服务器调用 Dify。

## 本地运行

需要 Node.js 22.13+、npm。

```bash
npm ci
cp .env.example .env.local
npm run dev -- --host 127.0.0.1 --port 5173
```

打开终端的 Local URL。无密钥也能查看示例和下载模板；不要提交 `.env.local`。

## Dify 配置

见 [连接说明](docs/DIFY_SETUP.md)。最快导入 `dify/00-shared-toolkit.yml`，选择模型、测试、发布，设置 `DIFY_API_KEY`，一次接通全部工具；也可以独立导入 `01-*` 到 `10-*` 配置各自密钥。

模板的模型为可替换样例，必须配置两个 LLM 节点。当前未完成真实 Dify 导入和运行验收。

## 检查与构建

```bash
node --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

测试覆盖资料校验、工作流路由、无密钥、上游报错、格式检查、CSV 公式防护及 11 份模板结构。

更新工具定义后：

```bash
node scripts/generate-dify.mjs
python3 scripts/package-dify.py
```

生成脚本使用已有依赖的 js-yaml；Python 打包只需标准库。下载包位于 `public/dify/workroom-dify-templates.zip`。

## 部署与范围

Sites 私有发布，React/Vinext 前端，Cloudflare Workers 后端。保留 `.openai/hosting.json` 的项目标识。环境变量通过部署平台配置。

首版不包含支付、历史数据库、音视频生成或对外发消息。客服和销售输出是草稿。资料在用户点击后发送到 Dify 和模型服务，不建立额外业务数据库。内存限流仅对单个 Worker 实例有效，公开商业运营前需要正式权限和配额管理。

`lib/catalog.json` 为工具定义，`lib/examples.json` 为固定案例，`lib/core.mjs` 为 Dify 适配器，`app/api` 为服务端接口，`dify` 为工作流模板，`.env.example` 为不含密钥的配置示例。
