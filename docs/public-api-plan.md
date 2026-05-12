# Public API 实现计划

## 需求背景

为外部系统提供只读的基金和交易数据 API。

### 约束条件
- **协议**：REST API (JSON)
- **数据范围**：基金数据 + 交易记录（只读）
- **认证**：单一 API Key（环境变量配置）
- **Key 数量**：1 个
- **管理方式**：环境变量 `PUBLIC_API_KEY` 配置

---

## 设计方案

### 认证方式

**Header**: `X-API-Key: <value>`

**流程**：
```
请求 → 读取 env.PUBLIC_API_KEY → 比对相同 → 放行，否则 401
```

### 双轨认证分离

| API 类型 | 路径前缀 | 认证方式 | 用途 |
|---------|---------|---------|------|
| 内部同步 | `/api/sync/*` | 设备ID (deviceId) | App 内部数据同步 |
| 公开 API | `/api/public/*` | API Key | 外部系统接入 |

---

## API 端点

### 基金数据

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/public/funds` | 获取全部基金列表 |
| GET | `/api/public/funds/:code` | 获取单个基金信息 |

### 交易记录

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/public/trades` | 获取全部交易记录（可按 fundCode 过滤） |
| GET | `/api/public/trades/:fundCode` | 获取指定基金的交易记录 |

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
    "filters": {
      "fundCode": "005827"
    },
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
│       ├── funds.js         # GET /api/public/funds
│       ├── funds/
│       │   └── [code].js   # GET /api/public/funds/:code
│       ├── trades.js        # GET /api/public/trades
│       └── trades/
│           └── [fundCode].js  # GET /api/public/trades/:fundCode
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
    "message": "Fund not found"
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