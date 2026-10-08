# 工作间：连接 Dify

未配置 Dify 时，网页只能查看预设案例。示例不会随新输入改变，也不调用模型。

## 一次导入，接通 10 个工具

1. 登录 Dify，在模型供应商设置里配置你可用的模型。
2. 在工作室选择“导入 DSL 文件”，上传 `00-shared-toolkit.yml`。
3. 打开“生成草稿”和“事实与格式校对”两个 LLM 节点，分别选择已配置的文本模型。模板中的 `langgenius/openai/openai / gpt-4o` 是可替换的样例，不是已接通的模型，可以选其他供应商。
4. 测试输入 `tool_id=store-script`，`input_data={"store_name":"巷口咖啡","highlights":"桂花拿铁28元，提供外带","audience":"周边上班族","duration":"60 秒"}`。结束节点应返回 `result`。
5. 测试通过后发布，在应用的 API 访问页面创建该应用的 API Key。
6. 本地复制 `.env.example` 为 `.env.local`，在文件里填写 `DIFY_API_KEY`；云端在站点服务器环境变量里设置同名 secret，并重新部署。
7. 重启本地服务、刷新页面。网页“已配置”仅表示读取到了密钥，真实生成成功后才能确认连接有效。
8. 依次测试所有工具，检查表格、未授权承诺、未确定负责人等边界。

## 独立管理每款工具

导入编号 01–10 的文件；对每个应用重复“选择两个节点的模型、测试、发布、创建应用 API Key”。

| 工具 | 文件 | 服务器密钥变量 |
| --- | --- | --- |
| 探店脚本 | 01-store-script.yml | DIFY_KEY_STORE_SCRIPT |
| 工厂宣传脚本 | 02-factory-script.yml | DIFY_KEY_FACTORY_SCRIPT |
| 小红书文案 | 03-social-copy.yml | DIFY_KEY_SOCIAL_COPY |
| 短视频选题 | 04-video-topics.yml | DIFY_KEY_VIDEO_TOPICS |
| 商品卖点提炼 | 05-product-benefits.yml | DIFY_KEY_PRODUCT_BENEFITS |
| 客服回复 | 06-customer-reply.yml | DIFY_KEY_CUSTOMER_REPLY |
| 销售跟进 | 07-sales-followup.yml | DIFY_KEY_SALES_FOLLOWUP |
| 会议纪要 | 08-meeting-notes.yml | DIFY_KEY_MEETING_NOTES |
| 工作周报 | 09-weekly-report.yml | DIFY_KEY_WEEKLY_REPORT |
| 资料提取 | 10-data-extractor.yml | DIFY_KEY_DATA_EXTRACTOR |

单工具密钥优先，未配置单工具密钥才使用统一入口。没有对应密钥不会调用 Dify。

## 验证边界

模板为“填写资料 → 生成草稿 → 事实与格式校对 → 返回 result”。提取工具返回 `{"columns":["字段名"],"rows":[["文本值"]]}`，其他工具输出 Markdown。

依据 Dify 官方 Workflow DSL 样例制作，版本 0.4.0。项目检查程序验证文件解析、变量引用、节点连接、输出映射；当前没有 Dify 账号，尚未完成实际导入、模型执行和内容质量验收。遇到模型依赖缺失，请安装相应插件或为两个节点重新选择工作空间中的可用模型。

## 地址、费用和常见情况

- 云端默认地址 `https://api.dify.ai/v1`；自建用 API 访问页面的 Service API 地址。云端网站无法访问你电脑上的 localhost。
- 页面调用自己的 `/api/generate`，服务器调用 Dify 的 `/workflows/run`，密钥不返回浏览器。不要把密钥放在 `NEXT_PUBLIC_*`、源码、截图或聊天中。
- blocking 响应等待上限 90 秒；复杂流程可以后续改为流式。每次运行通常两次模型调用，费用由你的 Dify/模型账户承担。
- 尚未配置：检查环境变量，并重启或重新部署。
- 密钥无效：使用应用 API Key，而非模型供应商密钥。
- 工作流失败：先在 Dify 测试并发布，检查两个 LLM 节点和日志。
- 无有效文本：结束节点的 `result` 必须指向校对节点 `text`。
- 表格格式错误：JSON 必须包含 columns/rows，单元格为字符串，行宽一致。

参考：[API 入门](https://docs.dify.ai/en/api-reference/guides/get-started)、[执行工作流](https://docs.dify.ai/en/api-reference/workflow-runs/run-workflow)、[官方 DSL 样例](https://github.com/langgenius/dify/blob/main/scripts/stress-test/setup/dsl/workflow_llm.yml)。
