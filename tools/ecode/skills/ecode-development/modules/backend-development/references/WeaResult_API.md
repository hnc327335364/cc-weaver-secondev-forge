---
description: WeaResult API 文档
title: "WeaResult API 文档"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/backend-development/references/WeaResult_API.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# WeaResult API 文档

> **统一接口响应封装类**  
> 用于标准化后端接口的返回格式，确保前后端交互的一致性

---

## 1. 概述

`WeaResult` 是泛微 E10 平台提供的统一响应封装类，所有二开接口应使用此类作为返回类型，确保响应格式标准化。

**核心特性:**
- ✅ 统一响应结构（状态码、消息、数据）
- ✅ 内置成功/失败快捷方法
- ✅ 支持泛型数据返回
- ✅ 支持错误码追踪
- ✅ 可序列化，支持网络传输

---

## 2. 响应结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | `int` | 状态码，成功通常为 200 或枚举值 |
| `msg` | `String` | 响应提示信息 |
| `status` | `boolean` | 请求是否成功 (`true`/`false`) |
| `data` | `T` | 泛型数据，承载业务返回内容 |
| `outErrorCode` | `OutErrorCode` | 外部错误码（可选，用于错误追踪） |
| `isFail` | `boolean` | 是否失败标识 |

---

## 3. 快速使用

### 3.1 成功响应

```java
// 无数据返回
return WeaResult.success();

// 返回数据
return WeaResult.success(userData);

// 返回数据 + 自定义消息
return WeaResult.success(userData, "操作成功");
```

### 3.2 失败响应

```java
// 使用预定义错误枚举
return WeaResult.fail(WeaResultCodeEnum.ERROR);

// 自定义错误消息
return WeaResult.fail("参数不能为空");

// 带外部错误码的失败响应
return WeaResult.fail("业务错误", outErrorCode);

// 指定状态码和消息
return WeaResult.fail(500, "服务器内部错误");
```

### 3.3 业务错误标识

部分 `fail` 方法支持 `isBusinessError` 参数，用于区分**业务错误**和**系统错误**:

```java
// 业务错误（isBusinessError = true）
// 前端可按业务逻辑处理，不触发全局错误拦截
return WeaResult.fail("库存不足", true);

// 系统错误（isBusinessError = false）
// 可能触发全局错误处理或告警
return WeaResult.fail("数据库连接失败", false);
```

---

## 4. 使用示例

### 4.1 Controller 层示例

```java
@RestController
@RequestMapping("/api/secondev/user")
public class UserController {

    @Autowired
    private UserService userService;

    /**
     * 获取用户信息
     */
    @GetMapping("/info")
    public WeaResult<UserVO> getUserInfo(@RequestParam("id") Long id) {
        UserVO user = userService.getUserById(id);
        return WeaResult.success(user);
    }

    /**
     * 创建用户
     */
    @PostMapping("/create")
    public WeaResult<Long> createUser(@RequestBody UserCreateDTO dto) {
        try {
            Long userId = userService.createUser(dto);
            return WeaResult.success(userId, "用户创建成功");
        } catch (BusinessException e) {
            // 业务异常：记录日志，返回友好提示
            log.error("创建用户业务异常：{}", e.getMessage());
            return WeaResult.fail(e.getMessage(), true);
        } catch (Exception e) {
            // 系统异常：记录完整日志，返回通用错误提示
            log.error("创建用户系统异常", e);
            return WeaResult.fail("系统繁忙，请稍后重试", false);
        }
    }

    /**
     * 删除用户
     */
    @DeleteMapping("/delete")
    public WeaResult<Void> deleteUser(@RequestParam("id") Long id) {
        boolean success = userService.deleteUser(id);
        return success ? WeaResult.success() : WeaResult.fail("删除失败");
    }
}
```

### 4.2 Service 层示例

```java
@Service
public class UserService {
    
    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    public WeaResult<UserVO> getUserById(Long id) {
        if (id == null || id <= 0) {
            return WeaResult.fail("用户 ID 无效", true);
        }
        
        UserVO user = userMapper.selectById(id);
        if (user == null) {
            return WeaResult.fail("用户不存在", true);
        }
        
        return WeaResult.success(user);
    }

    public WeaResult<Long> createUser(UserCreateDTO dto) {
        // 参数校验
        if (StringUtils.isBlank(dto.getName())) {
            return WeaResult.fail("用户名不能为空", true);
        }
        
        // 业务处理
        Long userId = userMapper.insert(dto);
        return WeaResult.success(userId);
    }
}
```

---

## 5. 错误码枚举

常用错误码可通过 `WeaResultCodeEnum` 获取:

| 枚举 | 状态码 | 说明 |
|------|--------|------|
| `SUCCESS` | 200 | 操作成功 |
| `ERROR` | 500 | 通用错误 |
| `PARAM_ERROR` | 400 | 参数错误 |
| `UNAUTHORIZED` | 401 | 未授权 |
| `FORBIDDEN` | 403 | 禁止访问 |
| `NOT_FOUND` | 404 | 资源不存在 |

