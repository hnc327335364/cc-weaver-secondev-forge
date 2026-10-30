---
description: 单元测试生成、执行与结果验证规范
alwaysApply: false
title: "单元测试生成、执行与结果验证规范"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-development/modules/backend-development/references/test-spec-full.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# 单元测试生成、执行与结果验证规范

本规范适用于 e-code 二开项目中的 Java 单元测试、回归测试、测试执行和测试结果验证。

## 1. 目录与命名

测试代码必须放在对应子模块的 `src/test/java` 目录下。

推荐结构：

```txt
secondev-demo/
├── src/
│   ├── main/java/com/weaver/seconddev/demo/service/DemoService.java
│   └── test/java/com/weaver/seconddev/demo/service/DemoServiceTest.java
└── secondev-demo.gradle
```

命名规则：
1. 测试类：`{被测类名}Test`。
2. 测试方法：`should{ExpectedBehavior}When{Condition}`。
3. 包路径：与被测类保持一致。
4. 测试夹具命名清晰表达业务语义，避免 `test1`、`data1` 等无意义名称。

## 2. 测试框架

默认使用 Java 8 兼容方案。

推荐优先级：
1. 项目或 `secDevLib/devLib` 已存在的测试框架。
2. JUnit 4。
3. Mockito 3.x 或与当前基线兼容的 Mockito 版本。

若当前工程没有测试依赖，不得直接假设依赖可用；应先检查依赖，再决定是否补充 `testImplementation`。

示例 Gradle 配置：

```gradle
dependencies {
    testImplementation 'junit:junit:4.13.2'
    testImplementation 'org.mockito:mockito-core:3.12.4'
}
```

## 3. 覆盖范围

新增或修改业务逻辑时，至少覆盖以下测试点：

1. 正常路径：输入合法，返回成功结果。
2. 参数校验：必要参数为空、格式错误、越界。
3. 平台 API/SDK 返回失败：验证业务层如何转换错误。
4. 异常分支：验证系统异常被记录并转为友好返回。
5. `WeaResult` 结构：成功时 `status=true`，失败时 `status=false` 或符合平台返回约定。
6. 权限或租户上下文：涉及 `UserContext`、`TenantRpcContext` 时，应覆盖上下文缺失或无权限场景。

缺陷修复必须添加回归测试，测试名或注释应能看出修复的场景。

## 4. Mock 与隔离

以下能力不得在单元测试中直接访问真实环境：

1. Dubbo/RPC 内部服务。
2. 数据库、Redis、消息队列。
3. 文件服务、打印服务、流程引擎等平台服务。
4. 外部 HTTP 接口。
5. 当前登录用户、租户上下文。

推荐做法：
1. 将平台调用封装到 adapter/client 类中，业务 Service 依赖接口或可替换实现。
2. 使用 Mockito mock 平台调用结果。
3. 对静态上下文读取做薄封装，避免测试直接依赖全局状态。
4. Controller 测试只验证入参、调用 Service、返回结构；复杂分支放到 Service 测试。

## 5. 测试代码质量

测试应遵循以下原则：

1. 一个测试只验证一个主要行为。
2. 使用 Arrange-Act-Assert 结构组织代码。
3. 不依赖测试执行顺序。
4. 不使用真实时间、随机数、线程等待作为断言基础；必要时封装时钟或生成器。
5. 不输出敏感信息，不把异常堆栈作为断言内容。
6. 避免为了覆盖率测试私有方法；优先通过公共行为验证。

## 6. 执行命令

优先执行受影响模块测试：

```bash
./gradlew :secondev-demo:test
```

只需要编译验证时：

```bash
./gradlew :secondev-demo:compileJava
```

任务要求打包时：

```bash
./gradlew :secondev-demo:jar
```

多模块或共享代码变更时：

```bash
./gradlew test
```

## 7. 结果验证

执行后必须解析结果并输出：

1. 测试命令。
2. 测试范围。
3. 通过数量、失败数量、跳过数量。
4. 失败测试类/方法。
5. 失败原因。
6. 修复状态。
7. 剩余风险。

若无法执行测试，必须说明具体原因，例如：

1. `secDevLib` 为空或 jar 数量不足。
2. `secDevClasses` 缺失。
3. 子模块不存在。
4. 测试依赖缺失。
5. E10 基线版本未确认，无法初始化依赖。

此时验证结论只能是“阻塞”或“未完成”，不得写成“通过”。

## 8. 最终输出要求

实现任务最终输出必须包含：

```md
# 测试设计
# 单元测试变更
# 用例执行结果
# 结果验证结论
```

其中：
1. `测试设计` 说明测试点与需求/证据的映射。
2. `单元测试变更` 列出新增或修改的测试文件。
3. `用例执行结果` 列出命令和执行状态。
4. `结果验证结论` 明确通过、失败或阻塞，以及剩余风险。
