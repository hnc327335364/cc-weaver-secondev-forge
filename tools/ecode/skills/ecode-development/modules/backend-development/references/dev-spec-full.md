---
description: 后端开发完整规范（按章节加载）
alwaysApply: false
title: "后端开发完整规范"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/backend-development/references/dev-spec-full.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 后端开发完整规范

> 本文只适用于后端 Java 二次开发，内容较长。必须先读取 `../../backend-development/references/baseline.md`，再根据具体场景只读取目标章节。纯前端任务禁止加载本文。

## 0. 前置规则

- 禁止使用 `/papi` 前缀
- 发布http接口给前台登录用户访问时，使用`/api` 前缀
- 发布http接口给第三方系统调用时，使用`/sapi` 前缀
- 接口文档中有相对应的API时，优先调用API实现需求，而不是编写自定义SQL

## 1. 项目概述

### 1.1 技术栈
- **语言**: Java
- **框架**: SpringBoot, SpringCloud, Dubbo
- **服务注册**: Nacos
- **缓存**: Redis

### 1.2 服务架构
- **二开服务**: `weaver-secondev-service`
- **接口前缀**:
    - `/api/secondev/*` - 需登录接口
    - `/sapi/secondev/*` - 服务间调用接口
- **严禁**: 禁止使用 `/papi` 接口

---

## 2. 包命名规范

| 层级 | 包名 | 说明 |
|------|------|------|
| Controller | `com.weaver.seconddev.{module}.controller` | REST接口 |
| Service | `com.weaver.seconddev.{module}.service` | 业务逻辑 |
| Entity | `com.weaver.seconddev.{module}.entity` | 数据实体 |
| Config | `com.weaver.seconddev.{module}.config` | 配置类 |
| Action | `com.weaver.seconddev.{module}.action` | ESB Action |

---

## 3. 代码规范

### 3.1 Controller规范

> 1.3.1 裁决：以下保留历史模板。先读 [接口选型](../../e10-backend-api/references/interface-selection.md)，按实际调用方与目标基线核验鉴权。正文“需登录”与 publicPermission=true/无需鉴权 注释存在语义冲突，未经目标依赖证实，不得复制该注解或默认读取当前用户。固定 alive 等无数据接口不添加无关用户/租户参数。


**标准模板:**
```java
// ============================================
// 类名: {Module}Controller
// 说明: 模块功能描述
// 路径: /api/secondev/{module}
// ============================================

package com.weaver.seconddev.demo.controller;

import com.weaver.common.authority.annotation.WeaPermission;
import com.weaver.common.base.entity.result.WeaResult;
import com.weaver.teams.security.context.UserContext;
import com.weaver.teams.security.user.User;
import org.springframework.web.bind.annotation.*;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/secondev/demo")
@WeaPermission(publicPermission = true)  // true=无需鉴权, false=需鉴权
public class DemoController {
    
    private static final Logger log = LoggerFactory.getLogger(DemoController.class);

    /**
     * GET接口示例
     * @param msg 消息参数
     * @return 标准响应
     */
    @GetMapping("/hello")
    public WeaResult<String> hello(@RequestParam("msg") String msg) {
        log.info("Request params: {}", msg);
        return WeaResult.success("Hello, " + msg);
    }

    /**
     * POST接口示例 - JSON参数
     */
    @PostMapping("/save")
    public WeaResult<Map<String, Object>> save(@RequestBody Map<String, Object> params) {
        // 获取当前用户
        User currentUser = UserContext.getCurrentUser();
        Long employeeId = currentUser.getEmployeeId();
        String tenantKey = currentUser.getTenantKey();
        
        log.info("Current user: {}, tenant: {}", employeeId, tenantKey);
        
        return WeaResult.success(params);
    }

    /**
     * POST接口示例 - 表单参数
     */
    @PostMapping("/form")
    public WeaResult<String> form(@RequestParam("key") String key,
                                   @RequestParam("value") String value) {
        return WeaResult.success(key + "=" + value);
    }
}
```

