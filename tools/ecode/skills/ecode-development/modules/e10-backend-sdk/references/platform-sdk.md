---
description: E10 后端平台 SDK 与基础组件
title: "E10 后端平台 SDK 与基础组件"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/e10-backend-sdk/references/platform-sdk.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# E10 后端平台 SDK 与基础组件

来源：原始《开发指引》Markdown。本文为原始开发指引的场景化抽取，供 AI Agent 按需检索。

### 3.2.4 分布式定时任务

[E10 分布式定时任务开发文档](https://weapp.eteams.cn/ecode/playground/doc/share/view/1183645613389766657)

### 3.2.6 二开服务调用标准服务接口

**25.0301基线及之后的版本：**

1、调用标准dubbo接口

```java
package com.weaver.seconddev.action;

import com.weaver.loom.admittance.entity.SecondRpcEntity;
import com.weaver.loom.admittance.util.SecondRpcUtil;
import com.weaver.teams.security.context.UserContext;
import com.weaver.teams.security.user.User;
import com.weaver.seconddev.entity.demoEntity;
import java.util.HashMap;
import java.util.Map;

public class demoClass {
    @Autowired
    SecondRpcUtil secondRpcUtil;

    public void test() {
        User currentUser = UserContext.getCurrentUser();
        //租户key
        String tenantKey = currentUser.getTenantKey();

        //构建rpc调用接口实体类
        SecondRpcEntity secondRpcEntity = new SecondRpcEntity();
        //dubbo接口group 配置没有的可不填
        secondRpcEntity.setGroup("group");
        //dubbo接口version 配置没有的可不填
        secondRpcEntity.setVersion("version");
        //接口方法名
        secondRpcEntity.setMethodName("methodName");
        //接口全路径
        secondRpcEntity.setServiceName("com.weaver.xxx.xxx.xxx.xxxxxxxService");

        //types 目前支持两种类型Class和String
        Class<?>[] classTypes = getClassTypes();
        String[] stringTypes = getStringTypes();

        //参数
        String param1 = "参数1";
        int param2 = 2;
        //实体要转成Map,实体要支持序列化
        Map<String, Object> param3 = new HashMap<>();
        //可以增加class字段标注实体的全类名
        param3.put("class", "com.weaver.demo.entity.demoEntity");
        param3.put("id", "11111111");
        param3.put("name", "demoName"); 

        //参数的顺序 要与调用的方法的参数顺序一致  types 目前支持两种类型Class和String
        Object o = secondRpcUtil.doInvoke(secondRpcEntity, tenantKey, types, new Object[]{param1, param2, param3});
    }

    private Class<?>[] getClassTypes(){
        //要调用的参数个数 此处举例3个参数
        //参数类型
        Class<?>[] types = new Class<?>[3];
        //封装类型
        types[0] = String.class;
        //普通类型
        types[1] = int.class;
        //实体类型
        types[2] = demoEntity.class;
        return types;
    }

    private String[] getStringTypes(){
        //要调用的参数个数 此处举例3个参数
        //参数类型
        String[] types = new String[3];
        //封装类型
        types[0] = "java.lang.String";
        //普通类型
        types[1] = "int";
        //实体类型
        types[2] = "com.weaver.demo.entity.demoEntity";
        return types;
    }
}
```

2、调用标准sapi接口

```java
package com.weaver.seconddev.action;

import com.weaver.loom.admittance.util.SecondSapiUtil;
import org.springframework.http.MediaType;
import java.util.HashMap;
import java.util.Map;

public class demoClass {

    @Autowired
    SecondSapiUtil secondSapiUtil;

    public void getTestMethod() {
        //请求url
        String getUrl = "/sapi/demo/geturl"
        //参数
        Map<String, Object> getParams = new HashMap<>();
        getParams.put("param1", "1111");
        getParams.put("param2", 22222L);
        //根据自己需求传 请求类型
        MediaType mediaType = MediaType.APPLICATION_JSON;
        //返回类型
        Class<?> responseType = Map.class
        Map result = (Map) secondSapiUtil.getSapiForObj(getUrl, getParams, mediaType, responseType);
    }

    public void postTestMethod() {
        String postUrl = "/sapi/demo/posturl";
    
        //参数
        Map<String, Object> getParams = new HashMap<>();
        getParams.put("param1", "1111");
        getParams.put("param2", 22222L);
        //根据自己需求传 请求类型
        MediaType mediaType = MediaType.APPLICATION_JSON;

        //返回类型
        Class<?> responseType = Map.class;
        //Obj类型
        Map result = (Map) secondSapiUtil.postSapiForObj(postUrl , getParams, mediaType, responseType);
        //表单form类型  固定请求类型为APPLICATION_FORM_URLENCODED
        Map result1 = (Map) secondSapiUtil.postSapiForForm(postUrl , getParams, responseType);
    }
}
```

**25.0301基线之前的版本：**

1、sapi调用

```java
import com.weaver.framework.remote.client.rest.RestClient;

@Autowired
RestClient restClient;

Map response = restClient.postForObject(headers, "/sapi/dw/connSetting/getConnById", request, Map.class);
```

### 3.2.7 配置文件

**1、读取二开服务自定义配置，二开服务配置文件**`weaver-secondev-service.properties`

> 单体环境下配置文件路径：二开服务/webapps/ROOT/WEB-INF/classes/weaver/config/config-center/

> 微服务组合环境下：nacos - 配置列表

> **单体环境下修改配置后需要重启服务才生效**

```java
import lombok.Data;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.context.annotation.Configuration;


/**
 * @RefreshScope 若使用配置中心管理，则支持自动刷新同步
 * 二开服务配置文件：weaver-secondev-service.properties
 */
@Data
@Configuration
@RefreshScope
public class SecDevProperty {

    @Value("${weaver.secondev.custom.url:abcd}")
    private String moduleName;

    @Value("${weaver.secondev.custom.data:123}")
    private String customData;

    @Value("${weaver.secondev.custom.key:abcd}")
    private String customKey;

}
```

**2、使用独立配置文件**

新增配置文件，文件名 `weaver-secondev-service-txproduction.properties`，在此配置文件中增加自定义配置
此配置文件中的配置读写方式同上。

**3、使用自定义配置文件**

1. 新增配置文件，文件名自拟，要求不能与标准配置文件重名，二开服务自拟配置文件建议以【**weaver-secondev-**】作为前缀，以便区分

2. 注册自定义配置文件，在二开jar包中，固定的包路径【**com.weaver.custom.configcenter**】下，创建注册类（**类名必须唯一**），使用注解**@WeaverConfigCenter** 与**@WeaverConfigCenter.ConfigProperty**进行配置自定义配置文件属性，**一个服务只需要引入一次，不需要多个二开jar包里面写多次**

   1. dataId：自定义配置文件名
   2. group：分组
   3. refresh：是否实时刷新

   代码示例：

   ```java
   //包路径必须固定是这个
   package com.weaver.custom.configcenter;
   
   //注解包别导错了
   import com.weaver.framework.client.annotation.WeaverConfigCenter;
   
   @WeaverConfigCenter(sources = {
           @WeaverConfigCenter.ConfigProperty(
                   dataId = "weaver-loom-hookreg.properties",
                   group = "DEFAULT_GROUP",
                   refresh = "true")
   })
   //类名自拟，但是不要重复了
   public class SecondevCustomPropertiesConfigCenter {}
   
   ```

3. 注册后就可以在 二开代码中使用Spring的 @Value注解去获取配置项

### 3.2.8 缓存

步骤1：必须在模块内定义一个存放自己缓存key的常量文件，并实现ModuleCacheInterface接口

```java
import com.weaver.common.cache.base.BaseCache;
import com.weaver.common.cache.base.ModuleCacheInterface;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;

@Component
public class TestSecondevCacheKey implements ModuleCacheInterface {

    @Autowired
    private BaseCache baseCache;

    // 要求变量名和变量值必须完全保持一致，注册时会执行检测，如果不一致，系统启动时会抛出异常
    // 命名必须以 SECONDEV_ 为前缀
    public final static String SECONDEV_TEST_MODULE = "SECONDEV_TEST_MODULE";

    // 自定义缓存key，自定义key命名必须以 SECONDEV_ 为前缀
    public final static String SECONDEV_CACHE_KEY_PREFIX = "SECONDEV_CACHE_KEY_PREFIX";

    @PostConstruct
    @Override
    public void register() throws IllegalAccessException {
        baseCache.register(SECONDEV_TEST_MODULE, this.getClass());
    }
}
```

步骤2：使用缓存

```java
import com.weaver.common.cache.base.BaseCache;
import com.weaver.seconddev.workflow.myconst.TestSecondevCacheKey;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/secondev/cache")
public class TestController {

    @Autowired
    BaseCache baseCache;

    @RequestMapping("/addCache")
    public WeaResult<String> addCache() {
        String customKey = "abc";
        // 缓存时间可以选择性设置
        boolean success = baseCache.set(TestSecondevCacheKey.SECONDEV_TEST_MODULE, TestSecondevCacheKey.SECONDEV_CACHE_KEY_PREFIX + customKey, "这里是缓存的内容", 60 * 60);
        return WeaResult.success("success");
    }

    @RequestMapping("/delCache")
    public WeaResult<String>  delCache(){
        String customKey = "abc";
        boolean success = baseCache.del(TestSecondevCacheKey.SECONDEV_TEST_MODULE, TestSecondevCacheKey.SECONDEV_CACHE_KEY_PREFIX + customKey);
        return WeaResult.success("success");
    }

    @RequestMapping("/getCache")
    public WeaResult<String>  getCache(){
        String customKey = "abc";
        Object obj =  baseCache.get(TestSecondevCacheKey.SECONDEV_TEST_MODULE, TestSecondevCacheKey.SECONDEV_CACHE_KEY_PREFIX + customKey);
        return WeaResult.success("success");
    }
}
```

其他接口具体可见BaseCache接口定义：

```java
public interface BaseCache {
    /**
     * 设置指定缓存的过期时间
     * @param moduleKey
     * @param key
     * @param time
     * @return
     */
    Boolean expire(String moduleKey, String key, int time);
    Boolean expire(String moduleKey, String key, String index, int time);
    /**
     * 获取指定缓存的过期时间
     * @param moduleKey
     * @param key
     * @return
     */
    long getExpire(String moduleKey, String key);
    long getExpire(String moduleKey, String key, String index);
    /**
     * 指定的key是否存在
     * @param moduleKey
     * @param key
     * @return
     */
    boolean containsKey(String moduleKey, String key);
    boolean containsKey(String moduleKey, String key, String index);
     /**
     * 删除指定的键缓存
     * @param moduleKey
     * @param key
     */
    boolean del(String moduleKey, String key);
    boolean del(String moduleKey, String key, String index);
    /**
     * 获取指定key的值
     * @param moduleKey
     * @param key
     * @return
     */
    Object get(String moduleKey, String key);
    Object get(String moduleKey, String key, String index);
    /**
     * 将值存入缓存
     * @param moduleKey
     * @param key
     * @param value
     * @return
     */
    boolean set(String moduleKey, String key, Object value);
    boolean set(String moduleKey, String key, String index, Object value);
    /**
     * 将值存入缓存，并且设置有效时间
     * @param moduleKey
     * @param key
     * @param time
     * @return
     */
    boolean set(String moduleKey, String key, Object value, int time);
    boolean set(String moduleKey, String key, String index, Object value, int time);
    /**
     * 各模块自动注册初始化缓存
     * @param moduleKey
     * @param clazz
     */
    void register(String moduleKey, Class<?> clazz) throws IllegalAccessException;
}
```

索引缓存

```java
 /**
     * 比如此处缓存的是SECONDDEV_TEST_ID ，但是针对不同的SECONDDEV_TEST_ID 可能是多个都要缓存，
   * 底层会将key和index的值以 ：拼接为一个新key, 
   * 比如key=testId,index=2021, 缓存的key则为 testId:2021
     * @return
     */
    @RequestMapping("/addCacheWithIndex")
    public Object  addCacheWithIndex(){
        for(int i=0;i<20;i++){
            String testId= "testId"+i;
            baseCache.set(WorkflowModuleKey.WORKFLOW_MODULE, WorkflowCacheKey.SECONDDEV_TEST_ID ,
        testId,"testId="+i);
        }
        return  true;
    }
```

如需setnx、Hash、set等操作，可自行用redisTemplate。（BaseCache接口当前不提供以上操作）

### 3.2.9 消息队列

#### Queue

消息生产者

```java
import com.weaver.common.async.bean.AsyncBean;
import com.weaver.common.async.producer.client.AsyncClient;
import com.weaver.common.base.entity.result.WeaResult;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/sapi/secondev/mq/demo")
public class SapiController {

    @Autowired
    private AsyncClient asyncClient;

    @RequestMapping("/send")
    public WeaResult<String> sendMsg() {
        String mqQueue = "mq_test";
        for (int index = 0; index <= 10; index++) {
            // 发送消息
            AsyncBean asyncBean = new AsyncBean();
            // 消息队列名
            asyncBean.setQueue(mqQueue);
            // message 可以是 能序列化的对象
            asyncBean.setMessage("test_" + index); 
            // 发送消息
            this.asyncClient.send(asyncBean); 
        }
        return WeaResult.success("success");
    }
   
}

```

消费消息

```java
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import com.weaver.common.async.bean.AsyncBean;
import com.weaver.common.async.consumer.anno.method.AsyncListener;
import com.weaver.common.async.consumer.bean.listener.AsyncListenerResultBean;

import org.springframework.stereotype.Component;

@Component
public class ListenerTest {

    private static Logger log = LoggerFactory.getLogger(ListenerTest.class);

    /**
     * queues 是监听的队列名称
     * @param message
     * @return
     */
    @AsyncListener(queues = "mq_test")
    public AsyncListenerResultBean receive(AsyncBean<String> message) {
        AsyncListenerResultBean asyncListenerResultBean = new AsyncListenerResultBean();
        log.info("consumer_" + Thread.currentThread().getId() + " ::: " + message.getMessage());
        asyncListenerResultBean.setStatus(true);
        return asyncListenerResultBean;
    }
    
}

```

队列配置，二开服务配置文件 weaver-secondev-service.properties

```properties
weaver.async.queue=queue1,queue2,queue3
```

#### Topic

Topic 本质上还是队列，是广播的属性。

消息生产者

```java
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.weaver.common.async.producer.client.AsyncClient;
import com.weaver.common.async.bean.AsyncBean;

@RestController
@RequestMapping("/api/seconddev/mqTopic")
public class TopicController {
    
    @Autowired
    private AsyncClient asyncClient;

    @RequestMapping("/sendTopic")
    public WeaResult<String> sendTopic() {
        // 程序里面发了三次消息，广播到三个队列中，就会有9条数据
        for (int i = 1; i <= 3; i++) {
            String topic = "mq_test_topic" + i;
            //发送消息
            AsyncBean asyncBean = new AsyncBean();
            asyncBean.setTopic(topic);
            asyncBean.setMessage("topic模式消息发送：test_topic_" + i);
            this.asyncClient.broadCast(asyncBean);
        }
        return WeaResult.success("success");
    }
}
```

消息消费者，二开服务配置文件 weaver-secondev-service.properties

```properties
weaver.async.topic=zksh_test_topic1,zksh_test_topic2,zksh_test_topic3
```

```java
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import com.weaver.common.async.bean.AsyncBean;
import com.weaver.common.async.consumer.anno.method.AsyncListener;
import com.weaver.common.async.consumer.bean.listener.AsyncListenerResultBean;

import org.springframework.stereotype.Component;

@Component
public class ListenerTopic1 {
    
    private static Logger log = LoggerFactory.getLogger(ListenerTest.class);

    @AsyncListener(topic = "mq_test_topic1")
    public AsyncListenerResultBean receive(AsyncBean<String> message) {
        AsyncListenerResultBean asyncListenerResultBean = new AsyncListenerResultBean();
        log.info("consumer_" + Thread.currentThread().getId() + " ::: " + message.getMessage());
        asyncListenerResultBean.setStatus(true);
        return asyncListenerResultBean;
    }

}
```

### 3.2.11 国际化

在后端管理中心 -> 区域和语言中 选择自定义标签

![](${appMdRes}/1730383379-image.png)

![](${appMdRes}/1730383391-image.png)

代码中读取标签

```java
package com.weaver.seconddev.service;

import com.google.common.collect.Maps;
import com.weaver.common.base.entity.result.WeaResult;
import com.weaver.common.i18n.label.SystemEnv;
import com.weaver.common.i18n.tool.util.I18nLanguageUtil;
import com.weaver.framework.rpc.context.impl.TenantRpcContext;

import java.util.Map;

public class I18Service {

    public WeaResult<Object> index() {

        Map<String, Object> res = Maps.newHashMap();

        String tenant_key = TenantRpcContext.getTenantKey();
        Long employeeId = TenantRpcContext.getEmployeeIdLong();
        int languageId = I18nLanguageUtil.getLangId(employeeId);
        long labelId = -793306177989820417L;
        String labelVal = SystemEnv.getHtmlLabelName(labelId, languageId, tenant_key,"新建标签");
        res.put("label", );

        return WeaResult.success(res);

    }

}
```

SystemEnv.getHtmlLabelName支持占位符自动替换，固定替换规则如下:

{数值} 为固定占位符标准格式

{0} 的0代表数组下标

data数组中按照对应下标，用数组数据替换占位符

前端中使用

![](${appMdRes}/1730383592-image.png)

### 3.2.12 其他

#### 获取用户租户信息

**/api接口内获取当前用户、租户信息，**<font color="red">注意，如果是/papi接口，无法通过此方式获取，因为/papi接口不需要登录就能访问，接口请求上下文中没有用户、租户信息。</font>

```java
@GetMapping("/hello")
//@PostMapping("/post")
public WeaResult<String> hello(@RequestParam("key") String key) {
  // 获取当前用户
  final User currentUser = UserContext.getCurrentUser();
  // 用户employeeId
  final Long employeeId = currentUser.getEmployeeId();
  // 租户key
  final String tenantKey = currentUser.getTenantKey();//租户
  return WeaResult.success(key);
}
```

自定义 action 接口内部获取当前用户、租户信息：

```java
@Override
public WeaResult<Map<String, Object>> execute(Map<String, Object> params) {
  log.info("prams size is {}", params.size());
  try {
    // 能获取到的前提是当前请求上下文中存在用户、租户信息，如果是定时任务、未登录等情况下触发的动作流执行的 action 接口，上下文中是没有用户租户信息的，此时是获取不到的
    final String currentEmployeeId = TenantRpcContext.getCurrentEmployeeId();
    final String tenantKey = TenantRpcContext.getTenantKey();

    // todo

  } catch (Exception e) {
    log.error("error ", e);
  }
  return WeaResult.success();
}
```

#### 分布式UUID

> 基于雪花算法的实现
长度：18位
类型：纯数字（long型）
是否趋势增长：是

调用方法：

```java
import com.weaver.common.distribution.genid.IdGenerator;

// 获取一个ID
long id = IdGenerator.generate()；

// 获取一批ID，size是要获取的ID个数，顺序递增
long[] ids = IdGenerator.generateRangeId(int size)
```

#### 分布式锁

通过统一`DistributionLockInterface`接口方法调用，隐藏实际的分布式锁中间件细节。支持redis单机版、redis集群版、数据库版等自由配置切换。

核心接口：`DistributionLockInterface`

![](${appMdRes}/1722594658-image.png)

```java
@RestController
@RequestMapping("/lock")
public class ControllerTestDemo {
    private static Logger log = LoggerFactory.getLogger(ControllerTestDemo.class);
    
    @Autowired
    private DistributionLockInterface distributionLock;
    
    /**
     * 直接调用方法的使用方式
     * @param key
     * @return
     * @throws Exception
     */
    @GetMapping("/login1")
    public String test1(String key) throws Exception {
        // **********这里一定要注意，distributionLock.tryLock()方法一定要在try{ }代码块外面**********
        /**
         * 锁的生命周期使用默认值的API方式
         */
//        distributionLock.tryLock(key);
        /**
         * 可以设置锁的生命周期的API方式
         */
        try {
          distributionLock.tryLock(lockKey, expireTime);
          // todo
          } catch (Exception e) {
              log.error("error ", e);
          } finally {
              distributionLock.unLock(lockKey);
          }
        ...
    }
}
```

#### 线程池组件

主要核心类：`com.weaver.common.threadPool.ThreadPoolUtil`

1、 api

```java
package com.weaver.common.threadPool;

import com.weaver.common.threadPool.constant.ModulePoolEnum;
import com.weaver.common.threadPool.entity.LocalRunnable;
import com.weaver.common.threadPool.factory.ThreadPoolFactory;
import org.apache.commons.lang.StringUtils;

/*
 * 
 * 此线程池类只适用于Runnalbe接口，不适用与Callable接口
 * 如有callable业务需要，请自行使用线程池创建，并确定要关闭
 */
public class ThreadPoolUtil {

     /**
      *  使用指定名称的线程池执行异步任务(线程池名称为module+function拼接生成)<br>
      *  线程池最大并发线程数默认为10,核心线程数为0<br>
      *  并发量、延时要求较低的功能,建议优先选用此方法,避免线程资源浪费<br>
      * @param module    模块名称<br>
      * @param function    功能描述<br>
      * @param LocalRunnable    异步任务<br>
      */
     public static void execute(LocalRunnable LocalRunnable){
         execute(ModulePoolEnum.erkai, "default", ModulePoolEnum.OTHER.getMaxThread(),LocalRunnable);
     }
     
     /**
      *  使用指定名称的线程池执行异步任务(线程池名称为module+function拼接生成)<br>
      *  FixedThreadPool 线程池最大并发线程数为maximunPoolSize,核心线程数与maximunPoolSize相同<br>
      *  并发量、延时要求高的功能,选用此方法,会保持一定的线程资源占用<br>
      *  也可以使用重载方法，指定corePoolSize<maximunPoolSize<br>
      * @param module    模块名称<br>
      * @param function    功能描述<br>
      * @param LocalRunnable    异步任务<br>
      */
     public static void fixedPoolExecute(ModulePoolEnum module,String function,LocalRunnable LocalRunnable){
         execute(module, function,module.getMaxThread(),LocalRunnable);
     }
     
     /**
      *  使用指定名称的线程池执行异步任务(线程池名称为module+function拼接生成)<br>
      *  线程池最大并发线程数为maximunPoolSize<br>
      * @param module    模块名称<br>
      * @param function    功能描述<br>
      * @param maximunPoolSize    最大线程数<br>
      * @param LocalRunnable    异步任务<br>
      */
     private static void execute(ModulePoolEnum module,String function,int maximunPoolSize,LocalRunnable LocalRunnable){
         execute(module, function,maximunPoolSize, maximunPoolSize,LocalRunnable);
     }
     
     /**
      *  使用指定名称的线程池执行异步任务(线程池名称为module+function拼接生成)<br>
      *  线程池最大并发线程数为maximunPoolSize<br>
      * @param module    模块名称<br>
      * @param function    功能描述<br>
      * @param corePoolSize 核心线程数(即线程池空闲时,仍保留的线程数)<br>
      * @param maximunPoolSize    最大线程数<br>
      * @param LocalRunnable    异步任务<br>
      */
     private static void execute(ModulePoolEnum module,String function,int corePoolSize,int maximunPoolSize,LocalRunnable LocalRunnable){
         if(StringUtils.isEmpty(function)){
             function = "default";
         }
         LocalRunnable.setFunctiondesc(function);
         LocalRunnable.setModule(module.name());
         ThreadPoolFactory.getExecutor(module,corePoolSize, maximunPoolSize).execute(LocalRunnable);
     }
     
     /**
      * 关闭指定的连接池,一般情况下不会使用，请勿随意调用<br>
      * @param module    模块名称<br>
      * @param function    功能名称<br>
      */
     private void shutdown(ModulePoolEnum module){
         ThreadPoolFactory.shutdownExecutor(module);
     }
     
}
```

2、二开module标识

```java
com.weaver.common.threadPool.constant.ModulePoolEnum

ModulePoolEnum.erkai
```

#### 日志输出

**E10服务默认输出级别为ERROR**，二开代码输出日志文件`logs/sys-secondev.log`，错误日志`logs/sys-err.log`，可通过运维平台下载；修改日志级别[参考文档](https://weapp.eteams.cn/ecode/playground/doc/share/view/974682604024152068#1%E3%80%81%E4%BA%8C%E5%BC%80%E8%BE%93%E5%87%BA%E7%9A%84%E6%97%A5%E5%BF%97%E5%9C%A8%E5%93%AA%E9%87%8C%E7%9C%8B)

```java
import com.weaver.common.authority.annotation.WeaPermission;
import com.weaver.common.base.entity.result.WeaResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/secondev/demo")
@WeaPermission(publicPermission = true)
public class HelloController {

    private static final Logger log = LoggerFactory.getLogger(HelloController.class);

    @GetMapping("/hello")
    public WeaResult<String> hello(@RequestParam("msg") String msg) {
        log.info("request params is {}", msg);
        try {
            int number = Integer.parseInt(msg);
        } catch (NumberFormatException e) {
            log.error("request parse error {}", e);
        }
        return WeaResult.success("Hello, " + msg);
    }

}
```
