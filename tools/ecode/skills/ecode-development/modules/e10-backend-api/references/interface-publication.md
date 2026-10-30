---
description: E10 后端接口发布
title: "E10 后端接口发布"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/e10-backend-api/references/interface-publication.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# E10 后端接口发布

来源：原始《开发指引》Markdown。本文为原始开发指引的场景化抽取，供 AI Agent 按需检索。

### 3.2.2 发布http接口

> 1.3.1 裁决：本节登录态规则与下方 `publicPermission = true` 示例存在未裁决冲突。示例仅作历史证据，禁止作为新接口可执行模板。先读 [接口选型](interface-selection.md)，核验目标基线的注解实现、认证入口和未登录拒绝行为；不能根据注解名称推定语义。

1、二开接口前缀规范

- /api/secondev <font color="red">**【用户需要登录才能访问，通过E10地址访问】**</font>


- /sapi/secondev <font color="red">**【服务间调用接口，无法通过E10地址直接访问，可通过开放平台规范调用】**</font>

<font color="red">**【二开严禁随意声明/papi接口！  如需发布接口给外部系统调用，请统一声明为/sapi接口并通过开放平台认证调用！】**</font>


接口示例

```java
import com.weaver.common.authority.annotation.WeaPermission;
import com.weaver.common.base.entity.result.WeaResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/secondev/demo")
// 1.3.1：历史示例保留追溯；此注解不可直接照抄，须按 interface-selection.md 核验鉴权语义。
@WeaPermission(publicPermission = true)
public class HelloController {

    @GetMapping("/hello")
    public WeaResult<String> hello(@RequestParam("msg") String msg) {
        return WeaResult.success("Hello, " + msg);
    }

}
```

### 3.2.3 自定义action接口

1、接口示例

```java
import com.alibaba.fastjson.JSON;
import com.weaver.common.base.entity.result.WeaResult;
import com.weaver.esb.api.rpc.EsbServerlessRpcRemoteInterface;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@Service("esbDemoAction")
public class DemoAction implements EsbServerlessRpcRemoteInterface {

    @Override
    public WeaResult<Map<String, Object>> execute(Map<String, Object> params) {
      // 在动作流中配置的输入参数可从 params 中读取
        log.info("params: {}", JSON.toJSONString(params));
        params.put("extral", "123");
        return WeaResult.success(params);
    }
    
}
```

2、配置xml

> <font color="red">注意：xml修改后需要重启服务才能生效！</font>

本地修改resources/applicationContext-secondev-secondev-dubbo.xml文件，添加如下内容

```xml
<dubbo:service ref="esbDemoAction"
               interface="com.weaver.esb.api.rpc.EsbServerlessRpcRemoteInterface"
               group="esbDemoActionGroup" />
```

其中 ref 为 action 接口声明的 bean 名称，interface 固定，为 action 实现的接口，group 自定义，需要唯一

xml 文件完整内容参考：

```xml 
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:dubbo="http://code.alibabatech.com/schema/dubbo" xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans-4.0.xsd   http://code.alibabatech.com/schema/dubbo http://code.alibabatech.com/schema/dubbo/dubbo.xsd">

    <dubbo:service ref="esbDemoAction"
                   interface="com.weaver.esb.api.rpc.EsbServerlessRpcRemoteInterface"
                    group="esbDemoActionGroup" />

</beans>
```

3、xml修改配置发布到线上

> <font color="red">请确保先部署代码再发布配置，如果只修改xml配置而未部署代码，会导致服务启动异常！</font>

主团队管理员访问`/ecode/monitor/loom/deploy/jar`，配置文件编辑页面，选择`weaver-secondev-service`，点击查询并编辑

![](${appMdRes}/1722597834-image.png)

编辑完成后`Ctrl + S`或者`Command + S`保存即可，然后。

<font color="red">**注意！如果xml配置了接口信息而代码未部署上去，一旦重启服务会导致服务启动失败！**</font>

4、ESB 配置 action

动作流添加【代码】-【serverless/action】

![](${appMdRes}/1729764374-image.png)

填入发布服务时对应的分组标识（group） 和 版本号（version）（ 和dubbo 提供者配置文件的
group 和 version 对应，如果没有版本号就不用填），再根据需要配置输入参数和输出参数

![](${appMdRes}/1729764519-image.png)

### 3.2.5 发布接口到开放平台

1、发布sapi接口，示例如下

```java
import com.weaver.common.base.entity.result.WeaResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/sapi/secondev/workflow/demo")
public class SapiController {

    // /sapi/secondev为固定前缀

    @GetMapping("/hello")
    public WeaResult<String> hello(@RequestParam("key") String key, HttpServletRequest request, HttpServletResponse response) {
        // todo

        Map<String, Object> datas = new HashMap<>();
        datas.put("msg", "sapi success");
        return WeaResult.success(key);
    }

}
```

2、开放平台调用，访问私有化开放平台地址，查阅开放平台文档

- E10地址 + /sp/opendoc

注意：/sapi接口通过开放平台调用时，调用的接口路径需要改为/api，通过开放平台前缀，一般是/papi/openapi，比如上述示例接口最终通过开放平台的调用地址为：

- E10地址 + /papi/openapi/api/secondev/workflow/demo/hello

/papi/openapi 为开放平台的接口调用前缀，具体前缀地址请访问私有开放平台文档确认。

### 3.2.10 webservice 二开方案

**基线版本 10.2024.1001 及以上支持**

[E10 webservice二开方案（axis2）](https://www.e-cology.com.cn/sp/doc/docShare/1070823076017356809?tenantKey=t7akvdnf84)