**SAPI接口(服务间调用):**
```java
// ============================================
// SAPI接口 - 用于服务间调用或开放平台
// ============================================

package com.weaver.seconddev.workflow.controller;

import com.weaver.common.base.entity.result.WeaResult;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/sapi/secondev/workflow")
public class WorkflowSapiController {

    @GetMapping("/hello")
    public WeaResult<String> hello(@RequestParam("key") String key,
                                    HttpServletRequest request,
                                    HttpServletResponse response) {
        // SAPI接口逻辑
        return WeaResult.success(key);
    }
}
```

### 3.2 数据库操作规范

**数据源类型:**
| 类型 | 说明 | 使用场景 |
|------|------|----------|
| LOGIC | 内部数据源 | OA模块系统默认数据源 |
| EXTERNAL | 外部数据源 | 数据加工配置的外部连接 |
| ETEAMS | 数据仓库 | 公共数据仓库 |
| FORM | ebuilder表单 | EB表单数据 |

**SQL执行工具类(推荐250501基线+):**
```java
// ============================================
// 数据库操作 - 使用SecondevDataSetUtil
// 支持基线: 10.0.2505.01+
// ============================================

package com.weaver.seconddev.service;

import com.weaver.common.base.entity.result.WeaResult;
import com.weaver.ebuilder.datasource.api.entity.SqlParamEntity;
import com.weaver.ebuilder.datasource.api.enums.SourceType;
import com.weaver.ebuilder.datasource.api.enums.SqlParamType;
import com.weaver.secondev.api.util.SecondevDataSetUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class DataService {
    
    private static final Logger log = LoggerFactory.getLogger(DataService.class);

    @Autowired
    private SecondevDataSetUtil dataSetUtil;

    /**
     * 获取数据源分组
     */
    public void getDataGroups() {
        // LOGIC类型数据源
        Map<String, Object> logicGroups = dataSetUtil.getDataGroups("LOGIC");
        // EXTERNAL类型数据源
        Map<String, Object> externalGroups = dataSetUtil.getDataGroups("EXTERNAL");
    }

    /**
     * 执行普通SQL
     */
    public Map<String, Object> executeSql() {
        String groupId = "weaver-workflow-list-service";
        String sql = "SELECT * FROM table_name WHERE id = 111";
        
        return dataSetUtil.executeSql(SourceType.LOGIC, groupId, sql, null);
    }

    /**
     * 执行预编译SQL
     */
    public Map<String, Object> executePreparedSql() {
        String groupId = "external_group_id";
        String sql = "SELECT * FROM table WHERE tenant_key = ? AND delete_type = ?";
        
        // 构建参数(顺序必须与SQL中?一致)
        List<SqlParamEntity> params = new ArrayList<>();
        
        SqlParamEntity param1 = new SqlParamEntity();
        param1.setParamType(SqlParamType.VARCHAR);
        param1.setValue("tenant_key_value");
        params.add(param1);
        
        SqlParamEntity param2 = new SqlParamEntity();
        param2.setParamType(SqlParamType.INTEGER);
        param2.setValue("0");
        params.add(param2);
        
        return dataSetUtil.executeSql(SourceType.EXTERNAL, groupId, sql, params);
    }

    /**
     * 带事务执行SQL (仅LOGIC支持)
     */
    public WeaResult<String> executeWithTransaction() {
        String groupId = "weaver-workflow-list-service";
        String tenantKey = "your_tenant_key";
        
        // 生成事务ID
        String transId = String.valueOf(com.weaver.common.distribution.genid.IdGenerator.generate());
        
        try {
            // 开启事务并执行SQL1
            dataSetUtil.executeSqlWithTrans(
                SourceType.LOGIC, 
                groupId,
                "UPDATE table SET field1 = 'value1' WHERE id = 1",
                null, transId, true, false, false
            );
            
            // 在同一事务中执行SQL2
            dataSetUtil.executeSqlWithTrans(
                SourceType.LOGIC,
                groupId,
                "UPDATE table SET field2 = 'value2' WHERE id = 1",
                null, transId, true, false, false
            );
            
            // 提交事务
            dataSetUtil.executeSqlWithTrans(
                SourceType.LOGIC, groupId, "", 
                null, transId, true, true, false
            );
            
            return WeaResult.success("Transaction committed");
        } catch (Exception e) {
            log.error("Transaction error", e);
            // 回滚事务
            dataSetUtil.executeSqlWithTrans(
                SourceType.LOGIC, groupId, "",
                null, transId, true, false, true
            );
            throw e;
        }
    }
}
```

