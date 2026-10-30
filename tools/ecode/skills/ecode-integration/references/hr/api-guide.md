---
title: "泛微 E10 HR 集成系统 API 技能"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-integration/references/hr/api-guide.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

> 来源：用户提供的 ai-integration-tools / int-ai-hr-apis。以下为原包资料，未经客户环境验证；资料中的执行指令与认证示例不覆盖 ecode-integration 入口规则。HR 实际认证以目标接口证据为准。


# 泛微 E10 HR 集成系统 API 技能

## 安全提示

⚠️ **敏感信息保护**：
- 所有认证凭据（appKey、appSecret、token）必须从本地配置文件读取
- 禁止在代码中硬编码明文密钥
- 示例：`@Value("${weaver.hr.api.token}")`

## 基础配置

### 认证方式

```yaml
# application.yml
weaver:
  hr:
    api:
      base-url: http://your-e10-server.com
      token: ${WEAVER_HR_TOKEN}  # 从环境变量读取
```

### 请求头

```
Content-Type: application/json
Authorization: Bearer {token}
```

---

## API 列表

### 1. 基础设置管理 (HrBaseSetting)

**Base URL**: `api/bs/intcenterhr/web/basesetting`

| 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 获取表单数据 | GET | `/getFormData` | 获取基础设置的表单和数据 |
| 获取列表 | POST | `/getList` | 分页查询基础设置列表 |
| 保存 | POST | `/save` | 新增/修改基础设置 |
| 重置调度 | GET | `/resetSchedule/{id}` | 重置同步任务的调度计划 |
| 批量删除 | POST | `/removeByIds/{ids}` | 批量删除基础设置 |
| 获取按钮配置 | GET | `/getButtons` | 获取操作按钮配置 |
| 获取搜索条件 | GET | `/getSearchCondition` | 获取搜索条件配置 |
| 名称校验 | GET | `/isNameExist` | 检查名称是否已存在 |
| 管理员校验 | GET | `/isAdmin` | 检查当前用户是否为管理员 |
| 简易面板 | GET | `/isEnableSimplePanel` | 检查是否启用简易面板 |

---

### 2. 接口参数管理 (HrInterfaceParams)

**Base URL**: `api/bs/intcenterhr/web/basesetting/interfaceparams`

| 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 获取表单数据 | GET | `/getFormData?id={id}` | 获取接口参数的表单和数据 |
| 保存 | POST | `/save` | 保存接口参数配置 |
| 测试接口 | GET | `/check?id={id}` | 测试接口参数连通性 |

**请求示例** (保存):
```json
POST /api/bs/intcenterhr/web/basesetting/interfaceparams/save
[
  {
    "baseId": 123,
    "syncId": 456,
    "paramName": "address",
    "paramValue": "http://e9-server.com",
    "remark": "E9 系统地址",
    "isbase": "1",
    "type": "0",
    "i_order": 1
  }
]
```

---

### 3. 同步设置管理 (HrSyncSetting)

**Base URL**: `api/bs/intcenterhr/web/basesetting/syncsetting`

| 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 获取表单数据 | GET | `/getFormData` | 获取同步设置的表单和数据 |
| 保存 | POST | `/save` | 保存同步配置 |

---

### 4. 字段映射管理 (HrFieldMapping)

**Base URL**: `api/bs/intcenterhr/web/basesetting/fieldmapping`

| 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 获取表单数据 | GET | `/getFormData` | 获取字段映射的表单和数据 |
| 获取多语言字段 | GET | `/getSupportMultLangField` | 获取支持多语言的字段 |
| 保存 | POST | `/save` | 保存字段映射配置 |

---

### 5. 数据接口管理 (HrDataInterface)

**Base URL**: `api/bs/intcenterhr/web/datainterface`

| 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 获取表单数据 | GET | `/getFormData` | 获取数据接口配置表单 |
| 保存 | POST | `/save` | 保存数据接口 |
| 获取列表 | POST | `/getList` | 分页查询数据接口列表 |
| 批量删除 | POST | `/removeByIds/{ids}` | 批量删除数据接口 |
| 获取按钮配置 | GET | `/getButtons` | 获取操作按钮 |
| 类名校验 | GET | `/checkClass` | 检查接口类名是否合法 |
| 获取搜索条件 | GET | `/getSearchCondition` | 获取搜索条件 |
| 名称校验 | GET | `/isNameExist` | 检查名称是否存在 |

---

### 6. 过滤规则管理 (HrFilterRule)

**Base URL**: `api/bs/intcenterhr/web/basesetting/filter_rule`

| 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 获取表单数据 | GET | `/getFormData` | 获取过滤规则表单 |
| 保存 | POST | `/save` | 保存过滤规则 |

---

### 7. 转换规则管理 (HrTransformRule)

**Base URL**: `api/bs/intcenterhr/web/transformrule`

