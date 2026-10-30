---
title: "E10 后端埋点开发"
publicId: "e3ea1960-6285-41bb-8ba6-b3bea1666549"
source: "https://weapp.eteams.cn/build/techdoc/wdoc/index.html#/public/doc/e3ea1960-6285-41bb-8ba6-b3bea1666549"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/e10-backend-api/references/backend-hook-development.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

### 相关依赖

```xml
<dependency>
 	<groupId>com.weaver</groupId>
	<artifactId>weaver-loom-sdk</artifactId>
</dependency>
```

### 模块标准接口/方法允许二开拦截复写

模块在允许二开拦截复写的类或方法上增加注解：

```java
public @interface WeaHookApi {

    // 口子唯一标识，如WORKFLOW_LIST_HOOK_001
    String code();

    // 模块标识，如workflow
    String module();

    // 接口描述
    String desc() default "";

}
```

声明在类上，则标识该类下的所有方法都允许二开拦截，声明之后需要注意后续升级该接口，需要是向下兼容的，**参数数量、类型**不能变动，否则会影响已经做了拦截的二开代码

### 模块二开埋点

定义一个常量String，增加注解声明钩子事件：

```java
import com.weaver.loom.api.enums.WeaHookModuleInfo;
import com.weaver.loom.context.annotation.WeaHook;
import com.weaver.loom.context.annotation.WeaHookDef;
import com.weaver.loom.context.domain.WeaHookCommonRequest;
import com.weaver.loom.context.domain.WeaHookCommonResponse;
import com.weaver.loom.context.domain.WeaHookResponse;
import com.weaver.loom.context.register.RegHookEventActuator;


@WeaHookDef(moduleInfo = WeaHookModuleInfo.WORKFLOW_PATHDEF)
public class WeaHookDemo {
    //code 埋点code
    //owner 所属服务
    //descLableId 描述多语言标签
    //desc 钩子描述
    @WeaHook(code = "WORKFLOW_LIST_HOOK_001", owner = "workflow", descLabelId = 11111, desc = "流程列表详情获取钩子")
    public static String WORKFLOW_LIST_HOOK_001 = "WORKFLOW_LIST_HOOK_001";

    @WeaHook(code = "WORKFLOW_LIST_HOOK_002", owner = "workflow", descLabelId = 11111, desc = "流程列表扩展操作钩子", requestType = WeaHookCommonRequest.class, responseType = WeaHookCommonResponse.class)
    public static String WORKFLOW_LIST_HOOK_002 = "WORKFLOW_LIST_HOOK_002";

}

```

其中code为钩子唯一标识，需按规范定义，格式如下：

{模块标识} + {应用标识} + {场景}  + {序号}

示例：流程列表详情钩子001 WORKFLOW_LIST_HOOK_001

在标准代码中埋点，执行具体的钩子事件（**需要处理异常，避免影响标准接口**）

模块埋点开发人员如需本服务自测，需按当前项目调试规范处理。此方式仅用于测试，不允许实际二开使用。

模块判断是否存在此埋点code的二开方法：  
**com.weaver.loom.context.util.LoomHookUtil#checkHasWeaHookRegCode **  
**参数：String hookCode 埋点code**

```java
@Autowired
LoomHookUtil loomHookUtil;
boolean hasHook = loomHookUtil.checkHasWeaHookRegCode(WeaHookDemo.WORKFLOW_LIST_HOOK_002);
```

  
**模块方业务代码逻辑实现：****模块可选则两种执行方式，【向上抛出异常信息】 和 【不抛出异常信息】 执行方式**

```java
@Autowired
RegHookEventActuator regHookEventActuator;

public void method() {

	// 模块方业务代码todo

    try{
        //判断是否存在 WeaHookDemo.WORKFLOW_LIST_HOOK_001 的二开代码
        boolean hasWeaHook = LoomHookUtil.checkHasWeaHookRegCode(WeaHookDemo.WORKFLOW_LIST_HOOK_001);
        if(hasWeaHook) {//存在二开时执行
            //入参
            Map<String, Object> params = Maps.newHashMap();
 	        WeaHookRequest weaHookRequest = new WeaHookCommonRequest();
            weaHookRequest.setParams(params);
            
            //执行 报错会将异常信息抛到上层
            WeaHookResponse response = regHookEventActuator.execute(WeaHookDemo.WORKFLOW_LIST_HOOK_001, weaHookRequest);
            //不抛出异常的执行  报错不会抛出异常信息
            WeaHookResponse response = regHookEventActuator.executeNoThrow(WeaHookDemo.WORKFLOW_LIST_HOOK_001, weaHookRequest);

            //-----------------------------------------------------------------------------------------------------------------------------
            //250401基线后可使用 控制执行时是否记录日志 （不传默认true）false标识该执行所有二开逻辑不记录执行日志（是指执行日志，不是代码中的log.err、log.info日志）
            WeaHookResponse response = regHookEventActuator.execute(WeaHookDemo.WORKFLOW_LIST_HOOK_001, weaHookRequest, false);
            //不抛出异常的执行  报错不会抛出异常信息
            WeaHookResponse response = regHookEventActuator.executeNoThrow(WeaHookDemo.WORKFLOW_LIST_HOOK_001, weaHookRequest, false);

            //处理返回的数据
            //在二开代码状态关闭或一键屏蔽二开代码后 response.getResult()=null
            Object result = response.getResult();
        }
     } catch (Exception e) {
        //捕获异常处理避免影响标准接口
        e.printStackTrace();
     }

    // 模块方业务代码todo

}
```