**预编译参数类型:**
| 类型 | 说明 |
|------|------|
| `SqlParamType.VARCHAR` | 字符串 |
| `SqlParamType.INTEGER` | 整数 |
| `SqlParamType.BIGINT` | 长整数 |
| `SqlParamType.LONG` | Long类型 |
| `SqlParamType.DOUBLE` | 双精度浮点 |
| `SqlParamType.DATE` | 日期 |
| `SqlParamType.DATETIME` | 日期时间 |

### 3.3 ESB Action开发规范

**Action接口实现:**
```java
// ============================================
// ESB Action接口
// 用于动作流中调用
// ============================================

package com.weaver.seconddev.action;

import com.alibaba.fastjson.JSON;
import com.weaver.common.base.entity.result.WeaResult;
import com.weaver.esb.api.rpc.EsbServerlessRpcRemoteInterface;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Map;

@Service("esbDemoAction")  // bean名称，唯一
public class DemoAction implements EsbServerlessRpcRemoteInterface {
    
    private static final Logger log = LoggerFactory.getLogger(DemoAction.class);

    @Override
    public WeaResult<Map<String, Object>> execute(Map<String, Object> params) {
        log.info("Action params: {}", JSON.toJSONString(params));
        
        // 业务逻辑处理
        params.put("result", "success");
        params.put("extraData", "123");
        
        return WeaResult.success(params);
    }
}
```

**Dubbo配置(xml):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:dubbo="http://code.alibabatech.com/schema/dubbo"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
       http://www.springframework.org/schema/beans/spring-beans-4.0.xsd
       http://code.alibabatech.com/schema/dubbo
       http://code.alibabatech.com/schema/dubbo/dubbo.xsd">

    <!-- ref: bean名称, interface: 固定接口, group: 自定义唯一分组 -->
    <dubbo:service 
        ref="esbDemoAction" 
        interface="com.weaver.esb.api.rpc.EsbServerlessRpcRemoteInterface"
        group="esbDemoActionGroup" 
        version="1.0.0" />

</beans>
```

**重要提醒:**
- XML修改后需要**重启服务**才能生效
- **必须先部署代码再发布配置**，否则服务启动失败

### 3.4 缓存使用规范

**缓存Key定义:**
```java
// ============================================
// 缓存Key常量定义
// 必须以 SECONDEV_ 为前缀
// ============================================

package com.weaver.seconddev.cache;

import com.weaver.common.cache.base.BaseCache;
import com.weaver.common.cache.base.ModuleCacheInterface;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;

@Component
public class SecondevCacheKey implements ModuleCacheInterface {

    @Autowired
    private BaseCache baseCache;

    // 必须以 SECONDEV_ 为前缀
    public final static String SECONDEV_TEST_MODULE = "SECONDEV_TEST_MODULE";
    public final static String SECONDEV_CACHE_KEY_PREFIX = "SECONDEV_CACHE_KEY_PREFIX";

    @PostConstruct
    @Override
    public void register() throws IllegalAccessException {
        baseCache.register(SECONDEV_TEST_MODULE, this.getClass());
    }
}
```

**缓存操作:**
```java
package com.weaver.seconddev.controller;

import com.weaver.common.base.entity.result.WeaResult;
import com.weaver.common.cache.base.BaseCache;
import com.weaver.seconddev.cache.SecondevCacheKey;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/secondev/cache")
public class CacheController {

    @Autowired
    private BaseCache baseCache;

