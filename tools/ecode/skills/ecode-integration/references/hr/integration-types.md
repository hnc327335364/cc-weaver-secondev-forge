---
title: "集成方式类型说明"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-integration/references/hr/integration-types.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

> 来源：用户提供的 ai-integration-tools / int-ai-hr-apis。以下为原包资料，未经客户环境验证；资料中的执行指令与认证示例不覆盖 ecode-integration 入口规则。HR 实际认证以目标接口证据为准。

# 集成方式类型说明

## 概述

泛微 E10 HR 集成系统支持多种第三方 HR 系统的数据同步，每种集成方式对应不同的数据接口实现和参数配置。

---

## 支持的集成方式

### 1. E9Api - 泛微 E9

**类型 ID**: `E9Api`

**说明**: 从泛微 E9 Ecology 系统同步组织架构和人员数据到 E10。

**基础参数**:
| 参数名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| address | 是 | E9 系统地址 | http://e9-server.com |
| appKey | 是 | E9 开放平台 AppKey | e9_app_key_xxx |
| appSecret | 是 | E9 开放平台 AppSecret | e9_app_secret_xxx |

**支持的同步对象**:
- 分部 (SubCompany)
- 部门 (Department)
- 岗位 (Position)
- 人员 (Employee)
- 职务 (JobSet)
- 职级 (Grade)

**数据接口类**:
- 来源：`com.weaver.intcenter.hr.dataInterface.source.E9SubCompanyInterface`
- 来源：`com.weaver.intcenter.hr.dataInterface.source.E9DepartmentInterface`
- 来源：`com.weaver.intcenter.hr.dataInterface.source.E9PositionInterface`
- 来源：`com.weaver.intcenter.hr.dataInterface.source.E9EmployeeInterface`
- 目标：`com.weaver.intcenter.hr.dataInterface.target.E10SubCompanyInterface`
- 目标：`com.weaver.intcenter.hr.dataInterface.target.E10DepartmentInterface`
- 目标：`com.weaver.intcenter.hr.dataInterface.target.E10PositionInterface`
- 目标：`com.weaver.intcenter.hr.dataInterface.target.E10EmployeeInterface`

---

### 2. BeisenApi - 北森 HR

**类型 ID**: `BeisenApi`

**说明**: 从北森 iTalentX 系统同步组织人员数据。

**基础参数**:
| 参数名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| address | 是 | 北森 API 地址 | https://api.beisen.com |
| appKey | 是 | 北森应用 Key | beisen_app_key |
| appSecret | 是 | 北森应用密钥 | beisen_app_secret |
| tenantCode | 是 | 租户编码 | tenant_001 |

**支持的同步对象**:
- 公司 (Company)
- 部门 (Department)
- 员工 (Employee)
- 职位 (Position)

---

### 3. SAP_SF - SAP SuccessFactors

**类型 ID**: `SAP_SF`

**说明**: 从 SAP SuccessFactors 云 HR 系统同步数据。

**基础参数**:
| 参数名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| address | 是 | SF API 地址 | https://api.successfactors.com |
| username | 是 | SF 用户名 | sf_user |
| password | 是 | SF 密码 | sf_password |
| companyId | 是 | 公司 ID | company_001 |

**支持的同步对象**:
- 法人实体 (FOCompany)
- 业务单元 (FOBusinessUnit)
- 部门 (FODepartment)
- Division (FODivision)
- 岗位 (Position)
- 员工 (User)
- 雇佣关系 (EmpJobRelationships)

**OData 接口**:
- `/odata/v2/FOCompany`
- `/odata/v2/FOBusinessUnit`
- `/odata/v2/FODepartment`
- `/odata/v2/FODivision`
- `/odata/v2/Position`
- `/odata/v2/User`
- `/odata/v2/EmpJobRelationships`

---

### 4. Database - 数据库直连

**类型 ID**: `Database`

**说明**: 直接从数据库读取数据，适用于自定义数据源。

**基础参数**:
| 参数名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| jdbcUrl | 是 | JDBC 连接 URL | jdbc:mysql://localhost:3306/hrdb |
| username | 是 | 数据库用户名 | db_user |
| password | 是 | 数据库密码 | db_password |
| driverClass | 是 | 驱动类名 | com.mysql.cj.jdbc.Driver |

**支持的同步对象**:
- 自定义 SQL 查询的任何数据

---

### 5. Excel - Excel 文件导入

**类型 ID**: `Excel`

**说明**: 从 Excel 文件导入数据，适用于批量初始化或离线数据导入。

**基础参数**:
| 参数名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| filePath | 是 | Excel 文件路径 | /data/hr/import.xlsx |
| sheetName | 否 | 工作表名称 | 员工信息 |
| headerRow | 否 | 表头行号 (从 1 开始) | 1 |

