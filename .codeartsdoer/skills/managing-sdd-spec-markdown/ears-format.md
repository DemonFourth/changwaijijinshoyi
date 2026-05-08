# EARS格式规范

## 概述
EARS (Easy Approach to Requirements Syntax) 是一种简化的需求语法格式，用于编写清晰、可测试的需求。

## EARS格式类型

### 1. 普遍性需求 (Ubiquitous)
**格式**: `The <system> shall <action>`

**用途**: 描述系统必须始终满足的需求

**示例**:
- The system shall display the fund name in Chinese
- The system shall calculate the return rate with 2 decimal places

### 2. 事件驱动需求 (Event-Driven)
**格式**: `When <trigger>, the <system> shall <action>`

**用途**: 描述在特定事件触发时系统必须执行的操作

**示例**:
- When the user clicks the "Calculate" button, the system shall validate all input fields
- When the fund code is entered, the system shall fetch the fund data from API

### 3. 状态驱动需求 (State-Driven)
**格式**: `While <state>, the <system> shall <action>`

**用途**: 描述在特定状态下系统必须满足的需求

**示例**:
- While the calculation is in progress, the system shall display a loading indicator
- While the fund data is being fetched, the system shall disable the calculate button

### 4. 可选特征需求 (Optional Feature)
**格式**: `Where <feature> is included, the <system> shall <action>`

**用途**: 描述可选功能的需求

**示例**:
- Where historical data comparison is included, the system shall display a trend chart

### 5. 异常处理需求 (Exception Handling)
**格式**: `If <condition>, then the <system> shall <action>`

**用途**: 描述异常情况下的系统行为

**示例**:
- If the fund code is invalid, then the system shall display an error message
- If the API request fails, then the system shall retry up to 3 times

## 验收标准编写规则

### 结构
每个需求应包含：
1. **需求ID**: 唯一标识符 (如 REQ-001)
2. **需求描述**: 使用EARS格式
3. **验收标准**: 可测试的具体条件
4. **优先级**: High/Medium/Low

### 验收标准示例
```
**验收标准**:
- Given 用户输入基金代码 "519732"
- When 用户点击查询按钮
- Then 系统显示基金名称 "万家行业优选混合(LOF)"
```

## 最佳实践

1. **使用主动语态**: "The system shall display" 而非 "The fund name shall be displayed"
2. **避免模糊词汇**: 不使用 "should", "may", "could" 等模糊词汇
3. **可测试性**: 每个需求必须可以通过测试验证
4. **完整性**: 需求应包含所有必要的前置条件和后置条件
5. **原子性**: 每个需求应描述单一功能点