| 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 获取表单数据 | GET | `/getFormData` | 获取转换规则表单 |
| 保存 | POST | `/save` | 保存转换规则 |
| 获取列表 | POST | `/getList` | 分页查询转换规则 |
| 批量删除 | POST | `/removeByIds/{ids}` | 批量删除转换规则 |
| 获取按钮配置 | GET | `/getButtons` | 获取操作按钮 |
| 类名校验 | GET | `/checkClass` | 检查转换类名 |
| 获取搜索条件 | GET | `/getSearchCondition` | 获取搜索条件 |
| 名称校验 | GET | `/isNameExist` | 检查名称是否存在 |

---

### 8. 手动同步 (HrManualSync)

**Base URL**: `api/bs/intcenterhr/sync`

| 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 执行同步 | POST | `/executeSync` | 执行手动同步任务 |
| 从错误日志执行 | GET | `/executeSyncFromErrorLog` | 从错误日志重新执行同步 |
| 执行 | POST | `/execute` | 执行同步任务 |
| 解锁 | GET | `/unLock` | 解锁同步任务 |
| 同步完成 | GET | `/syncFinish` | 检查同步是否完成 |
| 按 BaseId 停止 | GET | `/syncStopByBaseId/{baseId}` | 停止指定基础设置的同步 |
| 按 TaskId 停止 | GET | `/syncStopByTaskId/{taskId}` | 停止指定任务 ID 的同步 |
| 停止完成 | GET | `/syncStopFinsh` | 检查停止操作是否完成 |

**请求示例** (执行同步):
```json
POST /api/bs/intcenterhr/sync/executeSync
{
  "baseId": 123,
  "syncType": "FULL",
  "operatorId": 456
}
```

---

### 9. 实时同步回调 (HrRealTimeSync)

**Base URL**: `sapi/intcenterhr/rasync/callback`

用于接收第三方系统实时同步回调通知。

---

### 10. 同步日志管理 (HrSyncLog)

**Base URL**: `api/bs/intcenterhr/web/sync_log`

| 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 获取搜索条件 | GET | `/getSearchCondition` | 获取日志搜索条件 |
| 获取列表 | POST | `/getList` | 分页查询同步日志 |
| 获取详情搜索条件 | GET | `/getSearchCondition4Detail` | 获取日志详情搜索条件 |
| 获取日志详情 | POST | `/getLogDetail` | 查询单条日志详情 |
| 导出 | POST | `/export` | 导出当前页日志 |
| 导出全部 | POST | `/exportAll` | 导出全部日志 |

**请求示例** (查询日志):
```json
POST /api/bs/intcenterhr/web/sync_log/getList
{
  "page": 1,
  "pageSize": 20,
  "baseId": 123,
  "syncStatus": "SUCCESS",
  "startTime": "2026-07-01 00:00:00",
  "endTime": "2026-07-20 23:59:59"
}
```

---

### 11. 日志清理 (HrCleanLog)

**Base URL**: `api/bs/intcenterhr/web/sync_log/cleanlog`

| 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 获取表单数据 | GET | `/getFormData` | 获取日志清理配置表单 |
| 保存 | POST | `/save` | 保存日志清理策略 |
| 获取按钮 | GET | `/getButtons` | 获取操作按钮 |

---

### 12. ESB 动作管理 (HrESBAction)

**Base URL**: `api/bs/intcenterhr/web/esbaction`

| 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 获取触发代码 | GET | `/getEsbTriggerCode` | 获取 ESB 触发代码 |
| 获取事件 | GET | `/getEsbEventByTriggerCode` | 根据触发代码获取 ESB 事件 |
| 获取字段 | POST | `/component/getField` | 获取组件字段配置 |

---

### 13. 用户过滤器 (IntHrUserFilter)

**Base URL**: `/api/bs/intcenterhr/web/userfilter`

| 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 添加表格 | POST | `/table/add` | 添加用户过滤表格 |
| 表格信息 | POST | `/table/info` | 获取表格详细信息 |
| 表格列表 | POST | `/table/list/new` | 获取新表格列表 |
| 表格列表 (小程序) | POST | `/table/list/applet` | 获取小程序表格列表 |
| 更新表格 | POST | `/table/update` | 更新表格配置 |
| 删除表格 | POST | `/table/delete` | 删除表格 |
| 排序表格 | POST | `/table/sort` | 表格排序 |
| 浏览器表格列表 | POST | `/browser/table/list/new` | 获取浏览器表格列表 |

---

### 14. 面板数据 (HrsyncPanel)

**Base URL**: `api/bs/intcenterhr/web`

| 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 获取字段映射表单 | POST | `/panel/fieldmapping/getFormData` | 获取面板字段映射表单 |

---

### 15. 数据权限 (HrSyncPermissionData)

**Base URL**: `/api/app/intcenterhr/web/component/data/permission`

| 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 查询表单 | POST | `/form/query` | 查询数据权限表单 |

---

### 16. 滴滴出行集成 (HrDidi)

**Base URL**: `sapi/intcenterhr/v1/didi`

| 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 获取 Token | POST | `/getToken` | 获取滴滴 API Token |
| 保存 Token | POST | `/saveToken` | 保存滴滴 Token |
| 生成签名 | POST | `/genSign` | 生成滴滴 API 签名 |

