# Public API 实现计划

## 需求背景

为外部系统提供基金和交易数据的 API 接口，支持读取和有限写入。

### 约束条件
- **协议**：REST API (JSON)
- **读取**：公开，无需认证
- **写入**：需 API Key 认证
- **API Key 配置**：环境变量 `PUBLIC_API_KEY`

---

## 设计方案

### 认证策略

| HTTP 方法 | 认证要求 | 说明 |
|-----------|---------|------|
| GET | ❌ 无需 | 公开读取 |
| POST | ✅ 需要 X-API-Key | 写入操作需验证 |
| OPTIONS | ❌ 无需 | 预检请求放行 |

### 双轨认证分离

| API 类型 | 路径前缀 | 认证方式 | 用途 |
|---------|---------|---------|------|
| 内部同步 | `/api/sync/*` | 设备ID (deviceId) | App 内部数据同步 |
| 公开 API | `/api/public/*` | API Key（仅写入） | 外部系统接入 |

---

## API 端点

### 基金数据（仅读取）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/public/funds` | 获取全部基金列表 |
| GET | `/api/public/funds/:code` | 获取单个基金信息（`:code` 为基金代码占位符） |

### 交易记录

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/public/trades` | 获取全部交易记录（可按 fundCode 过滤） | ❌ |
| GET | `/api/public/trades/:fundCode` | 获取指定基金的交易记录（`:fundCode` 为基金代码占位符） | ❌ |
| POST | `/api/public/trades` | 添加交易记录 | ✅ |

### 帮助

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/public/help` | 返回 API 使用文档（Markdown） | ❌ |

---

## POST /api/public/trades 详细说明

### 请求

```http
POST /api/public/trades
Content-Type: application/json
X-API-Key: <your-key>

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
```

### 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| fundCode | string | 基金代码，对应基金必须存在 |
| date | string | 交易日期，格式 YYYY-MM-DD |
| type | string | 交易类型：`buy` / `sell` / `dividend` |
| netValue | number | 交易净值，正数 |
| shares | number | 交易份额，正数 |
| amount | number | 交易金额，正数 |

### 可选字段

| 字段 | 类型 | 默认值 |
|------|------|--------|
| fee | number | 0 |
| remark | string | "" |
| dividendMode | string | null |

### 成功响应 (201 Created)

```json
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
    "remark": "",
    "dividendMode": null,
    "createdAt": "2026-05-12T10:00:00Z"
  },
  "meta": {
    "revision": 42,
    "timestamp": "2026-05-12T10:00:00Z"
  }
}
```

---

## 响应格式

### GET /api/public/funds

```json
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
  "meta": {
    "total": 5,
    "timestamp": "2026-05-12T10:00:00Z"
  }
}
```

### GET /api/public/trades

```json
{
  "success": true,
  "data": [
    {
      "syncId": "trade_xxx",
      "fundId": "fund_xxx",
      "date": "2024-01-15",
      "type": "buy",
      "netValue": 1.2000,
      "shares": 1000,
      "amount": 1200.00,
      "fee": 1.20,
      "remark": ""
    }
  ],
  "meta": {
    "total": 50,
    "filters": { "fundCode": "005827" },
    "timestamp": "2026-05-12T10:00:00Z"
  }
}
```

---

## 文件清单

### 新增文件

```
functions/
├── _shared/
│   └── authMiddleware.js     # API Key 鉴权中间件
├── api/
│   └── public/
│       ├── funds.js          # GET /api/public/funds
│       ├── funds/
│       │   └── [code].js     # GET /api/public/funds/:code
│       ├── trades.js         # GET/POST /api/public/trades
│       ├── trades/
│       │   └── [fundCode].js # GET /api/public/trades/:fundCode
│       └── help.js           # GET /api/public/help
```

### 需要修改的文件

无（前端代码和内部同步 API 均不受影响）

---

## 部署配置

### wrangler.toml

```toml
[vars]
PUBLIC_API_KEY = "your-secret-key-here"
```

### 或 Cloudflare Dashboard

在 Pages Functions 的设置中添加环境变量：
- **Name**: `PUBLIC_API_KEY`
- **Value**: `<your-secret-key>`

---

## 错误响应

### 400 Bad Request

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation failed: fundCode is required"
  }
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API Key"
  }
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Fund with code '005827' not found"
  }
}
```

### 500 Internal Error

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error"
  }
}
```

---

## curl 示例

### 读取基金列表
```bash
curl https://your-domain.com/api/public/funds
```

### 读取特定基金
说明：`/api/public/funds/:code` 中的 `:code` 是占位符，实际调用时替换为真实基金代码。
```bash
curl https://your-domain.com/api/public/funds/005827
```

### 读取基金交易记录
说明：`/api/public/trades/:fundCode` 中的 `:fundCode` 是占位符，实际调用时替换为真实基金代码。
```bash
curl https://your-domain.com/api/public/trades/005827
```

### 添加交易记录（需 API Key）
```bash
curl -X POST https://your-domain.com/api/public/trades \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"fundCode":"005827","date":"2024-01-15","type":"buy","netValue":1.2345,"shares":1000,"amount":1234.50}'
```

### 获取 API 帮助
```bash
curl https://your-domain.com/api/public/help
```