    @PostMapping("/set")
    public WeaResult<Boolean> setCache(@RequestParam("key") String key,
                                        @RequestParam("value") String value) {
        // 设置缓存，有效期3600秒
        boolean success = baseCache.set(
            SecondevCacheKey.SECONDEV_TEST_MODULE,
            SecondevCacheKey.SECONDEV_CACHE_KEY_PREFIX + key,
            value,
            60 * 60
        );
        return WeaResult.success(success);
    }

    @GetMapping("/get")
    public WeaResult<Object> getCache(@RequestParam("key") String key) {
        Object value = baseCache.get(
            SecondevCacheKey.SECONDEV_TEST_MODULE,
            SecondevCacheKey.SECONDEV_CACHE_KEY_PREFIX + key
        );
        return WeaResult.success(value);
    }

    @DeleteMapping("/del")
    public WeaResult<Boolean> delCache(@RequestParam("key") String key) {
        boolean success = baseCache.del(
            SecondevCacheKey.SECONDEV_TEST_MODULE,
            SecondevCacheKey.SECONDEV_CACHE_KEY_PREFIX + key
        );
        return WeaResult.success(success);
    }
}
```

### 3.5 消息队列规范

**生产者:**
```java
package com.weaver.seconddev.mq;

import com.weaver.common.async.bean.AsyncBean;
import com.weaver.common.async.producer.client.AsyncClient;
import com.weaver.common.base.entity.result.WeaResult;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/sapi/secondev/mq")
public class MqProducerController {

    @Autowired
    private AsyncClient asyncClient;

    @PostMapping("/send")
    public WeaResult<String> sendMsg(@RequestParam("message") String message) {
        String queueName = "secondev_demo_queue";
        
        AsyncBean asyncBean = new AsyncBean();
        asyncBean.setQueue(queueName);
        asyncBean.setMessage(message);
        
        asyncClient.send(asyncBean);
        
        return WeaResult.success("Message sent");
    }

    @PostMapping("/broadcast")
    public WeaResult<String> broadcast(@RequestParam("message") String message) {
        String topicName = "secondev_demo_topic";
        
        AsyncBean asyncBean = new AsyncBean();
        asyncBean.setTopic(topicName);
        asyncBean.setMessage(message);
        
        asyncClient.broadCast(asyncBean);
        
        return WeaResult.success("Broadcast sent");
    }
}
```

**消费者:**
```java
package com.weaver.seconddev.mq;

import com.weaver.common.async.bean.AsyncBean;
import com.weaver.common.async.consumer.anno.method.AsyncListener;
import com.weaver.common.async.consumer.bean.listener.AsyncListenerResultBean;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class MqConsumer {
    
    private static final Logger log = LoggerFactory.getLogger(MqConsumer.class);

    @AsyncListener(queues = "secondev_demo_queue")
    public AsyncListenerResultBean receiveQueue(AsyncBean<String> message) {
        log.info("Queue consumer: {}", message.getMessage());
        
        AsyncListenerResultBean result = new AsyncListenerResultBean();
        result.setStatus(true);
        return result;
    }

    @AsyncListener(topic = "secondev_demo_topic")
    public AsyncListenerResultBean receiveTopic(AsyncBean<String> message) {
        log.info("Topic consumer: {}", message.getMessage());
        
        AsyncListenerResultBean result = new AsyncListenerResultBean();
        result.setStatus(true);
        return result;
    }
}
```

**配置文件:**
```properties
# weaver-secondev-service.properties
weaver.async.queue=secondev_demo_queue,secondev_other_queue
weaver.async.topic=secondev_demo_topic,secondev_other_topic
```

### 3.6 配置管理规范

**自定义配置:**
```java
// ============================================
// 配置类 - 支持配置中心自动刷新
// ============================================

package com.weaver.seconddev.config;

import lombok.Data;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@RefreshScope  // 支持配置中心自动刷新
public class SecDevProperty {

    @Value("${weaver.secondev.custom.url:default_url}")
    private String customUrl;

    @Value("${weaver.secondev.custom.data:default_data}")
    private String customData;

    @Value("${weaver.secondev.custom.key:default_key}")
    private String customKey;
}
```

**自定义配置文件注册:**
```java
// ============================================
// 包路径必须固定: com.weaver.custom.configcenter
// ============================================