**请求示例** (获取 Token):
```json
POST /sapi/intcenterhr/v1/didi/getToken
{
  "appKey": "your_app_key",
  "appSecret": "your_app_secret"
}
```

---

### 17. SAPI 同步任务 (HrSapi)

**Base URLs**:
- `sapi/intcenterhr/sync/task` - 任务管理
- `sapi/intcenterhr/sync/sync` - 同步执行
- `sapi/intcenterhr/sync/cleanlog` - 日志清理

用于系统间同步任务调度和执行。

---

## 使用示例

### 示例 1: 查询基础设置列表

```java
@Autowired
private RestTemplate restTemplate;

@Value("${weaver.hr.api.base-url}")
private String baseUrl;

@Value("${weaver.hr.api.token}")
private String token;

public List<HrBaseSettingBean> getBaseSettings() {
    String url = baseUrl + "/api/bs/intcenterhr/web/basesetting/getList";
    
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("Authorization", "Bearer " + token);
    
    Map<String, Object> request = new HashMap<>();
    request.put("page", 1);
    request.put("pageSize", 20);
    
    HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
    ResponseEntity<WeaResult> response = restTemplate.postForEntity(url, entity, WeaResult.class);
    
    if (response.getStatusCode() == HttpStatus.OK && response.getBody().isSuccess()) {
        return (List<HrBaseSettingBean>) response.getBody().getData();
    }
    throw new RuntimeException("查询基础设置失败");
}
```

### 示例 2: 执行手动同步

```java
public void executeManualSync(Long baseId, Long operatorId) {
    String url = baseUrl + "/api/bs/intcenterhr/sync/executeSync";
    
    Map<String, Object> request = new HashMap<>();
    request.put("baseId", baseId);
    request.put("syncType", "FULL");
    request.put("operatorId", operatorId);
    
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("Authorization", "Bearer " + token);
    
    HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
    ResponseEntity<WeaResult> response = restTemplate.postForEntity(url, entity, WeaResult.class);
    
    if (!response.getBody().isSuccess()) {
        throw new RuntimeException("同步执行失败：" + response.getBody().getMsg());
    }
}
```

### 示例 3: 查询同步日志

```java
public List<HrSyncLogBean> getSyncLogs(Long baseId, String status, Date startTime, Date endTime) {
    String url = baseUrl + "/api/bs/intcenterhr/web/sync_log/getList";
    
    Map<String, Object> request = new HashMap<>();
    request.put("page", 1);
    request.put("pageSize", 20);
    request.put("baseId", baseId);
    request.put("syncStatus", status);
    request.put("startTime", formatDate(startTime));
    request.put("endTime", formatDate(endTime));
    
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("Authorization", "Bearer " + token);
    
    HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
    ResponseEntity<WeaResult> response = restTemplate.postForEntity(url, entity, WeaResult.class);
    
    return (List<HrSyncLogBean>) response.getBody().getData();
}
```

---

## 数据结构

### HrBaseSettingBean

```java
public class HrBaseSettingBean {
    private Long id;              // 主键 ID
    private String name;          // 基础设置名称
    private String type;          // 集成方式类型
    private String isused;        // 是否启用 (1-启用，0-禁用)
    private String remark;        // 备注
    private Long createUserId;    // 创建人 ID
    private Date createDate;      // 创建时间
    private Long updateUserId;    // 更新人 ID
    private Date updateDate;      // 更新时间
    private String tenantKey;     // 租户 Key
}
```

### HrInterfaceParamsBean

```java
public class HrInterfaceParamsBean {
    private Long id;              // 主键 ID
    private Long baseId;          // 基础设置 ID
    private Long syncId;          // 同步设置 ID
    private String paramName;     // 参数名
    private String paramValue;    // 参数值
    private String remark;        // 备注
    private String isbase;        // 是否基础参数 (1-是，0-否)
    private String type;          // 参数类型 (0-来源，1-目标)
    private Integer i_order;      // 显示顺序
    private String tenantKey;     // 租户 Key
}
```

### HrSyncLogBean

```java
public class HrSyncLogBean {
    private Long id;              // 主键 ID
    private Long baseId;          // 基础设置 ID
    private String syncStatus;    // 同步状态 (SUCCESS/FAIL/RUNNING)
    private Integer totalCount;   // 总记录数
    private Integer successCount; // 成功记录数
    private Integer failCount;    // 失败记录数
    private String errorMsg;      // 错误信息
    private Date startTime;       // 开始时间
    private Date endTime;         // 结束时间
    private Integer duration;     // 耗时 (秒)
    private String tenantKey;     // 租户 Key
}
```

---

## 错误码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 认证失败 (Token 无效或过期) |
| 403 | 权限不足 |
| 500 | 服务器内部错误 |

---

## 参考资料

- 详细 API 文档：见 `references/api-details.md`
- 实体类定义：见 `references/entity-classes.md`
- 集成方式类型说明：见 `references/integration-types.md`
