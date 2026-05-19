/**
 * Cloudflare Pages Function - /api/public/help
 * 返回 API 使用文档（Markdown 格式）
 * 公开访问，无需认证
 */

import { handleOptions } from '../../_shared/authMiddleware.js';

export const onRequest = async (context) => {
    const { request, env } = context;

    if (request.method === 'OPTIONS') {
        return handleOptions(request);
    }

    if (request.method !== 'GET') {
        return new Response('Method not allowed', { status: 405 });
    }

    const accept = request.headers.get('Accept') || '';
    const wantsJson = accept.includes('application/json');

    const markdown = buildHelpDocument();

    if (wantsJson) {
        return new Response(JSON.stringify({
            success: true,
            data: {
                format: 'markdown',
                content: markdown
            }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    return new Response(markdown, {
        status: 200,
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        }
    });
};

function buildHelpDocument() {
    return `# 场外基金收益计算器 - Public API

## 概述

本 API 提供基金和交易数据的访问接口。读取操作公开，写入操作需认证。

## 认证

- **读取操作（GET）**：无需认证，直接访问
- **写入操作（POST）**：需在 Header 传递 \`X-API-Key\`

获取 API Key 请联系系统管理员。

## 端点列表

### 基金数据

#### GET /api/public/funds
获取全部基金列表

**参数**: 无

**响应示例**:
\`\`\`json
{
  "success": true,
  "data": [
    {
      "syncId": "fund_xxx",
      "id": "xxx",
      "name": "易方达蓝筹",
      "code": "005827",
      "netValue": 1.2345,
      "estimatedValue": 1.2350,
      "feeTiers": {...}
    }
  ],
  "meta": { "total": 5, "timestamp": "2026-05-12T10:00:00Z" }
}
\`\`\`

---

#### GET /api/public/funds/:code
获取单个基金信息

说明：\`:code\` 是路径占位符，实际调用时要替换为真实基金代码。
例如：\`/api/public/funds/005827\`

**参数**:
- \`code\` (路径参数): 基金代码，如 \`005827\`

**响应示例**:
\`\`\`json
{
  "success": true,
  "data": {
    "syncId": "fund_xxx",
    "id": "xxx",
    "name": "易方达蓝筹",
    "code": "005827",
    "netValue": 1.2345,
    "estimatedValue": 1.2350
  },
  "meta": { "timestamp": "2026-05-12T10:00:00Z" }
}
\`\`\`

---

### 交易记录

#### GET /api/public/trades
获取交易记录列表

**参数**:
- \`fundCode\` (query, 可选): 按基金代码过滤，如 \`?fundCode=005827\`

**响应示例**:
\`\`\`json
{
  "success": true,
  "data": [
    {
      "syncId": "trade_xxx",
      "fundId": "fund_xxx",
      "date": "2024-01-15",
      "type": "buy",
      "netValue": 1.2345,
      "shares": 1000,
      "amount": 1234.50,
      "fee": 1.23,
      "remark": ""
    }
  ],
  "meta": {
    "total": 50,
    "filters": { "fundCode": "005827" },
    "timestamp": "2026-05-12T10:00:00Z"
  }
}
\`\`\`

---

#### GET /api/public/trades/:fundCode
获取指定基金的交易记录

**参数**:
- \`fundCode\` (路径参数): 基金代码，如 \`005827\`

**响应示例**:
\`\`\`json
{
  "success": true,
  "data": {
    "fund": { "code": "005827", "name": "易方达蓝筹" },
    "trades": [...]
  },
  "meta": { "total": 10, "fundCode": "005827", "timestamp": "2026-05-12T10:00:00Z" }
}
\`\`\`

---

#### POST /api/public/trades
添加交易记录（需认证）

**Header**: \`X-API-Key: <your-key>\`

**请求体**:
\`\`\`json
{
  "fundCode": "005827",
  "date": "2024-01-15",
  "type": "buy",
  "netValue": 1.2345,
  "shares": 1000,
  "amount": 1234.50,
  "fee": 1.23,
  "remark": ""
}
\`\`\`

**必填字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| fundCode | string | 基金代码 |
| date | string | 交易日期，格式 YYYY-MM-DD |
| type | string | 交易类型：\`buy\` / \`sell\` / \`dividend\` |
| netValue | number | 交易净值 |
| shares | number | 交易份额 |
| amount | number | 交易金额 |

**可选字段**:
| 字段 | 类型 | 默认值 |
|------|------|--------|
| fee | number | 0 |
| remark | string | "" |
| dividendMode | string | null |

**响应示例**:
\`\`\`json
{
  "success": true,
  "data": {
    "syncId": "trade_1715500000000_abc123",
    "fundId": "fund_xxx",
    "fundCode": "005827",
    "date": "2024-01-15",
    "type": "buy",
    "netValue": 1.2345,
    "shares": 1000,
    "amount": 1234.50,
    "fee": 1.23,
    "createdAt": "2026-05-12T10:00:00Z"
  },
  "meta": { "revision": 42, "timestamp": "2026-05-12T10:00:00Z" }
}
\`\`\`

---

### 帮助

#### GET /api/public/help
返回本文档（Markdown 格式）

添加 \`Accept: application/json\` 请求头可获取 JSON 格式。

---

## 数据类型

### Trade Type（交易类型）
- \`buy\`: 买入
- \`sell\`: 卖出
- \`dividend\`: 分红

### Date 格式
所有日期使用 \`YYYY-MM-DD\` 格式，如 \`2024-01-15\`

---

## 错误响应

### 400 Bad Request
\`\`\`json
{
  "success": false,
  "error": { "code": "BAD_REQUEST", "message": "Validation failed: fundCode is required" }
}
\`\`\`

### 401 Unauthorized
\`\`\`json
{
  "success": false,
  "error": { "code": "UNAUTHORIZED", "message": "Invalid or missing API Key" }
}
\`\`\`

### 404 Not Found
\`\`\`json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "Fund with code '005827' not found" }
}
\`\`\`

### 500 Internal Error
\`\`\`json
{
  "success": false,
  "error": { "code": "INTERNAL_ERROR", "message": "Internal server error" }
}
\`\`\`

---

## curl 示例

### 读取基金列表
\`\`\`bash
curl https://your-domain.com/api/public/funds
\`\`\`

### 读取特定基金
\`\`\`bash
curl https://your-domain.com/api/public/funds/005827
\`\`\`

### 读取基金交易记录
\`\`\`bash
curl https://your-domain.com/api/public/trades/005827
\`\`\`

### 添加交易记录（需 API Key）
\`\`\`bash
curl -X POST https://your-domain.com/api/public/trades \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-key" \\
  -d '{"fundCode":"005827","date":"2024-01-15","type":"buy","netValue":1.2345,"shares":1000,"amount":1234.50}'
\`\`\`

### 获取 API 帮助
\`\`\`bash
curl https://your-domain.com/api/public/help
\`\`\`

---

## 更新时间
2026-05-12
`;
}