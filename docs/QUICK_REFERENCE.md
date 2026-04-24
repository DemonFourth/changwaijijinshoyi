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

**适用所有模块**: TradeManager, FundManager, DataService, Calculator等

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
- [ ] ESLint通过
- [ ] 功能测试通过
- [ ] 文档已更新

---

## 文档位置

- **开发规范**: `docs/DEVELOPMENT_STANDARDS.md`
- **问题诊断**: `docs/DIAGNOSIS.md`
- **解决方案**: `docs/SOLUTION.md`
- **项目说明**: `README.md`
