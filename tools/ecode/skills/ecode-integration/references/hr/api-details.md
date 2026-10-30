---
title: "泛微 E10 HR 集成系统 - 详细 API 文档"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-integration/references/hr/api-details.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

> 来源：用户提供的 ai-integration-tools / int-ai-hr-apis。以下为原包资料，未经客户环境验证；资料中的执行指令与认证示例不覆盖 ecode-integration 入口规则。HR 实际认证以目标接口证据为准。

# 泛微 E10 HR 集成系统 - 详细 API 文档

## 认证与安全

### 获取 Token

泛微 E10 使用基于 Tenant 的认证机制，Token 通过登录接口获取。

**请求**:
```
POST /api/login/submit
Content-Type: application/json

{
  "loginid": "username",
  "password": "encrypted_password",
  "tenantKey": "your_tenant_key"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expireTime": 7200
  }
}
```

---

## 1. 基础设置管理

### 1.1 获取基础设置列表

**端点**: `POST /api/bs/intcenterhr/web/basesetting/getList`

**请求参数**:
```json
{
  "page": 1,
  "pageSize": 20,
  "name": "可选 - 名称模糊搜索",
  "type": "可选 - 集成方式类型",
  "isused": "可选 - 1 启用/0 禁用"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "total": 10,
    "records": [
      {
        "id": 123,
        "name": "E9 组织人员同步",
        "type": "E9Api",
        "isused": "1",
        "remark": "从 E9 同步组织架构到 E10",
        "createDate": "2026-07-01 10:00:00"
      }
    ]
  }
}
```

### 1.2 保存基础设置

**端点**: `POST /api/bs/intcenterhr/web/basesetting/save`

**请求参数**:
```json
{
  "id": 0,  // 新增时为 0，修改时传 ID
  "name": "E9 组织人员同步",
  "type": "E9Api",
  "isused": "1",
  "remark": "从 E9 同步组织架构到 E10"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": 123
  },
  "msg": "操作成功"
}
```

### 1.3 删除基础设置

**端点**: `POST /api/bs/intcenterhr/web/basesetting/removeByIds/{ids}`

**路径参数**:
- `ids`: 逗号分隔的 ID 列表，如 `123,456,789`

**响应**:
```json
{
  "success": true,
  "msg": "删除成功"
}
```

### 1.4 重置调度计划

**端点**: `GET /api/bs/intcenterhr/web/basesetting/resetSchedule/{id}`

**说明**: 重置后会重新按照配置的调度时间执行同步任务。

---

## 2. 接口参数管理

### 2.1 获取接口参数表单

**端点**: `GET /api/bs/intcenterhr/web/basesetting/interfaceparams/getFormData?id={id}`

**路径参数**:
- `id`: 基础设置 ID

**响应**:
```json
{
  "success": true,
  "data": {
    "customParam": {
      "title": "基本信息",
      "columns": [
        {"title": "参数名", "dataIndex": "paramName"},
        {"title": "备注", "dataIndex": "remark"},
        {"title": "参数值", "dataIndex": "paramValue"}
      ],
      "data": [
        {
          "rowId": "1",
          "paramName": "address",
          "remark": "E9 系统地址",
          "paramValue": "http://e9-server.com"
        },
        {
          "rowId": "2",
          "paramName": "appKey",
          "remark": "应用 Key",
          "paramValue": "your_app_key"
        }
      ]
    },
    "customParam1": {
      "title": "数据来源：组织人员参数设置",
      "data": [...]
    },
    "button": [
      {"id": "save", "content": "保存", "type": "primary"},
      {"id": "lastStep", "content": "上一步", "type": "default"},
      {"id": "nextStep", "content": "下一步", "type": "default"}
    ]
  }
}
```

### 2.2 保存接口参数

**端点**: `POST /api/bs/intcenterhr/web/basesetting/interfaceparams/save`

**请求参数**:
```json
[
  {
    "baseId": 123,
    "syncId": 0,
    "paramName": "address",
    "paramValue": "http://e9-server.com",
    "remark": "E9 系统地址",
    "isbase": "1",
    "type": "0",
    "i_order": 1
  },
  {
    "baseId": 123,
    "syncId": 456,
    "paramName": "pageSize",
    "paramValue": "100",
    "remark": "分页大小",
    "isbase": "0",
    "type": "0",
    "i_order": 1
  }
]
```

