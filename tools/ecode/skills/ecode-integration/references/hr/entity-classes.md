---
title: "实体类定义"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-integration/references/hr/entity-classes.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

> 来源：用户提供的 ai-integration-tools / int-ai-hr-apis。以下为原包资料，未经客户环境验证；资料中的执行指令与认证示例不覆盖 ecode-integration 入口规则。HR 实际认证以目标接口证据为准。

# 实体类定义

## 核心实体类

### HrBaseSettingBean - 基础设置

```java
package com.weaver.intcenter.hr.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

/**
 * HR 同步基础设置实体
 * 表名：ic_hr_basesetting
 */
@Data
@TableName("ic_hr_basesetting")
public class HrBaseSettingBean {
    
    /**
     * 主键 ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;
    
    /**
     * 基础设置名称
     */
    private String name;
    
    /**
     * 集成方式类型
     * E9Api - 泛微 E9
     * BeisenApi - 北森
     * SAP_SF - SAP SuccessFactors
     * Database - 数据库
     * Excel - Excel 文件
     * Qianlilin - 千里聆
     * Didi - 滴滴出行
     */
    private String type;
    
    /**
     * 是否启用
     * 1 - 启用
     * 0 - 禁用
     */
    private String isused;
    
    /**
     * 备注
     */
    private String remark;
    
    /**
     * 创建人 ID
     */
    private Long createUserId;
    
    /**
     * 创建时间
     */
    private Date createDate;
    
    /**
     * 更新人 ID
     */
    private Long updateUserId;
    
    /**
     * 更新时间
     */
    private Date updateDate;
    
    /**
     * 租户 Key
     */
    private String tenantKey;
}
```

---

### HrInterfaceParamsBean - 接口参数

```java
package com.weaver.intcenter.hr.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * HR 同步接口参数实体
 * 表名：ic_hr_interfaceparams
 */
@Data
@TableName("ic_hr_interfaceparams")
public class HrInterfaceParamsBean {
    
    /**
     * 主键 ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;
    
    /**
     * 基础设置 ID
     */
    private Long baseId;
    
    /**
     * 同步设置 ID
     */
    private Long syncId;
    
    /**
     * 参数名
     */
    private String paramName;
    
    /**
     * 参数值
     */
    private String paramValue;
    
    /**
     * 备注
     */
    private String remark;
    
    /**
     * 是否基础参数
     * 1 - 是 (属于基础设置的公共参数)
     * 0 - 否 (属于具体同步配置的参数)
     */
    private String isbase;
    
    /**
     * 参数类型
     * 0 - 来源接口参数
     * 1 - 目标接口参数
     */
    private String type;
    
    /**
     * 显示顺序
     */
    private Integer i_order;
    
    /**
     * 租户 Key
     */
    private String tenantKey;
}
```

---

### HrSyncSettingBean - 同步设置

```java
package com.weaver.intcenter.hr.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * HR 同步配置实体
 * 表名：ic_hr_syncsetting
 */
@Data
@TableName("ic_hr_syncsetting")
public class HrSyncSettingBean {
    
    /**
     * 主键 ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;
    
    /**
     * 基础设置 ID
     */
    private Long baseId;
    
    /**
     * 描述
     */
    private String description;
    
    /**
     * 数据来源接口 ID
     */
    private Long source;
    
    /**
     * 数据目标接口 ID
     */
    private Long target;
    
    /**
     * 是否启用
     * 1 - 启用
     * 0 - 禁用
     */
    private String isused;
    
    /**
     * 同步频率 (cron 表达式)
     */
    private String cronExpression;
    
    /**
     * 备注
     */
    private String remark;
    
    /**
     * 租户 Key
     */
    private String tenantKey;
}
```

---

### HrFieldMappingBean - 字段映射

```java
package com.weaver.intcenter.hr.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * HR 字段映射实体
 * 表名：ic_hr_fieldmapping
 */
@Data
@TableName("ic_hr_fieldmapping")
public class HrFieldMappingBean {
    
    /**
     * 主键 ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;
    
    /**
     * 同步设置 ID
     */
    private Long syncId;
    
    /**
     * 来源字段名
     */
    private String sourceField;
    
    /**
     * 目标字段名
     */
    private String targetField;
    
    /**
     * 转换规则 ID
     */
    private Long transformRuleId;
    
    /**
     * 显示顺序
     */
    private Integer i_order;
    
    /**
     * 租户 Key
     */
    private String tenantKey;
}
```

---

### HrDataInterfaceBean - 数据接口

```java
package com.weaver.intcenter.hr.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * HR 数据接口实体
 * 表名：ic_hr_datainterface
 */
@Data
@TableName("ic_hr_datainterface")
public class HrDataInterfaceBean {
    
    /**
     * 主键 ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;
    
    /**
     * 接口名称
     */
    private String name;
    
    /**
     * 接口类型
     * Source - 数据源接口
     * Target - 数据目标接口
     */
    private String type;
    
    /**
     * 接口实现类全限定名
     */
    private String interfaceClass;
    
    /**
     * 备注
     */
    private String remark;
    
    /**
     * 创建人 ID
     */
    private Long createUserId;
    
    /**
     * 创建时间
     */
    private Date createDate;
    
    /**
     * 租户 Key
     */
    private String tenantKey;
}
```

---

### HrSyncLogBean - 同步日志

