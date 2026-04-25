# 开发快速参考

> 一页纸快速参考，详细内容请查看 [DEVELOPMENT_STANDARDS.md](./DEVELOPMENT_STANDARDS.md)

## ⚠️ 最重要的规则

### 1. 对象方法调用 - 禁止使用this

```javascript
// ❌ 错误
this.methodName()

// ✅ 正确
ObjectName.methodName()
```

**适用所有模块**: TradeManager, FundManager, DataService, ThemeManager, ChartManager, BigNumberFormatter, Paginator等

### 2. 开发后必须测试

**每次修改代码后必须执行**:
```bash
# 1. 代码质量检查
npm run lint

# 2. 清除缓存并刷新
Ctrl + Shift + Delete  # 清除缓存
Ctrl + F5              # 硬刷新

# 3. 打开控制台检查
F12 -> Console

# 4. 功能测试
# 测试修改的功能和相关功能

# 5. 边界测试
# 测试异常情况和边界值
```

---

## 架构设计原则

### SOLID原则

| 原则 | 说明 | 示例 |
|------|------|------|
| **S**单一职责 | 一个模块只负责一件事 | TradeManager只管交易 |
| **O**开闭原则 | 对扩展开放，对修改关闭 | 用策略模式添加新算法 |
| **L**里氏替换 | 子类可替换父类 | LocalStorage替换BaseStorage |
| **I**接口隔离 | 接口职责单一 | 分离读写接口 |
| **D**依赖倒置 | 依赖抽象不依赖具体 | 依赖接口而非实现 |

### 低耦合高内聚

**低耦合**: 模块间依赖最少化
```javascript
// ✅ 通过事件解耦
EventBus.emit(EventType.DATA_CHANGED, data);
EventBus.on(EventType.DATA_CHANGED, handler);
```

**高内聚**: 模块内元素紧密相关
```javascript
// ✅ 所有方法都与交易相关
const TradeManager = {
    addTrade() { },
    deleteTrade() { },
    validateTrade() { }
};
```

---

## 常见问题速查

| 问题 | 症状 | 解决方案 |
|------|------|----------|
| 函数未定义 | `this.method is not a function` | 使用`ObjectName.method()` |
| CORS错误 | `blocked by CORS policy` | 使用JSONP |
| 编码乱码 | 中文显示乱码 | 检测并修复编码 |
| 路由错误 | `pushState failed` | 使用hash路由 |
| 缓存问题 | 修改不生效 | Ctrl+F5硬刷新 |

---

## 代码模板

### 模块定义

```javascript
const ModuleName = {
    init() {
        console.log('ModuleName initialized');
    },
    
    method() {
        // ✅ 调用其他方法
        ModuleName.otherMethod();
    },
    
    otherMethod() {
        // 实现
    }
};

ModuleRegistry.register('ModuleName', ModuleName);
```

### 事件通信

```javascript
// 发送
EventBus.emit(EventType.DATA_CHANGED, data);

// 接收
EventBus.on(EventType.DATA_CHANGED, (data) => {
    // 处理
});
```

### 错误处理

```javascript
try {
    const result = await operation();
    return result;
} catch (error) {
    console.error('Operation failed:', error);
    Utils.showToast('操作失败', 'error');
    return null;
}
```

---

## 模块注册表

| 模块 | 文件 | 说明 |
|------|------|------|
| Config | config.js | 配置管理 |
| EventBus | eventBus.js | 事件总线 |
| Utils | utils.js | 工具函数 |
| Storage | storage.js | 本地存储 |
| FundManager | fundManager.js | 基金管理 |
| TradeManager | tradeManager.js | 交易管理 |
| ThemeManager | themeManager.js | 主题切换 |
| ChartManager | chartManager.js | ECharts图表 |
| BigNumberFormatter | bigNumberFormatter.js | 大数字格式化 |
| Paginator | paginator.js | 分页组件 |

---

## CSS设计令牌

```css
/* 使用CSS变量，禁止硬编码颜色 */
color: var(--color-text-primary);
background: var(--color-bg-card);
border: 1px solid var(--color-border-secondary);
```

主题切换：`ThemeManager.setTheme('dark')` / `ThemeManager.toggleTheme()`

---

## Git提交

```bash
# 格式
git commit -m "<type>: <description>"

# 类型
feat    # 新功能
fix     # 修复bug
docs    # 文档
refactor # 重构
```

---

## 检查清单

提交前检查：
- [ ] 无`this.`调用
- [ ] CSS使用变量，无硬编码颜色
- [ ] ESLint通过
- [ ] 功能测试通过
- [ ] 文档已更新

---

## 文档位置

- **开发规范**: `docs/DEVELOPMENT_STANDARDS.md`
- **问题诊断**: `docs/DIAGNOSIS.md`
- **解决方案**: `docs/SOLUTION.md`
- **项目说明**: `README.md`
- **SDD设计文档**: `.sdd/fund-calculator-enhancement/`