---

## 6. 最佳实践

### ✅ 推荐做法

```java
// 1. 统一使用 WeaResult 作为返回类型
public WeaResult<T> methodName() { }

// 2. 业务异常使用 isBusinessError = true
return WeaResult.fail("业务错误提示", true);

// 3. 系统异常记录日志后返回通用提示
log.error("系统异常", e);
return WeaResult.fail("系统繁忙，请稍后重试", false);

// 4. 成功时尽量返回有意义的数据
return WeaResult.success(resultData);

// 5. 敏感异常信息仅记录日志，不返回前端
catch (SQLException e) {
    log.error("数据库异常", e);
    return WeaResult.fail("数据操作失败", false);
}
```

### ❌ 避免做法

```java
// 1. 不要直接返回 Map 或其他非标准结构
public Map<String, Object> methodName() { } // ❌

// 2. 不要混用不同的响应格式
// 同一项目应保持响应结构一致

// 3. 不要将异常堆栈直接返回前端（安全风险）
return WeaResult.fail("系统错误", e); // ❌ 可能泄露敏感信息

// 4. 不要返回包含敏感信息的错误消息
return WeaResult.fail("SQL 语法错误：SELECT * FROM users WHERE...", false); // ❌

// 5. 不要忽略错误日志记录
catch (Exception e) {
    return WeaResult.fail("操作失败"); // ❌ 未记录日志，难以排查
}
```

---

## 7. 安全注意事项

### 7.1 异常信息处理原则

| 原则 | 说明 |
|------|------|
| **日志记录** | 完整异常信息仅记录到服务端日志 |
| **前端提示** | 返回前端的信息应友好且不泄露系统细节 |
| **错误分类** | 业务错误可返回具体原因，系统错误返回通用提示 |
| **敏感信息** | 禁止返回 SQL、文件路径、堆栈跟踪等敏感信息 |

### 7.2 异常处理示例

```java
// ✅ 正确做法
try {
    // 业务逻辑
} catch (BusinessException e) {
    // 业务异常可返回具体消息
    log.warn("业务异常：{}", e.getMessage());
    return WeaResult.fail(e.getMessage(), true);
} catch (Exception e) {
    // 系统异常记录完整日志，返回通用提示
    log.error("系统异常", e);
    return WeaResult.fail("系统繁忙，请稍后重试", false);
}

// ❌ 错误做法 - 泄露异常堆栈
try {
    // 业务逻辑
} catch (Exception e) {
    return WeaResult.fail(e.getMessage(), false); // 可能泄露敏感信息
}
```

---

## 8. 前端对接示例

### 8.1 响应解析 (JavaScript)

```javascript
import { devRequest } from "@weapp/ecodesdk";

async function fetchData() {
    const result = await devRequest({
        url: "/api/secondev/user/info",
        method: "GET",
        params: { id: 1 },
    });
    
    // 标准响应结构
    // {
    //   "code": 200,
    //   "msg": "操作成功",
    //   "status": true,
    //   "data": { ... }
    // }
    
    if (result.status) {
        // 成功处理
        console.log('数据:', result.data);
    } else {
        // 失败处理
        console.error('错误:', result.msg);
        
        // 判断是否为业务错误
        if (result.isBusinessError) {
            // 业务错误，前端友好提示
            alert(result.msg);
        } else {
            // 系统错误，可能需要上报或重试
            reportError(result);
        }
    }
}
```

> 前端请求必须满足 e-code 二开准入名单。请求与拦截细则按需读取 `../../frontend-development/references/request-interceptor.md`。

---

## 9. 注意事项

| 事项 | 说明 |
|------|------|
| **序列化** | `WeaResult` 实现 `Serializable`，支持网络传输和缓存 |
| **泛型使用** | 建议明确指定泛型类型，便于前端类型推导 |
| **异常处理** | 异常信息仅记录日志，前端返回通用友好提示 |
| **错误码** | 复杂业务场景建议使用 `OutErrorCode` 传递详细错误信息（服务端内部使用） |
| **日志记录** | 失败响应必须在服务端记录日志，便于问题排查 |
| **安全性** | 禁止将异常堆栈、SQL 语句、文件路径等敏感信息返回前端 |

---

## 10. 相关类

| 类名 | 说明 |
|------|------|
| `WeaResultCodeEnum` | 预定义状态码枚举 |
| `OutErrorCode` | 外部错误码，用于详细错误追踪（服务端内部使用） |
| `ErrorCodeBuilder` | 错误码构建工具 |

---

**文档版本:** 1.0  
**最后更新:** 2026-03-13  
**适用范围:** E10 二开服务 `weaver-secondev-service`