package com.weaver.custom.configcenter;

import com.weaver.framework.client.annotation.WeaverConfigCenter;

@WeaverConfigCenter(sources = {
    @WeaverConfigCenter.ConfigProperty(
        dataId = "weaver-secondev-custom.properties",
        group = "DEFAULT_GROUP",
        refresh = "true"
    )
})
public class SecondevCustomPropertiesConfigCenter {
    // 类名自拟，但不要重复
}
```

### 3.7 分布式锁规范

```java
package com.weaver.seconddev.controller;

import com.weaver.common.base.entity.result.WeaResult;
import com.weaver.common.distribution.lock.DistributionLockInterface;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api/secondev/lock")
public class LockController {
    
    private static final Logger log = LoggerFactory.getLogger(LockController.class);

    @Autowired
    private DistributionLockInterface distributionLock;

    @GetMapping("/test")
    public WeaResult<String> testLock(@RequestParam("key") String key) throws Exception {
        // 注意: tryLock必须在try代码块外面
        boolean locked = distributionLock.tryLock(key, 30); // 30秒过期
        
        if (!locked) {
            return WeaResult.fail("获取锁失败");
        }
        
        try {
            // 业务逻辑
            Thread.sleep(5000);
            return WeaResult.success("业务处理完成");
        } finally {
            distributionLock.unLock(key);
        }
    }
}
```

### 3.8 线程池规范

```java
package com.weaver.seconddev.service;

import com.weaver.common.threadPool.ThreadPoolUtil;
import com.weaver.common.threadPool.constant.ModulePoolEnum;
import com.weaver.common.threadPool.entity.LocalRunnable;
import org.springframework.stereotype.Service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class AsyncService {
    
    private static final Logger log = LoggerFactory.getLogger(AsyncService.class);

    public void executeAsyncTask() {
        // 使用默认线程池
        ThreadPoolUtil.execute(new LocalRunnable() {
            @Override
            public void run() {
                log.info("异步任务执行");
                // 业务逻辑
            }
        });

        // 使用固定大小线程池(高并发场景)
        ThreadPoolUtil.fixedPoolExecute(
            ModulePoolEnum.erkai,
            "dataProcess",
            new LocalRunnable() {
                @Override
                public void run() {
                    log.info("高并发异步任务执行");
                    // 业务逻辑
                }
            }
        );
    }
}
```

### 3.9 调用标准服务接口

**250301基线及以上:**
```java
package com.weaver.seconddev.service;

import com.weaver.loom.admittance.entity.SecondRpcEntity;
import com.weaver.loom.admittance.util.SecondRpcUtil;
import com.weaver.loom.admittance.util.SecondSapiUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class StandardServiceCaller {

    @Autowired
    private SecondRpcUtil secondRpcUtil;

    @Autowired
    private SecondSapiUtil secondSapiUtil;

    /**
     * 调用标准Dubbo接口
     */
    public Object callDubboService(String tenantKey) {
        SecondRpcEntity rpcEntity = new SecondRpcEntity();
        rpcEntity.setServiceName("com.weaver.xxx.xxxService");
        rpcEntity.setMethodName("methodName");
        rpcEntity.setGroup("groupName");  // 可选
        rpcEntity.setVersion("1.0.0");    // 可选

        // 参数类型
        Class<?>[] types = new Class<?>[] { String.class, int.class };
        
        // 参数值
        Object[] params = new Object[] { "param1", 123 };

        return secondRpcUtil.doInvoke(rpcEntity, tenantKey, types, params);
    }

    /**
     * 调用标准SAPI接口 - GET
     */
    public Map<String, Object> callSapiGet() {
        String url = "/sapi/demo/geturl";
        Map<String, Object> params = new HashMap<>();
        params.put("param1", "value1");

        return (Map<String, Object>) secondSapiUtil.getSapiForObj(
            url, 
            params, 
            MediaType.APPLICATION_JSON, 
            Map.class
        );
    }

    /**
     * 调用标准SAPI接口 - POST JSON
     */
    public Map<String, Object> callSapiPostJson() {
        String url = "/sapi/demo/posturl";
        Map<String, Object> params = new HashMap<>();
        params.put("param1", "value1");

        return (Map<String, Object>) secondSapiUtil.postSapiForObj(
            url,
            params,
            MediaType.APPLICATION_JSON,
            Map.class
        );
    }

    /**
     * 调用标准SAPI接口 - POST Form
     */
    public Map<String, Object> callSapiPostForm() {
        String url = "/sapi/demo/posturl";
        Map<String, Object> params = new HashMap<>();
        params.put("param1", "value1");

        return (Map<String, Object>) secondSapiUtil.postSapiForForm(
            url,
            params,
            Map.class
        );
    }
}
```

---

## 4. 日志规范

### 4.1 日志输出

> 请勿使用Lombok

```java

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
public class DemoController {
    