### 二开跨服务触发使用(二次开发埋点触发执行)

> 二开通过模块名称+事件名称进行事件的注册
> 
> **！！！二开代码的包目录前三级必须是com.weaver.seconddev 否则不会执行，例：com.weaver.seconddev.wfsubmit.xxx.xxx**

```java
package com.weaver.seconddev.wfsubmit.action.reghook;

import cn.hutool.core.date.DateUtil;
import com.weaver.loom.context.annotation.WeaHookReg;
import com.weaver.loom.context.domain.AppInfo;
import com.weaver.loom.context.domain.WeaHookRequest;
import com.weaver.loom.context.domain.WeaHookResponse;
import com.weaver.loom.context.register.RegHookEvent;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;

@Slf4j
//普通使用   可以指定code（埋点code） 、 order（执行顺序）、sync（是否异步执行）、status（初始状态） 
@WeaHookReg(code = "WORKFLOW_REPORT_HOOK_001", order = 0)
//高级使用 250401基线后可使用
//增加属性  tenantKeys（生效范围租户，默认all_teams），enableLog（此二开是否记录执行日志,默认开启）
//执行日志指监控平台页面可以查看的埋点执行相关的日志， 不是 log.info、log.err打印的日志
@WeaHookReg(code = "WORKFLOW_REPORT_HOOK_001", order = 0，tenantKeys = {"租户1", "租户2"}, enableLog = false)
public class WeaHookRegDemo extends RegHookEvent {

    protected static final Logger log = LoggerFactory.getLogger(WeaHookRegDemo.class);
    @Override
    public WeaHookResponse handle(WeaHookRequest request, WeaHookResponse response, AppInfo appInfo) throws Exception {
        //入参，修改入参并不会影响到埋点的原始数据
        Map<String, Object> params = request.getParams();
        //前面同一埋点多个二开，前面链路节点二开代码执行的结果
        Object result = response.getResult();
        if (result != null) {
            //todo 处理params 与 传进来的前面链路的 result
            //如 未读取response 中的result数据 直接将新的数据写入response 会覆盖前面链路的返回值
            
            response.setResult(result);
        } else {
            //todo 将结果写入response
            //如果没有实际的返回数据可以不设置result，不要自己插入不支持序列化的类型，不然会报错
            response.setResult(result);
        }
        return response;//返回结果
    }

    @Override
    public void rollBack(WeaHookRequest request, WeaHookResponse response, AppInfo appInfo) throws Exception {
        //todo
        //自定义二开代码异常回滚逻辑
        log.info("执行事件回滚机制 => {}, {}", DateUtil.now(), appInfo.getAppName());
    }
}
```

### **二开埋点基础属性解析**

**WeaHookRequest 用于给二开代码传递前置参数**

| 属性名 | 类型 | 描述 | 是否必填 |
| --- | --- | --- | --- |
| **params** | Map<String, Object> | 埋点执行入参,传入**数据需要支持序列化**,用于给二开代码传递参数 | false |
| appInfo | AppInfo | 服务信息，自动传递，无需填写 | false |
| ~~context~~ | ~~WeaHookContext~~ | ~~**已废弃**~~ | ~~false~~ |

**WeaHookResponse 接收返回数据，错误堆栈，耗时信息，用于返回给模块和给多个顺序执行的后续二开代码传递前面的结果值**

| 属性名 | 类型 | 描述 | 是否必填 |
| --- | --- | --- | --- |
| **result** | Object | 返回结果，二开代码传入的数据必须是**支持序列化**的，否则报错 | false |
| elapsedTime | Map<String, String> | 用于记录埋点的执行时间，自动记录无需二开插入，模块可以取出使用 | false |
| outErrorCode | OutErrorCode | OA标准异常信息类，自动记录，无需二开插入 | false |

模块对接完埋点代码之后，请自觉填写以下文档：[https://www.e-cology.com.cn/sp/doc/docDetail/8141031801246711669___emGid=1710310285705014252&_isEm=1](https://www.e-cology.com.cn/sp/doc/docDetail/8141031801246711669___emGid=1710310285705014252&_isEm=1)