### 2.3 测试接口连通性

**端点**: `GET /api/bs/intcenterhr/web/basesetting/interfaceparams/check?id={id}`

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "interfaceName": "基本信息",
      "testResult": "SUCCESS",
      "message": "连接成功",
      "duration": 120
    },
    {
      "interfaceName": "组织人员接口",
      "testResult": "FAIL",
      "message": "认证失败：Token 已过期",
      "duration": 50
    }
  ]
}
```

---

## 3. 同步设置管理

### 3.1 获取同步设置表单

**端点**: `GET /api/bs/intcenterhr/web/basesetting/syncsetting/getFormData?baseId={baseId}`

**响应结构**:
- 包含所有启用的同步配置项
- 每个配置项包含数据来源、数据目标、字段映射、过滤规则等

---

## 4. 字段映射管理

### 4.1 获取字段映射表单

**端点**: `GET /api/bs/intcenterhr/web/basesetting/fieldmapping/getFormData?syncId={syncId}`

**响应**:
```json
{
  "success": true,
  "data": {
    "sourceFields": [
      {"fieldName": "workcode", "fieldDesc": "工号"},
      {"fieldName": "lastname", "fieldDesc": "姓名"},
      {"fieldName": "departmentid", "fieldDesc": "部门 ID"}
    ],
    "targetFields": [
      {"fieldName": "workcode", "fieldDesc": "工号"},
      {"fieldName": "name", "fieldDesc": "姓名"},
      {"fieldName": "deptid", "fieldDesc": "部门 ID"}
    ],
    "mappings": [
      {
        "sourceField": "workcode",
        "targetField": "workcode",
        "transformRule": ""
      }
    ]
  }
}
```

### 4.2 保存字段映射

**端点**: `POST /api/bs/intcenterhr/web/basesetting/fieldmapping/save`

**请求参数**:
```json
{
  "syncId": 456,
  "mappings": [
    {
      "sourceField": "workcode",
      "targetField": "workcode",
      "transformRuleId": null
    },
    {
      "sourceField": "lastname",
      "targetField": "name",
      "transformRuleId": null
    }
  ]
}
```

---

## 5. 数据接口管理

### 5.1 获取数据接口列表

**端点**: `POST /api/bs/intcenterhr/web/datainterface/getList`

**请求参数**:
```json
{
  "page": 1,
  "pageSize": 20,
  "name": "可选 - 接口名称",
  "type": "可选 - 接口类型 (Source/Target)"
}
```

### 5.2 保存数据接口

**端点**: `POST /api/bs/intcenterhr/web/datainterface/save`

**请求参数**:
```json
{
  "id": 0,
  "name": "E9 组织人员接口",
  "type": "Source",
  "interfaceClass": "com.weaver.intcenter.hr.dataInterface.source.E9OrgPersonInterface",
  "remark": "从 E9 获取组织人员数据"
}
```

---

## 6. 手动同步执行

### 6.1 执行同步任务

**端点**: `POST /api/bs/intcenterhr/sync/executeSync`

**请求参数**:
```json
{
  "baseId": 123,
  "syncType": "FULL",  // FULL-全量，INCREMENT-增量
  "operatorId": 456
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "taskId": "TASK_20260720_001",
    "status": "RUNNING"
  },
  "msg": "同步任务已启动"
}
```

### 6.2 从错误日志重新执行

**端点**: `GET /api/bs/intcenterhr/sync/executeSyncFromErrorLog?logId={logId}`

**说明**: 针对失败的同步记录，重新执行失败的数据同步。

### 6.3 停止同步任务

**端点**: 
- `GET /api/bs/intcenterhr/sync/syncStopByBaseId/{baseId}` - 按基础设置 ID 停止
- `GET /api/bs/intcenterhr/sync/syncStopByTaskId/{taskId}` - 按任务 ID 停止

---

## 7. 同步日志查询

### 7.1 查询日志列表

**端点**: `POST /api/bs/intcenterhr/web/sync_log/getList`

**请求参数**:
```json
{
  "page": 1,
  "pageSize": 20,
  "baseId": 123,
  "syncStatus": "SUCCESS",  // SUCCESS/FAIL/RUNNING
  "startTime": "2026-07-01 00:00:00",
  "endTime": "2026-07-20 23:59:59"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "total": 50,
    "records": [
      {
        "id": 1001,
        "baseId": 123,
        "baseName": "E9 组织人员同步",
        "syncStatus": "SUCCESS",
        "totalCount": 500,
        "successCount": 500,
        "failCount": 0,
        "startTime": "2026-07-20 10:00:00",
        "endTime": "2026-07-20 10:05:30",
        "duration": 330
      }
    ]
  }
}
```

### 7.2 获取日志详情

**端点**: `POST /api/bs/intcenterhr/web/sync_log/getLogDetail`

**请求参数**:
```json
{
  "logId": 1001
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "logInfo": {...},
    "errorRecords": [
      {
        "recordId": "E9_001",
        "errorMsg": "部门 ID 不存在",
        "sourceData": {...},
        "targetData": null
      }
    ]
  }
}
```

### 7.3 导出日志

**端点**: 
- `POST /api/bs/intcenterhr/web/sync_log/export` - 导出当前页
- `POST /api/bs/intcenterhr/web/sync_log/exportAll` - 导出全部

**响应**: 返回 Excel 文件流

---

## 8. 过滤规则管理

### 8.1 保存过滤规则

**端点**: `POST /api/bs/intcenterhr/web/basesetting/filter_rule/save`

**请求参数**:
```json
{
  "syncId": 456,
  "rules": [
    {
      "field": "departmentid",
      "operator": "IN",
      "value": "1,2,3"
    },
    {
      "field": "status",
      "operator": "=",
      "value": "1"
    }
  ]
}
```

---

## 9. 转换规则管理

### 9.1 保存转换规则

**端点**: `POST /api/bs/intcenterhr/web/transformrule/save`

**请求参数**:
```json
{
  "id": 0,
  "name": "姓名拼接规则",
  "transformClass": "com.weaver.intcenter.hr.transform.NameConcatTransform",
  "remark": "将 firstName 和 lastName 拼接为 fullname"
}
```

---

## 10. 滴滴出行集成

### 10.1 获取 Token

**端点**: `POST /sapi/intcenterhr/v1/didi/getToken`

**请求参数**:
```json
{
  "appKey": "your_app_key",
  "appSecret": "your_app_secret"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "token": "didi_token_xxx",
    "expireTime": 7200
  }
}
```

### 10.2 生成签名

**端点**: `POST /sapi/intcenterhr/v1/didi/genSign`

**请求参数**:
```json
{
  "params": {...},
  "timestamp": 1658304000000
}
```

---

## 11. 数据权限查询

### 11.1 查询权限数据

**端点**: `POST /api/app/intcenterhr/web/component/data/permission/form/query`

**请求参数**:
```json
{
  "moduleId": "hr_sync",
  "userId": 456
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "canView": true,
    "canEdit": false,
    "canDelete": false,
    "allowedBaseIds": [123, 456]
  }
}
```

---

## 集成方式类型说明

| 类型 ID | 类型名称 | 说明 |
|--------|---------|------|
| E9Api | 泛微 E9 | 从 E9 系统同步数据 |
| BeisenApi | 北森 | 从北森 HR 系统同步 |
| SAP_SF | SAP SuccessFactors | 从 SF 同步 |
| Database | 数据库 | 直接从数据库读取 |
| Excel | Excel 文件 | 从 Excel 文件导入 |
| Qianlilin | 千里聆 | 消息通知集成 |
| Didi | 滴滴出行 | 差旅集成 |

---

## 常见错误码

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| 40101 | Token 无效 | 重新登录获取 Token |
| 40102 | Token 已过期 | 重新登录获取 Token |
| 40301 | 无权限访问 | 联系管理员分配权限 |
| 40401 | 资源不存在 | 检查 ID 是否正确 |
| 50001 | 接口类加载失败 | 检查接口类路径 |
| 50002 | 数据库连接失败 | 检查数据源配置 |
| 50003 | 第三方接口调用失败 | 检查第三方系统状态 |