**支持的同步对象**:
- 任意结构化数据

---

### 6. Qianlilin - 千里聆消息通知

**类型 ID**: `Qianlilin`

**说明**: 用于发送同步结果通知到千里聆消息平台。

**基础参数**:
| 参数名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| address | 是 | 千里聆服务地址 | https://qll.weaver.com.cn |
| appKey | 是 | 应用 Key | qll_app_key |
| appSecret | 是 | 应用密钥 | qll_app_secret |

**触发场景**:
- 同步任务完成
- 同步任务失败
- 同步任务警告

---

### 7. Didi - 滴滴出行集成

**类型 ID**: `Didi`

**说明**: 与滴滴出行系统集成，用于差旅管理。

**基础参数**:
| 参数名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| appKey | 是 | 滴滴应用 Key | didi_app_key |
| appSecret | 是 | 滴滴应用密钥 | didi_app_secret |

**支持的功能**:
- 员工差旅申请
- 行程同步
- 费用报销

**API 端点**:
- `POST /sapi/intcenterhr/v1/didi/getToken` - 获取 Token
- `POST /sapi/intcenterhr/v1/didi/saveToken` - 保存 Token
- `POST /sapi/intcenterhr/v1/didi/genSign` - 生成签名

---

## 集成方式对比

| 集成方式 | 适用场景 | 数据实时性 | 配置复杂度 |
|---------|---------|-----------|-----------|
| E9Api | E9→E10 迁移/双系统并存 | 高 (支持实时) | 低 |
| BeisenApi | 北森→E10 数据同步 | 中 (定时同步) | 中 |
| SAP_SF | SF→E10 数据同步 | 中 (定时同步) | 高 |
| Database | 自定义数据源 | 高 | 高 |
| Excel | 批量导入/初始化 | 低 (手动) | 低 |
| Qianlilin | 消息通知 | 实时 | 低 |
| Didi | 差旅集成 | 实时 | 中 |

---

## 添加新集成方式的步骤

1. **创建数据接口实现类**
   - 实现 `SourceDataInterface` 接口 (数据源)
   - 实现 `TargetDataInterface` 接口 (数据目标)

2. **注册接口类**
   - 在 `BaseType` 枚举中添加新类型
   - 配置接口类映射关系

3. **配置接口参数**
   - 定义必需的参数列表
   - 设置参数默认值

4. **测试验证**
   - 使用 `/check` 接口测试连通性
   - 执行小批量数据同步测试

---

## 最佳实践

### 1. E9→E10 同步

**推荐配置**:
- 使用全量 + 增量组合策略
- 首次同步使用全量模式
- 后续使用增量模式 (基于更新时间)
- 配置定时任务 (如每天凌晨 2 点)

**字段映射建议**:
- 工号 → 工号 (必填)
- 姓名 → 姓名 (必填)
- 部门 ID → 部门 ID (必填)
- 入职日期 → 入职日期

### 2. SAP SF→E10 同步

**注意事项**:
- SF 使用 OData 协议，需要处理分页
- 注意时区转换 (SF 使用 UTC 时间)
- 处理 SF 的软删除标记

**推荐配置**:
- 使用 SF 的 `createdDate` 和 `lastModified` 字段做增量同步
- 配置字段转换规则处理枚举值映射

### 3. 数据库直连

**安全建议**:
- 使用只读数据库账号
- 配置数据库连接池参数
- 避免大表全量查询

**性能优化**:
- 添加合适的索引
- 使用分页查询
- 避免跨库关联查询

---

## 常见问题

### Q1: 如何选择合适的集成方式？

**A**: 
- 如果源系统是泛微 E9 → 选择 `E9Api`
- 如果源系统是 SAP SF → 选择 `SAP_SF`
- 如果源系统是北森 → 选择 `BeisenApi`
- 如果是其他系统且有数据库权限 → 选择 `Database`
- 如果是离线数据 → 选择 `Excel`

### Q2: 多个系统同时同步如何处理？

**A**: 
- 为每个源系统创建独立的基础设置
- 配置不同的同步时间段，避免并发冲突
- 使用过滤规则隔离数据范围

### Q3: 同步失败如何处理？

**A**:
- 查看同步日志 (`HrSyncLog`) 定位错误原因
- 使用 `/executeSyncFromErrorLog` 重新执行失败记录
- 检查字段映射和转换规则配置
- 验证源系统和目标系统的网络连接

### Q4: 如何监控同步状态？

**A**:
- 配置千里聆消息通知，同步完成后自动推送
- 定期查询同步日志接口
- 使用 E10 自带的同步监控面板
