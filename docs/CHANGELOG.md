# 更新日志

## [2026-05-13] 浮点数容差处理统一

### 问题
清仓卖出时，系统提示"卖出份额超出持有份额"，但实际份额完全正确。
根本原因：JavaScript 浮点数运算精度误差，`15947.70 - 15947.70` 可能得到 `-0.0000001`。

### 解决方案
1. 在 `Utils` 中统一添加浮点数比较函数
2. 清理各模块分散定义的 EPSILON
3. 统一使用 `Utils.isPositive()`、`Utils.isNegative()`、`Utils.isZero()` 等方法

### 新增 Utils 函数
```javascript
Utils.EPSILON = 0.0001
Utils.isPositive(v)      // 大于容差
Utils.isNegative(v)      // 小于容差
Utils.isZero(v)          // 在容差范围内
Utils.isNonNegative(v)   // 大于等于容差
Utils.isNonPositive(v)   // 小于等于容差
Utils.gt(a, b)           // 严格大于
Utils.lt(a, b)           // 严格小于
Utils.gte(a, b)          // 大于等于
Utils.lte(a, b)          // 小于等于
Utils.isValidPositive(v) // 有效正数
```

### 修改文件
- `js/utils.js` - 新增 EPSILON 和比较函数
- `js/calculatorV2.js` - 删除本地 EPSILON，改用 Utils
- `js/fifoCalculator.js` - 删除本地 EPSILON，改用 Utils
- `js/feeCalculator.js` - 删除本地 EPSILON，改用 Utils
- `js/conversionCalculator.js` - 删除本地 EPSILON，改用 Utils
- `js/overview.js` - 改用 Utils.isPositive()
- `js/detailHoldingHelper.js` - 改用 Utils.isNonPositive()
- `js/tradeManager.js` - checkTradeReasonality 使用容差比较
- `js/dataService.js` - 交易验证使用 Utils.isPositive()
- `js/detail/accrualHelper.js` - 计提条件使用 Utils.isNonPositive()
- `js/detail.js` - 显示逻辑使用 Utils.isPositive()
- `js/modal/tradeModalHelper.js` - 自动计算条件使用 Utils.isPositive()
- `js/modal.js` - 费率计算条件使用 Utils.isPositive()
- `js/chartManager.js` - 图表渲染使用 Utils.isPositive()
- `functions/api/public/trades.js` - API 参数验证使用容差比较
- `.eslintrc.js` - 配置 eslint-plugin-regexp
- `package.json` - 添加 eslint-plugin-regexp 依赖

### 规范变更
**禁止**：
```javascript
if (shares < 0) { ... }
if (shares <= 0) { ... }
if (shares > 0) { ... }
```

**必须使用**：
```javascript
if (Utils.isNegative(shares)) { ... }
if (Utils.isNonPositive(shares)) { ... }
if (Utils.isPositive(shares)) { ... }
```

---

## [2026-05-13] 交易记录弹窗优化

### 修改内容
1. **FIFO费率参考换行显示**：每条 FIFO 详情单独一行
2. **导入金额按钮修复**：添加 `btn-import-amount` class，修复事件绑定
3. **金额提示间距**：添加 `margin-top: 0.5rem`

### 修改文件
- `js/modal.js` - 调整 fee-suggestion-panel HTML 结构
- `js/modal/tradeModalHelper.js` - 添加 btn-import-amount class
- `css/style.css` - 添加 `.fee-suggestion-header`、`.fee-suggestion-detail`、`.hint-amount-inline margin-top`