    private static final Logger log = LoggerFactory.getLogger(DemoController.class);
    
    @GetMapping("/test")
    public WeaResult<String> test() {
        // 日志级别
        log.trace("Trace日志");
        log.debug("Debug日志");
        log.info("Info日志: {}", "参数");
        log.warn("Warn日志");
        log.error("Error日志: {}", e);
        
        return WeaResult.success("ok");
    }
}
```

### 4.2 日志文件

| 文件 | 说明 |
|------|------|
| `logs/sys-secondev.log` | 二开服务日志 |
| `logs/sys-err.log` | 错误日志 |

### 4.3 日志级别

- E10服务默认输出级别: **ERROR**
- 可通过运维平台调整日志级别

---

## 6. Continue插件提示词

### 6.1 生成Controller
```
请生成一个e-code后端Controller，要求：
1. 路径: /api/secondev/user
2. 包含增删改查接口
3. 使用WeaResult返回标准响应
4. 获取当前登录用户信息
5. 添加Slf4j日志
6. 使用@WeaPermission控制权限
```

### 6.2 生成数据库操作
```
请生成e-code数据库操作代码，要求：
1. 使用SecondevDataSetUtil工具类
2. 操作LOGIC类型数据源
3. 执行预编译SQL查询
4. 包含参数绑定
5. 添加事务处理
6. 遵循e-code后端开发规范
```

### 6.3 生成ESB Action
```
请生成一个ESB Action接口，要求：
1. 实现EsbServerlessRpcRemoteInterface
2. 处理流程相关数据
3. 返回WeaResult标准响应
4. 添加Dubbo配置示例
5. 遵循e-code后端开发规范
```

### 6.4 生成缓存操作
```
请生成e-code缓存操作代码，要求：
1. 定义缓存Key常量类
2. 实现ModuleCacheInterface
3. 包含增删查操作
4. 使用BaseCache接口
5. 缓存Key以SECONDEV_为前缀
```

---

## 附录: 常用API速查

### 用户上下文
```java
// 获取当前用户
User currentUser = UserContext.getCurrentUser();
Long employeeId = currentUser.getEmployeeId();
String tenantKey = currentUser.getTenantKey();

// Action中获取
String employeeId = TenantRpcContext.getCurrentEmployeeId();
String tenantKey = TenantRpcContext.getTenantKey();
```

### 分布式ID
```java
import com.weaver.common.distribution.genid.IdGenerator;

// 获取单个ID
long id = IdGenerator.generate();

// 获取一批ID
long[] ids = IdGenerator.generateRangeId(10);
```

### 数据库类型判断
```java
// 判断是否为达梦数据库
boolean isDM = "DM".equalsIgnoreCase(
    com.weaver.common.mybatis.baseConfig.WeaDatabaseIdProvider.databaseId
);
```

### 国际化
```java
import com.weaver.common.i18n.label.SystemEnv;
import com.weaver.common.i18n.tool.util.I18nLanguageUtil;

// 获取标签
int languageId = I18nLanguageUtil.getLangId(employeeId);
String label = SystemEnv.getHtmlLabelName(labelId, languageId, tenantKey, "默认文本");
```

---

**文档维护:** 根据e-code平台更新及时调整规范
**最后更新:** 2026-03-13