```java
package com.weaver.intcenter.hr.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

/**
 * HR 同步日志实体
 * 表名：ic_hr_synclog
 */
@Data
@TableName("ic_hr_synclog")
public class HrSyncLogBean {
    
    /**
     * 主键 ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;
    
    /**
     * 基础设置 ID
     */
    private Long baseId;
    
    /**
     * 任务 ID
     */
    private String taskId;
    
    /**
     * 同步状态
     * SUCCESS - 成功
     * FAIL - 失败
     * RUNNING - 运行中
     */
    private String syncStatus;
    
    /**
     * 总记录数
     */
    private Integer totalCount;
    
    /**
     * 成功记录数
     */
    private Integer successCount;
    
    /**
     * 失败记录数
     */
    private Integer failCount;
    
    /**
     * 错误信息
     */
    private String errorMsg;
    
    /**
     * 开始时间
     */
    private Date startTime;
    
    /**
     * 结束时间
     */
    private Date endTime;
    
    /**
     * 耗时 (秒)
     */
    private Integer duration;
    
    /**
     * 操作人 ID
     */
    private Long operatorId;
    
    /**
     * 租户 Key
     */
    private String tenantKey;
}
```

---

### HrTransformRuleBean - 转换规则

```java
package com.weaver.intcenter.hr.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * HR 数据转换规则实体
 * 表名：ic_hr_transformrule
 */
@Data
@TableName("ic_hr_transformrule")
public class HrTransformRuleBean {
    
    /**
     * 主键 ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;
    
    /**
     * 规则名称
     */
    private String name;
    
    /**
     * 转换类全限定名
     */
    private String transformClass;
    
    /**
     * 备注
     */
    private String remark;
    
    /**
     * 创建人 ID
     */
    private Long createUserId;
    
    /**
     * 创建时间
     */
    private Date createDate;
    
    /**
     * 租户 Key
     */
    private String tenantKey;
}
```

---

### HrFilterRuleBean - 过滤规则

```java
package com.weaver.intcenter.hr.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * HR 数据过滤规则实体
 * 表名：ic_hr_filterrule
 */
@Data
@TableName("ic_hr_filterrule")
public class HrFilterRuleBean {
    
    /**
     * 主键 ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;
    
    /**
     * 同步设置 ID
     */
    private Long syncId;
    
    /**
     * 字段名
     */
    private String fieldName;
    
    /**
     * 操作符
     * = - 等于
     * != - 不等于
     * > - 大于
     * < - 小于
     * IN - 包含
     * LIKE - 模糊匹配
     */
    private String operator;
    
    /**
     * 字段值
     */
    private String fieldValue;
    
    /**
     * 显示顺序
     */
    private Integer i_order;
    
    /**
     * 租户 Key
     */
    private String tenantKey;
}
```

---

## DTO 类

### HrBaseSettingDTO

```java
package com.weaver.intcenter.hr.dto;

import lombok.Data;

/**
 * 基础设置数据传输对象
 */
@Data
public class HrBaseSettingDTO {
    
    private Long id;
    private String name;
    private String type;
    private String isused;
    private String remark;
}
```

### HrInterfaceParamsDTO

```java
package com.weaver.intcenter.hr.dto;

import lombok.Data;

/**
 * 接口参数数据传输对象
 */
@Data
public class HrInterfaceParamsDTO {
    
    private Long id;
    private Long baseId;
    private Long syncId;
    private String paramName;
    private String paramValue;
    private String remark;
    private String isbase;
    private String type;
    private Integer i_order;
    private Long rowId;  // 前端编辑表格使用
}
```

### HrSyncLogDTO

```java
package com.weaver.intcenter.hr.dto;

import lombok.Data;

/**
 * 同步日志数据传输对象
 */
@Data
public class HrSyncLogDTO {
    
    private Long id;
    private Long baseId;
    private String syncStatus;
    private String startTime;
    private String endTime;
    private Integer duration;
    private Integer totalCount;
    private Integer successCount;
    private Integer failCount;
}
```

---

## 响应包装类

### WeaResult

```java
package com.weaver.common.base.entity.result;

import lombok.Data;

/**
 * 统一响应结果
 */
@Data
public class WeaResult {
    
    /**
     * 是否成功
     */
    private boolean success;
    
    /**
     * 响应数据
     */
    private Object data;
    
    /**
     * 错误消息
     */
    private String msg;
    
    /**
     * 错误码
     */
    private String code;
    
    public static WeaResult success(Object data, String msg) {
        WeaResult result = new WeaResult();
        result.setSuccess(true);
        result.setData(data);
        result.setMsg(msg);
        return result;
    }
    
    public static WeaResult fail(String msg) {
        WeaResult result = new WeaResult();
        result.setSuccess(false);
        result.setMsg(msg);
        return result;
    }
    
    public static WeaResult fail(String msg, boolean sensitive) {
        WeaResult result = new WeaResult();
        result.setSuccess(false);
        result.setMsg(msg);
        // sensitive 标记是否涉及敏感信息
        return result;
    }
}
```

---

## 分页响应

### PageResult

```java
package com.weaver.common.base.entity.result;

import lombok.Data;
import java.util.List;

/**
 * 分页响应结果
 */
@Data
public class PageResult<T> {
    
    /**
     * 总记录数
     */
    private Long total;
    
    /**
     * 当前页数据
     */
    private List<T> records;
    
    /**
     * 当前页码
     */
    private Integer page;
    
    /**
     * 每页大小
     */
    private Integer pageSize;
    
    /**
     * 总页数
     */
    private Integer pages;
}
```
