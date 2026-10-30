---
description: E10 后端数据库操作
title: "E10 后端数据库操作"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/e10-backend-db/references/database.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# E10 后端数据库操作

来源：原始《开发指引》Markdown。本文为原始开发指引的场景化抽取，供 AI Agent 按需检索。

### 3.2.1 数据库操作

> 二开如需建表，统一使用EB表单搭建！

> 如需初始化表数据，可以通过数据库管理工具连接数据库执行自定义脚本，或开发实现初始化数据。

> [EB表单系统字段说明](https://weapp.eteams.cn/build/techdoc/wdoc/index.html#/public/doc/23c36c2c-92a6-49e7-aa0c-f37757d6c6d8)

> [EB表单数据量迁移](https://weapp.eteams.cn/build/techdoc/wdoc/index.html#/public/doc/fc0dcf2e-37e8-43ac-9da3-9520931b6c4f)

#### 执行自定义SQL

##### 数据源类型

| 类型名称 | 类型说明                                 |
| -------- | ---------------------------------------- |
| LOGIC    | 内部数据源（OA模块系统内模块默认数据源） |
| EXTERNAL | 外部数据源（数据加工中添加的外部链接）   |

##### 公共数据库表操作

E10 部署后，默认存在一个公共数据库 eteams，存放公共表，公共表的操作需要指定公共库名称【24.1101基线版本开始支持，较低版本只能写死库名】：`{$publicdb}.`，例如人员表 EMPLOYEE，示例：

```SQL
-- 查询指定人员信息
SELECT id,name FROM {$publicdb}.EMPLOYEE WHERE id = ? AND delete_type = 0
```

补充说明：公共数据表在每个业务数据库中都存在。

##### 241201基线及以前

###### 根据数据源类型获取groupId数据

```java
/**
 * 根据SourceType 获取groupIdMap
 */
public void getGroupIdMap(){
    GroupQuery groupQuery = new GroupQuery();
    groupQuery.setSourceType(SourceType.LOGIC);
    List<Map<String, Object>> dataGroups = dataSetService.getDataGroups(groupQuery);
}
```

###### 执行sql

```java
/**
 * 执行sql
 */
public void logic(){
    //logic类型就传logic的groupId 然后 sourceType传LOGIC
    //external类型就传external的groupId 然后 sourceType传EXTERNAL
    String groupId = "logic_groupid";
    ExecuteSqlEntity executeSqlEntity = new ExecuteSqlEntity();
    executeSqlEntity.setSql(Base64.encode("select * from table_name where id = 11111"));
    executeSqlEntity.setGroupId(groupId);
    executeSqlEntity.setSourceType(SourceType.LOGIC);
    Map<String, Object> map = dataSetService.executeSql(executeSqlEntity);
}
```

##### 250101基线--250401基线

###### 获取数据库分组

```
/sapi/datasource/ds/group
```

sourceType是一个固定的枚举类 那么如何确定需要执行sql的数据表来源于哪个sourceType下呢？

我们需要调用/sapi/datasource/ds/group接口确定自己的数据库属于哪个sourceType

目前只能穷举sourceType  一个个去测试（或者根据业务类型推测），数据加工配置的连接为EXTERNAL


```java
     /**
     * 根据数据库类型 找到对应数据库
     *
     * @param sourceType sourceType 枚举类
     *                   ETEAMS  :数据仓库
     *                   FORM: ebuilder表单
     *                   LOGIC: 各模块提供业务数据(逻辑表)
     *                   EXTERNAL： 外部数据源
     * @return
     */
    public Map<String, Object> getDataGroups(String sourceType) {
        try {
            //拼接参数
            MultiValueMap<String, Object> valueMap = new LinkedMultiValueMap<>();
            valueMap.add("sourceType", sourceType);

            return commonRestService.postForObject("/sapi/datasource/ds/group", MediaType.APPLICATION_FORM_URLENCODED, Map.class, valueMap);
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            throw e;

        }
    }
```


LOGIC出参示例：

```json
[
  {
    "name": "业务表单",
    "id": "weaver-formreport-service"
  },
  {
    "name": "流程",
    "id": "weaver-workflow-report-serviceworkflowreport"
  },
  {
    "name": "任务",
    "id": "weaver-project-servicetask"
  },
  {
    "name": "日志",
    "id": "weaver-elog-service"
  },
  {
    "name": "会议",
    "id": "weaver-meeting-service"
  },
  {
    "name": "日报",
    "id": "weaver-blog-service"
  },
  {
    "name": "OKR",
    "id": "weaver-wr-goal-service"
  },
  {
    "name": "流程列表",
    "id": "weaver-workflow-list-service"
  },
  {
    "name": "考勤",
    "id": "weaver-attend-service"
  },
  {
    "name": "CRM",
    "id": "weaver-crm-service"
  },
  {
    "name": "组织画像",
    "id": "weaver-portrait-service"
  },
  {
    "name": "工作流报告",
    "id": "weaver-workflow-report-serviceworkflow_report"
  }
  {
    "name": "绩效核算",
    "id": "weaver-ebuilder-form-serviceuFJXHS"
  }
]
```

EXTERNAL出参示例：

```json
[
  {
    "dbType": "Mysql8",
    "id": "626641698703319040",
    "name": "e10_hr_sync"
  },
  {
    "dbType": "DaMeng",
    "id": "673747972984938496",
    "name": "达梦测试"
  },
  {
    "dbType": "Mysql8",
    "id": "842668710322556928",
    "name": "ecode_dev"
  }
]
```

出参的id  就是我们执行sql需要的groupId

###### 执行内部LOGIC sql（不支持预编译）
通过数据源的sapi接口执行sql  需要调用 datasource-api 包下的 /sapi/secondev/ds/executeSql方法

执行sql示例:
```java
/**
     * 执行服务内部sql:/sapi/secondev/ds/executeSql
     * sourceType  :LOGIC
     * groupId  :   weaver-ebuilder-app-service 可以通过group接口获取
     * sql : 要执行的sql语句
     * 不支持占位执行
     */
    public Map<String, Object> executeLogicSql(SourceType sourceType, String groupId, String sql) {
        //拼接参数
        Map<String, Object> valueMap = new HashMap<>();
        valueMap.put("sourceType", sourceType);
        valueMap.put("groupId", groupId);
        //sql select * from table where tenant_key = '租户key' and delete_dype = 0 and id in (1,2,3)
        valueMap.put("sql", Base64.encode(sql));

        try {
            return commonRestService.postForForm("/sapi/secondev/ds/executeSql", Map.class, valueMap);
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            throw e;
        }
    }
```
###### 执行外部EXTERNAL sql(支持预编译方式)
通过数据源的sapi接口执行sql  需要调用 datasource-api 包下的 /sapi/datasearch/external/data/executeSql方法

执行sql示例:
```java
    /**
     * 执行外部数据库sql: /sapi/datasearch/external/data/executeSql
     * sourceType  : EXTERNAL: 外部数据源
     * groupId  :   842668710322556928L 通过group接口获取数据加工内配置的连接id
     * sql : Base64编译
     * sqlParams : 添加参数顺序要与sql里占位符顺序一致
     * @param
     * @return
     */
    public Map<String, Object> executeExternalSql(SourceType sourceType, String groupId, String sql, List<SqlParamEntity> sqlParams) {
        //执行sql  参数sourceType   groupId  sql
        ExecuteSqlEntity executeSqlEntity = new ExecuteSqlEntity();
        executeSqlEntity.setSql(base64(sql));
        executeSqlEntity.setGroupId(groupId);
        executeSqlEntity.setSourceType(sourceType);

        //若通过占位符方式查询外部数据库,需增加此参数
        //占位符list 的顺序  要与 sql 的?占位符顺序一致
        if (sqlParams != null && !sqlParams.isEmpty()) {
            executeSqlEntity.setParams(sqlParams);
        }

        //拼接参数
        Map<String, Object> valueMap = new HashMap<>();
        valueMap.put("params", JSONUtil.toJsonStr(executeSqlEntity));

        try {
            return commonRestService.postForForm("/sapi/datasearch/external/data/executeSql", Map.class, valueMap);
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            throw e;
        }
    }
```

###### 获取预编译sql占位符List\<SqlParamEntity\>

预编译方式参数字段解析(SqlParamEntity)

| 参数名    | 必选 | 类型   | 说明                                                         |
| --------- | ---- | ------ | ------------------------------------------------------------ |
| FieldId   | 是   | String | 条件字段的名称                                               |
| ParamType | 是   | Enum   | 条件字段的类型，SqlParamType枚举                             |
| Value     | 是   | String | 条件字段的值，字符串，in 条件的需通过多个?进行占位，例：(?, ?, ?) |

构建params示例：

```java

    /**
     * 构建占位符参数json字符
     * 注意:list的参数顺序 必须要与 sql内的占位符参数顺序一致
     * 此案例构建的json字符串 是提供给sql:select * from table where tenant_key = ? and delete_dype = ? and id in (?, ?, ?) 使用
     * @return
     */
    public List<SqlParamEntity> getSqlParams() {
        List<SqlParamEntity> sqlParams = new ArrayList<>();

        SqlParamEntity sqlParam1 = new SqlParamEntity();
        sqlParam1.setParamType(SqlParamType.VARCHAR);
        sqlParam1.setValue("thsv5s4n2c");
        sqlParams.add(sqlParam1);

        SqlParamEntity sqlParam2 = new SqlParamEntity();
        sqlParam2.setParamType(SqlParamType.INTEGER);
        sqlParam2.setValue("0");
        sqlParams.add(sqlParam2);

        List<Long> ids = new ArrayList<>();
        ids.add(1054407582048280585L);
        ids.add(1054407345976074241L);
        ids.add(1054406667262189570L);
        for (Long id : ids) {
            SqlParamEntity sqlParam3 = new SqlParamEntity();
            sqlParam3.setParamType(SqlParamType.LONG);
            sqlParam3.setValue(String.valueOf(id));
            sqlParams.add(sqlParam3);
        }

        return sqlParams;
    }
```

###### 1201基线及以上支持的LOGIC与EXTERNAL统一接口，1101基线及以下不支持
**注:此接口支持预编译方式执行sql，且LOGIC执行支持事务处理**

```java
    /**
     * 1201 基线支持数据库执行接口调用案例代码
     * 1.预编译方式LOGIC执行sql
     * 2.非预编译方式LOGIC执行sql
     * 3.预编译方式EXTERNAL执行sql
     * 4.非预编译方式EXTERNAL执行sql
     * 5.开启事务
     * 6.提交事务
     * 7.回滚事务
     */
    public WeaResult<Object> testTrans() {
        Map<String, Object> res = new HashMap<>();

        Map<String, Object> execute = dataSetUtil.executeSqlWithTrans(SourceType.LOGIC, "weaver-workflow-list-service",
                "select * from wfc_testinfo_log where id = 973258354118836227 and delete_type=0 and tenant_key='thsv5s4n2c'",
                null, "", false, false, false);
        res.put("非预编译方式LOGIC执行sql", execute);


        String sql = "select * from ecod_folder where tenant_key = ? and delete_type = ? and root_folder_id in(?, ?, ?) order by create_time desc", groupId = "842668710322556928";
        List<SqlParamEntity> sqlParams = dataSetUtil.getSqlParams();
        Map<String, Object> execute2 = dataSetUtil.executeSqlWithTrans(SourceType.EXTERNAL, groupId, sql, sqlParams, "", null, null, null);
        res.put("预编译EXTERNAL执行sql", execute2);


        String sql1 = "select * from ecod_folder where tenant_key = 'thsv5s4n2c' and delete_type = 0 " +
                "and root_folder_id in(1054407582048280585,1054407345976074241,1054406667262189570) order by create_time desc";
        Map<String, Object> execute3 = dataSetUtil.executeSqlWithTrans(SourceType.EXTERNAL, groupId, sql1, null, "", null, null, null);
        res.put("非预编译方式EXTERNAL执行sql", execute3);

        //设置transId 事务id
        String transId = "973258354118836227";
        try {
            //开启事务
            Map<String, Object> execute01 = dataSetUtil.executeSqlWithTrans(SourceType.LOGIC, "weaver-workflow-list-service",
                    "update wfc_testinfo_log set update_time ='2024-11-22 20:00:00' where id = 973258354118836227 and tenant_key = 'thsv5s4n2c' and delete_type = 0",
                    null, transId, true, false, false);
            //带事务执行sql
            Map<String, Object> execute02 = dataSetUtil.executeSqlWithTrans(SourceType.LOGIC, "weaver-workflow-list-service",
                    "update wfc_testinfo_log set update_time ='2024-11-22 21:00:00' where id = 973258354118836227 and tenant_key = 'thsv5s4n2c' and delete_type = 0",
                    null, transId, true, false, false);

            //提交事务
            Map<String, Object> execute03 = dataSetUtil.executeSqlWithTrans(SourceType.LOGIC, "weaver-workflow-list-service",
                    "update wfc_testinfo_log set update_time = '2024-11-22 22:00:03' where id = 973258354118836227 and tenant_key = 'thsv5s4n2c' and delete_type = 0",
                    null, transId, true, true, false);
            log.info("");
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            //回滚事务
            Map<String, Object> execute03 = dataSetUtil.executeSqlWithTrans(SourceType.LOGIC, "weaver-workflow-list-service",
                    "", null, transId, true, false, true);
            log.info("");
        }


        //获取预编译参数数据
        List<SqlParamEntity> logicSqlParams = new ArrayList<>();
        SqlParamEntity sqlParam3 = new SqlParamEntity();
        sqlParam3.setParamType(SqlParamType.LONG);
        sqlParam3.setValue("973258354118836227");
        logicSqlParams.add(sqlParam3);


        SqlParamEntity sqlParam2 = new SqlParamEntity();
        sqlParam2.setParamType(SqlParamType.INTEGER);
        sqlParam2.setValue("0");
        logicSqlParams.add(sqlParam2);

        SqlParamEntity sqlParam1 = new SqlParamEntity();
        sqlParam1.setParamType(SqlParamType.VARCHAR);
        sqlParam1.setValue("thsv5s4n2c");
        logicSqlParams.add(sqlParam1);

        //预编译LOGIC执行Sql
        Map<String, Object> execute04 = dataSetUtil.executeSqlWithTrans(SourceType.LOGIC, "weaver-workflow-list-service",
                "select * from wfc_testinfo_log where id = ? and delete_type = ? and tenant_key = ?",
                logicSqlParams, "", false, false, false);
        res.put("预编译方式LOGIC执行sql", execute04);

        return WeaResult.success(res);
    }

    /**
     * 1201基线后支持的聚合执行接口
     * LOGIC:支持普通sql与预编译sql执行,支持带事务执行
     * EXTERNAL:支持普通sql与预编译sql执行,不支持带事务执行
     * @param sourceType 连接类型
     * @param groupId 连接id
     * @param sql sql语句
     * @param sqlParams 预编译sql参数
     * @param transId 事务id
     * @param startTrans 是否开启事务
     * @param commit 是否提交事务
     * @param rollback 是否回滚事务
     */
    public Map<String, Object> executeSqlWithTrans(SourceType sourceType, String groupId, String sql, List<SqlParamEntity> sqlParams, String transId, Boolean startTrans, Boolean commit, Boolean rollback) {
        //执行sql  参数sourceType   groupId  sql
        ExecuteSqlEntity executeSqlEntity = new ExecuteSqlEntity();
        executeSqlEntity.setSql(base64(sql));
        executeSqlEntity.setGroupId(groupId);
        executeSqlEntity.setSourceType(sourceType);

        //若通过占位符方式查询外部数据库,需增加此参数
        //占位符list 的顺序  要与 sql 的?占位符顺序一致
        if (sqlParams != null && !sqlParams.isEmpty()) {
            executeSqlEntity.setParams(sqlParams);
        }
        //设置事务id
        if (transId != null && !transId.isEmpty()) {
            executeSqlEntity.setTransactionId(transId);
        }
        //是否开启事务
        if (startTrans != null && startTrans) {
            executeSqlEntity.setStartTransaction(true);
        }
        //是否提交事务
        if (commit != null && commit) {
            executeSqlEntity.setCommitTransaction(true);
        }
        //是否回滚事务
        if (rollback != null && rollback) {
            executeSqlEntity.setRollbackTransaction(true);
        }

        //拼接参数
        Map<String, Object> valueMap = new HashMap<>();
        valueMap.put("entity", JSONUtil.toJsonStr(executeSqlEntity));

        try {
            return commonRestService.postForForm("/sapi/secondev/ds/executeSqlAll", Map.class, valueMap);
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            throw e;
        }
    }
```

###### 执行sql完整案例代码：

```java
import cn.hutool.core.codec.Base64;
import cn.hutool.core.util.StrUtil;
import cn.hutool.json.JSONUtil;
import com.weaver.datasource.utils.rest.CommonRestService;
import com.weaver.ebuilder.datasource.api.entity.ExecuteSqlEntity;
import com.weaver.ebuilder.datasource.api.entity.SqlParamEntity;
import com.weaver.ebuilder.datasource.api.enums.SourceType;
import com.weaver.ebuilder.datasource.api.enums.SqlParamType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 *
 * Author: 李玉逸
 * Describe:
 * Date: 2024/11/7 13:47
 */
@Slf4j
@Component
public class DataSetUtil {

    @Autowired
    private CommonRestService commonRestService;

    public static String base64(String sql) {
        return Base64.encode(sql);
    }

    /**
     * 根据数据库类型 找到对应数据库
     *
     * @param sourceType sourceType 枚举类
     *                   ETEAMS  :数据仓库
     *                   FORM: ebuilder表单
     *                   LOGIC: 各模块提供业务数据(逻辑表)
     *                   EXTERNAL： 外部数据源
     * @return
     */
    public Map<String, Object> getDataGroups(String sourceType) {
        try {
            //拼接参数
            MultiValueMap<String, Object> valueMap = new LinkedMultiValueMap<>();
            valueMap.add("sourceType", sourceType);

            return commonRestService.postForObject("/sapi/datasource/ds/group", MediaType.APPLICATION_FORM_URLENCODED, Map.class, valueMap);
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            throw e;

        }
    }

    /**
     * 执行服务内部sql:/sapi/secondev/ds/executeSql
     * sourceType  :LOGIC
     * groupId  :   weaver-ebuilder-app-service 可以通过group接口获取
     * sql :      select * from ebda_app limit  10
     * @param sourceType LOGIC: 各模块提供业务数据(逻辑表)
     * @param groupId
     * @param sql
     * @return
     */
    public Map<String, Object> executeLogicSql(SourceType sourceType, String groupId, String sql) {
        //拼接参数
        Map<String, Object> valueMap = new HashMap<>();
        valueMap.put("sourceType", sourceType);
        valueMap.put("groupId", groupId);
        //sql select * from table where tenant_key = '租户key' and delete_dype = 0 and id in (1,2,3)
        valueMap.put("sql", base64(sql));

        try {
            return commonRestService.postForForm("/sapi/secondev/ds/executeSql", Map.class, valueMap);
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            throw e;
        }
    }

    /**
     * 执行外部数据库sql: /sapi/datasearch/external/data/executeSql
     * sourceType  : EXTERNAL: 外部数据源
     * groupId  :   842668710322556928L 通过group接口获取数据加工内配置的连接id
     * sql :      select * from ebda_app limit  10
     *
     * @param
     * @return
     */
    public Map<String, Object> executeExternalSql(SourceType sourceType, String groupId, String sql, List<SqlParamEntity> sqlParams) {
        //执行sql  参数sourceType   groupId  sql
        ExecuteSqlEntity executeSqlEntity = new ExecuteSqlEntity();
        executeSqlEntity.setSql(base64(sql));
        executeSqlEntity.setGroupId(groupId);
        executeSqlEntity.setSourceType(sourceType);

        //若通过占位符方式查询外部数据库,需增加此参数
        //占位符list 的顺序  要与 sql 的?占位符顺序一致
        if (sqlParams != null && !sqlParams.isEmpty()) {
            executeSqlEntity.setParams(sqlParams);
        }

        //拼接参数
        Map<String, Object> valueMap = new HashMap<>();
        valueMap.put("params", JSONUtil.toJsonStr(executeSqlEntity));

        try {
            return commonRestService.postForForm("/sapi/datasearch/external/data/executeSql", Map.class, valueMap);
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            throw e;
        }
    }

    /**
     * 构建占位符参数
     * 注意:list的参数顺序 必须要与 sql内的占位符参数顺序一致
     * 此案例构建的json字符串 是提供给sql:select * from table where tenant_key = ? and delete_dype = ? and id in (?, ?, ?) 使用
     * @return
     */
    public List<SqlParamEntity> getSqlParams() {
        List<SqlParamEntity> sqlParams = new ArrayList<>();

        SqlParamEntity sqlParam1 = new SqlParamEntity();
        sqlParam1.setParamType(SqlParamType.VARCHAR);
        sqlParam1.setValue("thsv5s4n2c");
        sqlParams.add(sqlParam1);

        SqlParamEntity sqlParam2 = new SqlParamEntity();
        sqlParam2.setParamType(SqlParamType.INTEGER);
        sqlParam2.setValue("0");
        sqlParams.add(sqlParam2);

        List<Long> ids = new ArrayList<>();
        ids.add(1054407582048280585L);
        ids.add(1054407345976074241L);
        ids.add(1054406667262189570L);
        for (Long id : ids) {
            SqlParamEntity sqlParam3 = new SqlParamEntity();
            sqlParam3.setParamType(SqlParamType.LONG);
            sqlParam3.setValue(String.valueOf(id));
            sqlParams.add(sqlParam3);
        }

        return sqlParams;
    }

    //1201基线后支持的接口---------------------------------------------------
    /**
     * 1201基线后支持的聚合执行接口
     * LOGIC:支持普通sql与预编译sql执行,支持带事务执行
     * EXTERNAL:支持普通sql与预编译sql执行,不支持带事务执行
     * @param sourceType 连接类型
     * @param groupId 连接id
     * @param sql sql语句
     * @param sqlParams 预编译sql参数
     * @param transId 事务id
     * @param startTrans 是否开启事务
     * @param commit 是否提交事务
     * @param rollback 是否回滚事务
     */
    public Map<String, Object> executeSqlWithTrans(SourceType sourceType, String groupId, String sql, List<SqlParamEntity> sqlParams, String transId, Boolean startTrans, Boolean commit, Boolean rollback) {
        //执行sql  参数sourceType   groupId  sql
        ExecuteSqlEntity executeSqlEntity = new ExecuteSqlEntity();
        executeSqlEntity.setSql(base64(sql));
        executeSqlEntity.setGroupId(groupId);
        executeSqlEntity.setSourceType(sourceType);

        //若通过占位符方式查询外部数据库,需增加此参数
        //占位符list 的顺序  要与 sql 的?占位符顺序一致
        if (sqlParams != null && !sqlParams.isEmpty()) {
            executeSqlEntity.setParams(sqlParams);
        }
        //设置事务id
        if (transId != null && !transId.isEmpty()) {
            executeSqlEntity.setTransactionId(transId);
        }
        //是否开启事务
        if (startTrans != null && startTrans) {
            executeSqlEntity.setStartTransaction(true);
        }
        //是否提交事务
        if (commit != null && commit) {
            executeSqlEntity.setCommitTransaction(true);
        }
        //是否回滚事务
        if (rollback != null && rollback) {
            executeSqlEntity.setRollbackTransaction(true);
        }

        //拼接参数
        Map<String, Object> valueMap = new HashMap<>();
        valueMap.put("entity", JSONUtil.toJsonStr(executeSqlEntity));

        try {
            return commonRestService.postForForm("/sapi/secondev/ds/executeSqlAll", Map.class, valueMap);
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            throw e;
        }
    }

}
```



##### 250501基线提供二开执行sql工具类

可直接使用该工具类【com.weaver.secondev.api.util.SecondevDataSetUtil】，将数据源接口封装，执行sql只需要调用工具类即可

调用示例：

```java
import com.weaver.common.distribution.genid.IdGenerator;
import com.weaver.ebuilder.datasource.api.entity.SqlParamEntity;
import com.weaver.ebuilder.datasource.api.enums.SourceType;
import com.weaver.ebuilder.datasource.api.enums.SqlParamType;
import com.weaver.secondev.api.util.SecondevDataSetUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class dataTest{
    @Autowired
    SecondevDataSetUtil secondevDataSetUtil;
    
    /**
     * 获取groupMap数据
     */
    public void getGroupMap(){
        secondevDataSetUtil.getDataGroups("LOGIC");
        secondevDataSetUtil.getDataGroups("EXTERNAL");
    }
    
    /**
     * 执行sql
     */
    public void executeSql(){
        //对应sourceType的groupId
        String groupId = "group_id";
        //预编译占位参数 ，占位参数顺序要与 sql中【?】顺序，个数一致
        //不使用与便于占位  可以传null
        List<SqlParamEntity> params = new ArrayList<>();
        SqlParamEntity sqlParamEntity = new SqlParamEntity();
        sqlParamEntity.setParamType(SqlParamType.BIGINT);
        sqlParamEntity.setValue("1111111");
        params.add(sqlParamEntity);
        SqlParamEntity sqlParamEntity1 = new SqlParamEntity();
        sqlParamEntity1.setParamType(SqlParamType.BIGINT);
        sqlParamEntity1.setValue("2222222");
        params.add(sqlParamEntity1);
        //sourceType 数据源类型
        //groupId 数据源Id
        //sql 执行sql 可支持预编译
        //params 预编译占位参数 不使用可传null
        secondevDataSetUtil.executeSql(SourceType.LOGIC,groupId,"select * from table_name where id = 111 and field1 in (?,?) ",params);
    }
    
    /**
     * LOGIC 类型带事务执行sql,仅支持LOGIC类型
     */
    public void executeSqlWithTrans(){
        //LOGIC 数据源 groupId
        String logicGroupId = "logicGroupId";
        String tenantKey = "租户key";
        //设置transId 事务id
        String transId = String.valueOf(IdGenerator.generate());
        try {
            //SourceType 数据源类型 仅支持LOGIC
            //groupId LOGIC的groupId
            //sql 执行sql
            //sql Params   目前不支持占位  传null
            //transId 事务id
            //startTrans 是否开启事务
            //commit 是否提交事务
            //rollback 是否回滚事务
            
            //开启事务 并执行sql
            Map<String, Object> execute01 = secondevDataSetUtil.executeSqlWithTrans(SourceType.LOGIC, logicGroupId,
                    "update wfc_testinfo_log set update_time ='2024-11-22 20:00:00' where id = 1127944156823134212 and tenant_key = '" + tenantKey + "' and delete_type = 0",
                    null, transId, true, false, false);

            //在同一事务中执行sql2 并提交事务
            Map<String, Object> execute03 = secondevDataSetUtil.executeSqlWithTrans(SourceType.LOGIC, logicGroupId,
                    "update wfc_testinfo_log set update_time = '2024-11-22 22:00:03' where id = 1127944156823134212 and tenant_key = '" + tenantKey + "' and delete_type = 0",
                    null, transId, true, true, false);
        } catch (Exception e) {
            //回滚事务
            Map<String, Object> execute03 = secondevDataSetUtil.executeSqlWithTrans(SourceType.LOGIC, logicGroupId,
                    "", null, transId, true, false, true);
            throw e;
        }
    }
}
```

##### 参考文档
**详细参数介绍可参考相关数据源接口文档**：

https://weapp.eteams.cn/build/techdoc/wdoc/index.html#/public/doc/8bcf1e40-a333-401d-a5c0-20b375d7bc84

##### 获取数据库类型

```java
// 示例 判断是否为达梦数据库
boolean isDM = "DM".equalsIgnoreCase(com.weaver.common.mybatis.baseConfig.WeaDatabaseIdProvider.databaseId);
```
