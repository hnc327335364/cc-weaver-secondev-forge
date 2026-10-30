---
title: "Java/JVM 性能审核规则"
aliases: []
domain: "ai-resources"
category: "runtime-tool-reference"
note_type: "tool-reference"
status: "internal-trial"
language: "zh-CN"
summary: "CC 泛微开发助手执行工具的来源说明，须由 CC 专业 Skill 按任务授权调用。"
source_path: "01-AI-Resources AI资料整理/04-Agents Agent规则/99-SourceFiles 原始资料/e-code智能化开发工具包/1.3.4/skills/ecode-performance-review/references/java-performance-rules.md"
tags: ["domain/ai-resources", "type/tool-reference", "folder/02-skills"]
---

> 此文件是工具参考说明，不是宿主自动加载入口；由 CC 专业 Skill 调度，不能扩大当前用户授权。知识查询使用包内共享 library，不复制知识正文。

# Java/JVM 性能审核规则

## 目录

- [执行约定](#执行约定)
- [平台既有规则](#平台既有规则)
- [执行元数据](#执行元数据)
- [数据库与事务](#数据库与事务)
- [远程调用与消息](#远程调用与消息)
- [线程与资源](#线程与资源)
- [缓存与内存](#缓存与内存)
- [配置与框架](#配置与框架)
- [扩展数据库与事务规则](#扩展数据库与事务规则)
- [扩展 JVM 与并发规则](#扩展-jvm-与并发规则)
- [扩展微服务与中间件规则](#扩展微服务与中间件规则)
- [后端制品与构建规则](#后端制品与构建规则)
- [新增规则测试矩阵](#新增规则测试矩阵)
- [修复示例](#修复示例)

## 执行约定

- 适用范围：Java、Spring Boot 2.x、Spring Cloud、Dubbo、Nacos、Redis、RabbitMQ、XML、properties、Gradle/Maven，以及包含完整源码和配置的 JAR 项目。
- 平台既有的 25 条 `Weaver-*` 规则全部为 `ERROR`，命中即阻断。该分类按当前 e-code 审核口径保留，即使个别规则同时具有安全性或编码规范属性。
- 补充规则使用 `PERF-BE-*`：能由源码明确证明且可能造成放大、耗尽或雪崩的风险为 `ERROR`；依赖负载、数据规模或部署参数才能定性的优化项为 `WARN`。
- 报告前排除测试夹具、注释、字符串字面量和确定不进入生产的示例代码。若它们会被打包部署，仍按生产代码审核。
- `stages` 缩写：`FS`=`FILE_SAVE`，`PI`=`PROJECT_IMPORT`，`PM`=`PROJECT_MIGRATION`，`PR`=`PROJECT_RELEASE`，`JR`=`JAR_RELEASE`。源码规则默认适用 `FS/PI/PM/PR/JR`；依赖和制品规则只适用 `PI/PM/PR/JR`。
- 每个命中必须引用最短可定位源码、配置、依赖树或制品清单证据。表中“修复要求”是 `remediation` 与 `fixExample` 的生成依据；示例必须贴合当前框架且不得生成完整替换文件。

## 执行元数据

下表覆盖本文件每个规则。`appliesTo` 是必需证据类型；`mode` 定义见 `../TOOL-REFERENCE.md`。

| 规则范围 | appliesTo | stages | mode | 必需证据 |
|---|---|---|---|---|
| 除下列 3 条外的 `Weaver-*` | Java/XML/properties | FS/PI/PM/PR/JR | STATIC | API、注解、语法节点及所在方法 |
| `Weaver-UUIDRandomUUIDRule`、`Weaver-FrequentlyCreateTemplateRule`、`Weaver-ThreadPoolRule` | Java/XML/properties | FS/PI/PM/PR/JR | HYBRID | API、创建位置、高频入口或生命周期上下文 |
| `PERF-BE-001`～`PERF-BE-025` | Java/XML/properties | FS/PI/PM/PR/JR | HYBRID | 入口、调用链、循环/资源路径和排除条件；明确 API 禁用模式可按 STATIC 处理 |
| 规则 `PERF-BE-026` | Maven/Gradle/JAR 清单 | PI/PM/PR/JR | DEPENDENCY | 依赖坐标、版本、依赖路径或 JAR 清单 |
| `PERF-BE-027`～`PERF-BE-050` | Java/XML/properties | FS/PI/PM/PR/JR | 以规则表为准 | 规则表要求的源码与配置上下文 |
| 规则 `PERF-ART-006` | 构建清单/JAR 制品 | PI/PM/PR/JR | DEPENDENCY | 文件路径、类型、大小及制品归属 |

## 平台既有规则

下列全部 `Weaver-*` 属于 `PLATFORM_POLICY`：它们表达平台准入约束，不等于本次静态证据已证明实际性能退化。中央规则源重新核验前，保留原 `ERROR` 等级和阻断语义；报告必须填写 `policyBasis`，并在 `performanceImpact` 明确“运行时影响未由本次静态证据证明”。`PERF-*` 规则属于 `PERFORMANCE_RISK`。

### 对象、集合与字符串

| 规则 ID | 等级 | 命中条件 | 排除条件 | 修复要求 |
|---|---|---|---|---|
| `Weaver-ApacheBeanUtilsCopyPropertiesRule` | ERROR | 调用 Apache `BeanUtils.copyProperties` | 已确认是 Spring `BeanUtils`，或显式 Getter/Setter | 改用 Spring `BeanUtils` 或显式字段映射 |
| `Weaver-ArrayListContainsInLoopRule` | ERROR | 循环内对 `List`/`ArrayList` 调用 `contains`，形成线性嵌套查找 | 无 | 循环前构造 `HashSet`，用 `Set.contains` |
| `Weaver-LoopStringConcatenationRule` | ERROR | 循环中用 `+`、`+=` 重复拼接 `String` | 编译期常量拼接 | 使用 `StringBuilder.append` 或批量 join |
| `Weaver-ObjectMapperLocalInstanceRule` | ERROR | 方法体或循环体内创建 `ObjectMapper` | 无（平台准入策略；一次性初始化也按策略报告） | 注入、复用统一配置的线程安全实例 |
| `Weaver-SimpleDateFormatRule` | ERROR | 使用 `SimpleDateFormat` | 无 | 使用不可变的 `DateTimeFormatter` |
| `Weaver-UUIDRandomUUIDRule` | ERROR | 高并发/高频业务路径直接调用 `UUID.randomUUID()` | 无 | 使用平台或业务 ID 服务；说明唯一性与容量策略 |

### 数据库、日志与解析

| 规则 ID | 等级 | 命中条件 | 排除条件 | 修复要求 |
|---|---|---|---|---|
| `Weaver-JdbcLeakRule` | ERROR | `Connection`、`Statement`、`ResultSet` 存在未关闭路径 | 由可验证的框架生命周期或 try-with-resources 管理 | 使用 try-with-resources，并覆盖异常路径 |
| `Weaver-LogConcatenationRule` | ERROR | 日志参数使用字符串拼接 | 编译期常量日志 | 使用 SLF4J `{}` 占位符；高成本参数增加级别判断 |
| `Weaver-LogSerializationRule` | ERROR | 日志中 JSON 序列化对象，或输出大对象 `toString()` | 无 | 记录允许列表字段，禁止完整对象序列化 |
| `Weaver-RegexRedosSharedRule` | ERROR | 正则存在嵌套量词、重叠分支等可产生灾难性回溯的结构 | 无 | 简化为线性模式、限制输入，必要时使用线性时间引擎 |
| `Weaver-LogContainsJsonRule` | ERROR | 日志输出 JSON 文本或通过 JSON 序列化构造日志 | 普通结构化日志占位符，不序列化对象 | 记录必要标量字段，避免大对象和敏感字段 |
| `Weaver-SqlNotAllowRule` | ERROR | Java 代码动态拼接 SQL | 固定 SQL 常量并使用参数绑定 | 使用参数化查询；动态表列名映射到服务端固定允许列表 |
| `Weaver-CCJSqlParserUtilNotAllowRule` | ERROR | 调用 `CCJSqlParserUtil.parse` | 无 | 使用平台批准的解析能力或移除运行期 SQL 解析 |

### 线程、调用与框架强约束

| 规则 ID | 等级 | 命中条件 | 排除条件 | 修复要求 |
|---|---|---|---|---|
| `Weaver-NewThreadNotAllowRule` | ERROR | 使用 `new Thread(...)` 创建线程 | 无 | 使用平台统一受管线程池 |
| `Weaver-PrintStackTraceNotAllowRule` | ERROR | 调用 `printStackTrace()` | 无 | 使用参数化日志并保留异常对象 |
| `Weaver-ForEachLambdaNotAllowRule` | ERROR | 项目循环中使用 Lambda/`forEach` | 无（平台准入策略；固定小集合也按策略报告） | 改为可控的普通循环，显式处理退出与异常 |
| `Weaver-FrequentlyCreateTemplateRule` | ERROR | 高频路径、循环或每次请求中创建 `RestTemplate`/同类客户端 | 启动期一次性 Bean 创建 | 复用受管客户端并配置连接池和超时 |
| `Weaver-JNICheckRule` | ERROR | 调用 JNI、本地库或 native 方法 | 无 | 移除 JNI 或走平台审批与隔离方案 |
| `Weaver-NewThreadPoolRule` | ERROR | 业务代码创建 `ExecutorService`、`ThreadPoolExecutor` 或定时线程池 | 平台线程池组件内部实现 | 使用平台统一线程池，不在请求路径创建线程池 |
| `Weaver-ThreadPoolRule` | ERROR | 后端未使用性能组/平台提供的线程池方式，或线程池参数异常 | 平台组件且容量参数可验证 | 使用受管、有界线程池，设置拒绝、监控和关闭策略 |
| `Weaver-AllArgsConstructorRule` | ERROR | `@Controller`、`@RestController`、`@Service`、`@Component`、`@Repository` 与 Lombok `@AllArgsConstructor` 共存 | 无 | 改为只注入必需依赖的显式构造器或 `@RequiredArgsConstructor` |
| `Weaver-FastJsonWriteClassNameNotAllowRule` | ERROR | 使用 `SerializerFeature.WriteClassName` | 无 | 移除类型元数据输出，使用明确 DTO |
| `Weaver-TransactionalInterfaceNotAllowRule` | ERROR | 在接口或父级抽象声明上使用 `@Transactional` | 无 | 将事务边界放在具体服务实现的 public 方法 |
| `Weaver-SpringEnvironmentNotAllowRule` | ERROR | 项目代码直接注入或调用 Spring `Environment` | 无 | 使用类型安全配置对象或平台配置能力 |
| `Weaver-WhileRule` | ERROR | 存在 `while (true)` 或等价无条件循环 | 无；即使首轮存在 `break`/`return` 也按平台准入策略阻断 | 改为有界条件、可取消调度或受管消息消费机制 |

## 数据库与事务

| 规则 ID | 等级 | 命中条件 | 修复要求 |
|---|---|---|---|
| `PERF-BE-001` | ERROR | 循环中逐条执行数据库查询/写入，调用次数随集合线性增长 | 批量查询/写入，去重并限制批大小 |
| `PERF-BE-002` | ERROR | 根据结果逐项再查关联数据，形成 N+1 查询 | join、批量查询或预取后以内存映射关联 |
| `PERF-BE-003` | ERROR | 面向外部输入或无静态业务上限的列表/导出查询无分页、无条数上限，或先全量加载再分页 | 数据库分页、流式游标或有界批处理；唯一键查询和代码可证明的小型固定集合不命中 |
| `PERF-BE-004` | ERROR | 事务内包含远程调用、大文件处理，或处理量由外部输入决定且无上限的循环/批处理 | 缩小事务边界；外部副作用采用可靠事件/补偿设计 |
| `PERF-BE-005` | WARN | 查询条件对索引不友好：对索引列包函数、前导通配符、隐式类型转换等 | 改写查询并结合执行计划验证索引；不得凭源码声称必然全表扫描 |
| `PERF-BE-006` | WARN | 单次批量 SQL 参数或数据量无上限 | 设置批大小并分片提交，保留事务与幂等语义 |

## 远程调用与消息

| 规则 ID | 等级 | 命中条件 | 修复要求 |
|---|---|---|---|
| `PERF-BE-007` | ERROR | 循环内逐条调用 Dubbo、HTTP、Redis、MQ 或其他远程服务 | 批量接口、流水线、缓存或受控并发；必须设置上限 |
| `PERF-BE-008` | ERROR | 在完整项目/JAR 审核中，HTTP/OpenFeign、Dubbo、Redis 或 MQ 客户端及其配置均明确没有连接、读取或调用超时 | 显式配置分层超时，并让上游总超时大于下游预算；单文件看不到外部配置时仅写入 `verificationNeeded` |
| `PERF-BE-009` | ERROR | 代码或完整配置明确存在 RabbitMQ 无限、无退避或无终止条件的自动重试 | 有限指数退避与抖动；配置 DLQ 和幂等；配置不可见时仅待验证 |
| `PERF-BE-010` | WARN | 相互独立的远程调用被无必要串行执行 | 在有界线程池和统一超时预算内并行，保持失败语义 |
| `PERF-BE-011` | WARN | 高频路径反复从 Nacos 拉取同一配置，而非使用本地缓存/监听更新 | 使用配置绑定、缓存和监听机制，避免请求级配置拉取 |

## 线程与资源

| 规则 ID | 等级 | 命中条件 | 修复要求 |
|---|---|---|---|
| `PERF-BE-012` | ERROR | 线程池队列、异步任务、并行流或递归规模由外部输入决定且无上限 | 有界队列/并发/深度，设置拒绝、取消、背压和监控 |
| `PERF-BE-013` | ERROR | 在 `synchronized`、显式锁或分布式锁内执行数据库、远程、文件等阻塞 I/O | 将 I/O 移出临界区，缩短锁范围并设置超时 |
| `PERF-BE-014` | ERROR | 连接、流、文件句柄、线程、定时任务或需显式注销的订阅存在未释放路径 | 使用受管生命周期或 try-with-resources，验证正常与异常路径 |
| `PERF-BE-015` | WARN | 公共 ForkJoinPool/parallelStream 用于阻塞 I/O 或不可控数据量 | 使用平台有界线程池，或改为顺序/批量处理 |
| `PERF-BE-016` | WARN | 大文件或大响应一次性读入 byte[]/String/集合 | 流式处理，限制总大小和单批大小 |

## 缓存与内存

| 规则 ID | 等级 | 命中条件 | 修复要求 |
|---|---|---|---|
| `PERF-BE-017` | ERROR | Redis 使用 `KEYS`，或无界 `SCAN` 并把全库结果聚合到内存 | 使用业务索引、游标分页和硬上限，禁止生产全库扫描 |
| `PERF-BE-018` | WARN | 缓存无 TTL、键空间无上限，或把大对象/大集合整体序列化 | 设置 TTL、容量和对象大小限制；拆分 big key |
| `PERF-BE-019` | WARN | 热点缓存失效后允许大量请求同时回源，或大量键同一时刻过期 | 单飞/互斥、逻辑过期、随机抖动和限流 |
| `PERF-BE-020` | WARN | 高频路径重复深拷贝、JSON 序列化/反序列化或构造大临时集合 | 复用不可变数据、减少转换，并在边界一次处理 |

## 配置与框架

| 规则 ID | 等级 | 命中条件 | 修复要求 |
|---|---|---|---|
| `PERF-BE-021` | ERROR | 定时任务、监听器或消费者可重入并发执行且缺少互斥/幂等/并发上限 | 使用集群锁、幂等键或平台调度策略，并限制并发 |
| `PERF-BE-022` | WARN | Spring Bean 在请求路径反复查找/反射构造，或可复用客户端未声明为受管单例 | 构造器注入并复用 Bean；缓存安全的元数据 |
| `PERF-BE-023` | WARN | 日志位于高频循环且逐项输出，即使已使用占位符 | 汇总计数、采样或降级日志，避免每条记录输出 |
| `PERF-BE-024` | ERROR | Spring Cloud Gateway/OpenFeign、服务调用与业务代码在同一链路叠加重试，代码或配置可证明最大尝试次数被乘法放大 | 每层只保留必要的有限重试；非幂等请求禁用自动重试，并设置统一调用预算 |
| `PERF-BE-025` | WARN | Spring Cloud/Nacos 配置刷新监听中反复重建客户端、线程池或大缓存，且无去重或频率控制 | 对配置版本去重；增量更新并复用受管资源 |
| `PERF-BE-026` | WARN | JAR 清单或构建依赖中存在同一组件多个版本、重复客户端实现或重复日志实现，可能产生重复初始化和额外资源占用 | 收敛依赖版本并排除重复传递依赖；结合依赖树和启动日志验证 |

## 扩展数据库与事务规则

| 规则 ID | 等级 | mode | 命中条件 | 排除条件 | 必需证据 | 修复要求与示例 |
|---|---|---|---|---|---|---|
| `PERF-BE-027` | WARN | HYBRID | 分页查询使用随页码线性增大的 `OFFSET`，且入口允许深翻页或未设置最大页码 | 小型固定数据集，或代码明确限制在浅页 | 分页参数来源、上限及 SQL/分页 API | 改为基于稳定唯一排序键的游标分页；示例：`WHERE id > :lastId ORDER BY id LIMIT :size` |
| `PERF-BE-028` | WARN | HYBRID | 外部输入或无硬上限集合直接构造大型 `IN` 条件 | 集合有可证明的小上限，或框架已自动分片 | 参数来源、集合上限、SQL/Mapper 绑定 | 去重并按数据库限制分片；示例：`Lists.partition(ids, 500)` 后批量查询 |
| `PERF-BE-029` | WARN | HYBRID | 热点、列表或大表查询使用 `SELECT *`，并返回未使用的大字段或全部列 | 小表管理查询且所有列均被消费 | SQL、结果映射及调用方实际字段使用 | 只选择需要字段；示例：`SELECT id,name,status FROM user` |
| `PERF-BE-030` | WARN | HYBRID | JPA/MyBatis 批量写入由输入规模决定，未分片，且持久化上下文/批参数持续累积 | 框架批处理有可验证硬上限并自动清理 | 循环、集合来源、批配置及 flush/clear 路径 | 固定批大小并周期性提交/清理；示例：每 500 条执行 `flush()`、`clear()` |
| `PERF-BE-031` | WARN | HYBRID | 导出、同步或全表处理一次性加载无界结果集，未分页、流式游标或设置 `fetchSize` | 唯一键查询或代码证明结果严格有界 | 查询入口、结果容器及读取方式 | 使用流式结果或有界分页；示例：MyBatis `Cursor<T>` 配合合理 `fetchSize` |

## 扩展 JVM 与并发规则

| 规则 ID | 等级 | mode | 命中条件 | 排除条件 | 必需证据 | 修复要求与示例 |
|---|---|---|---|---|---|---|
| `PERF-BE-032` | WARN | HYBRID | 循环或请求热路径重复编译 `Pattern`、创建格式化器、解析模板或扫描反射元数据 | 启动期一次性创建，或对象构造成本可证明很小 | 创建位置、外层循环/入口和调用频率上下文 | 预编译并安全复用；示例：`private static final Pattern ID = Pattern.compile(...)` |
| `PERF-BE-033` | WARN | AI | 大规模循环内反复执行 `String.format`、装箱拆箱或多层 Stream 中间集合，形成明显分配放大 | 小型固定集合或低频离线任务 | 循环边界、集合规模来源和对象创建链 | 使用 `StringBuilder`、原始类型循环或单次收集；示例：复用一个 `StringBuilder` |
| `PERF-BE-034` | ERROR | STATIC | 生产代码调用 `System.gc()` 或 `Runtime.getRuntime().gc()` | 仅隔离的测试/诊断夹具且不打包 | 精确调用表达式及生产路径 | 删除主动 GC；示例：移除调用并通过堆、分配率和 GC 日志治理根因 |
| `PERF-BE-035` | ERROR | HYBRID | `static` 集合、本地缓存或 `ThreadLocal` 按请求/租户/用户持续增长，且无容量、TTL、删除或 `remove()` 路径 | 有可验证容量上限和完整清理生命周期 | 写入键来源、容器生命周期及缺失的回收路径 | 使用有界缓存并清理 `ThreadLocal`；示例：`try { ... } finally { holder.remove(); }` |
| `PERF-BE-036` | WARN | HYBRID | 使用类锁、全局单例锁或覆盖整段业务流程的粗粒度锁，使互不相关请求串行化 | 启动期互斥或极短常量级临界区 | 锁对象作用域、临界区和并发入口 | 按业务键分段并缩短临界区；示例：只锁内存状态更新，不包围完整方法 |

## 扩展微服务与中间件规则

### Spring Cloud 与 Dubbo

| 规则 ID | 等级 | mode | 命中条件 | 排除条件 | 必需证据 | 修复要求与示例 |
|---|---|---|---|---|---|---|
| `PERF-BE-037` | ERROR | HYBRID | 完整项目配置证明上游总超时小于或等于下游调用、重试与退避预算之和，导致孤儿请求或级联超时 | 仅当前文件看不到全链路配置 | 网关/消费者/提供者超时及重试次数、退避参数 | 从外向内递减预算并预留处理时间；示例：网关 3s、消费者 2s、提供者 1.5s |
| `PERF-BE-038` | WARN | AI | Dubbo/HTTP 高频接口直接传输无界集合、深层对象图、文件字节或包含大量未使用字段的 DTO | 分页、流式传输或大小有硬上限 | DTO 定义、入口参数来源和调用方式 | 使用轻量 DTO、分页或对象存储引用；示例：传 `fileId` 而非 `byte[]` |
| `PERF-BE-039` | ERROR | HYBRID | Dubbo `broadcast`、`forking` 或等价配置用于请求链路，调用数随提供者数量放大且无明确上限 | 受控运维任务且提供者数量固定、可验证 | cluster 配置、调用入口及提供者范围 | 改为单提供者、异步事件或有界批次；示例：移除 `cluster="broadcast"` |
| `PERF-BE-040` | WARN | AI | 单请求同步遍历动态服务/租户/分片列表并逐一远程调用，形成扇出和尾延迟放大 | 数量严格固定且极小，或调用为本地计算 | 扇出集合来源、调用链和等待方式 | 提供聚合/批量接口；必要时使用有界并发和统一截止时间 |
| `PERF-BE-041` | ERROR | HYBRID | 同一远程调用同时叠加重试、熔断、隔离、降级或 fallback 再调用原服务，形成重复执行或超时放大 | 策略互斥且总尝试次数有可验证上限 | 注解、过滤器、客户端配置及 fallback 调用链 | 只保留一个重试责任层；fallback 不回调原链路，统一总预算 |

### Nacos 与 Redis

| 规则 ID | 等级 | mode | 命中条件 | 排除条件 | 必需证据 | 修复要求与示例 |
|---|---|---|---|---|---|---|
| `PERF-BE-042` | ERROR | HYBRID | 请求、刷新或重复初始化路径注册 Nacos Listener 且无去重/注销，或 Listener 回调直接执行阻塞 I/O/重型重建 | 应用启动期单次注册且回调快速、幂等 | 注册入口、生命周期、回调体和注销路径 | 单例注册并在回调中投递有界任务；销毁时调用对应注销 API |
| `PERF-BE-043` | ERROR | HYBRID | HTTP/RPC 请求路径调用 Nacos 发布配置、拉取大配置或反复解析完整配置文本 | 管理端低频操作且有鉴权、限流和大小上限 | 控制器调用链、Nacos API 和配置大小边界 | 发布移到管理流程；业务请求读取本地配置绑定或监听后的缓存 |
| `PERF-BE-044` | ERROR | STATIC | 对规模不受控的 Redis 集合执行 `HGETALL`、`SMEMBERS`、`LRANGE 0 -1`、`ZRANGE 0 -1` 等全量读取 | 代码和容量策略证明集合严格小且有上限 | 命令、key 来源、范围参数及容量约束 | 使用 `HSCAN`/`SSCAN`/`ZSCAN` 或有界分页，并限制 big key |
| `PERF-BE-045` | ERROR | HYBRID | Lua 脚本遍历无界集合、执行大范围命令或循环次数受外部数据控制，可能长时间阻塞 Redis | 常量级原子脚本且键数、循环均有硬上限 | 脚本正文、KEYS/ARGV 来源和循环边界 | 拆为短小常量级脚本；大任务分批在应用侧调度 |
| `PERF-BE-046` | WARN | HYBRID | 对可能为 big key 的值同步执行 `DEL`，且无大小判断、异步删除或分片 | key 大小有可验证的小上限 | 删除调用、key 类型/大小来源及 Redis 版本能力 | 优先 `UNLINK` 或渐进清理；示例：`redisTemplate.unlink(key)` |

### RabbitMQ

| 规则 ID | 等级 | mode | 命中条件 | 排除条件 | 必需证据 | 修复要求与示例 |
|---|---|---|---|---|---|---|
| `PERF-BE-047` | ERROR | STATIC | 每条消息或每次业务请求创建 Connection/Channel，或重复声明 Exchange/Queue/Binding | 应用启动期声明且连接由框架池化复用 | 创建/声明 API 与外层消息或请求入口 | 使用 Spring 管理的 `CachingConnectionFactory`，拓扑只在启动期声明 |
| `PERF-BE-048` | WARN | HYBRID | 发布循环中每条消息同步等待 Confirm/Return，吞吐被逐条网络往返限制 | 低频关键消息且业务明确要求逐条同步确认 | 发布循环、Confirm 调用和等待位置 | 使用异步 Confirm、批量窗口和有界未确认集合 |
| `PERF-BE-049` | WARN | HYBRID | prefetch 明显无界，或大于消费者线程、内存与单消息处理能力且无背压 | 配置与容量测试证明参数匹配 | prefetch、并发消费者、线程池队列和消息大小 | 按并发与处理时长设置有界 prefetch，并监控未确认消息 |
| `PERF-BE-050` | ERROR | STATIC | 异常路径执行 `nack/reject(requeue=true)`，没有次数、延迟或 DLQ，形成立即重投热循环 | Broker 策略可证明有限重试并最终进入 DLQ | catch 路径、ack 参数和重试/DLQ 配置 | 拒绝后进入有限延迟重试或 DLQ；业务消费保持幂等 |

## 后端制品与构建规则

| 规则 ID | 等级 | mode | 命中条件 | 排除条件 | 必需证据 | 修复要求与示例 |
|---|---|---|---|---|---|---|
| `PERF-ART-006` | WARN | DEPENDENCY | JAR 内单个或累计资源超过平台预算，或压缩比异常导致解压、类路径扫描和内存放大 | 平台批准资源且采用外部存储/流式加载 | 压缩前后大小、条目类型、路径及预算值 | 大文件放对象存储；拆分或按需加载，禁止把归档再嵌套进业务 JAR |

## 新增规则测试矩阵

每行固定包含两个命中样例（P1/P2）和两个反例（N1/N2）。测试夹具应替换为等价可解析源码或制品清单，并校验规则 ID、等级和证据位置。

| 规则 | P1 命中 | P2 命中 | N1 反例 | N2 反例 |
|---|---|---|---|---|
| PERF-BE-027 | 外部 `page` 直接计算大 OFFSET | `PageRequest.of(page,size)` 无最大页限制 | `id > lastId` 游标分页 | 页码被固定上限拦截 |
| PERF-BE-028 | 请求 `ids` 直接进入一个 IN | 数万 ID 拼成 MyBatis foreach | 500 条分片查询 | 集合由枚举固定为 3 项 |
| PERF-BE-029 | 列表接口执行 `SELECT *` | 查询含未使用 BLOB 字段 | 显式选择 DTO 字段 | 唯一键查询且全部字段被使用 |
| PERF-BE-030 | `save()` 循环无 flush/clear | 大集合一次 `saveAll` 无批上限 | 每 500 条 flush/clear | 输入固定最多 20 条 |
| PERF-BE-031 | 导出先 `queryForList` 全量加载 | 全表同步返回 `List` | MyBatis Cursor 流式消费 | 唯一键最多返回一条 |
| PERF-BE-032 | 循环内 `Pattern.compile` | 每请求扫描反射字段 | 静态预编译 Pattern | 启动期一次创建元数据 |
| PERF-BE-033 | 大循环内 `String.format` | Stream 多次 collect 生成中间集合 | 单个 StringBuilder 追加 | 固定 3 项的小循环 |
| PERF-BE-034 | 服务方法调用 `System.gc()` | 定时任务调用 `Runtime.gc()` | 无主动 GC 调用 | 不打包的 GC 测试夹具 |
| PERF-BE-035 | static Map 按用户无限写入 | ThreadLocal set 后无 remove | 有界 TTL Cache | finally 中调用 remove |
| PERF-BE-036 | `synchronized(SomeClass.class)` 包住业务流程 | 单例锁覆盖整段批处理 | 按业务键分段锁 | 极短启动期临界区 |
| PERF-BE-037 | 网关 2s、下游调用 5s | 消费者 1s 但重试预算 3s | 超时从外向内递减 | 单文件缺配置，仅待验证 |
| PERF-BE-038 | RPC DTO 携带无界 `List` | Dubbo 参数直接传 `byte[]` 文件 | 分页轻量 DTO | 传对象存储 fileId |
| PERF-BE-039 | 请求链路配置 broadcast | 动态提供者上使用 forking | 单提供者 failfast | 固定运维任务经审批执行 |
| PERF-BE-040 | 遍历租户同步 RPC | 遍历分片串行 HTTP | 服务端批量聚合接口 | 固定一次本地调用 |
| PERF-BE-041 | Feign retry 外再包 Retry 注解 | fallback 再调用原远程方法 | 单一有限重试层 | fallback 返回本地降级值 |
| PERF-BE-042 | 请求中重复 addListener | Listener 回调同步下载大文件 | 启动期单次注册 | 销毁时注销且回调只投递任务 |
| PERF-BE-043 | Controller 内 publishConfig | 每请求 getConfig 后解析大文本 | 配置绑定读取本地值 | 受限管理接口低频发布 |
| PERF-BE-044 | `HGETALL` 读取用户增长 Hash | `LRANGE key 0 -1` | HSCAN 游标分页 | 容量硬限制为 10 项 |
| PERF-BE-045 | Lua 遍历外部传入全部成员 | Lua 内大范围 KEYS 查询 | 常量级 compare-and-delete | 循环上限固定为 3 |
| PERF-BE-046 | 未知大 Key 直接 DEL | 批处理同步删除大型 Hash | 使用 UNLINK | 小 Key 大小有硬证据 |
| PERF-BE-047 | 消费回调内 new Connection | 每条消息 declareQueue | 复用受管连接工厂 | 启动期一次声明拓扑 |
| PERF-BE-048 | 发布循环逐条 waitForConfirms | 每条消息同步等待 Return | 异步 Confirm | 低频单条关键消息 |
| PERF-BE-049 | prefetch 无界且消费者单线程 | 大消息场景 prefetch 远超容量 | 有界 prefetch 与并发匹配 | 压测证明参数满足容量 |
| PERF-BE-050 | catch 后无限 requeue=true | reject 后立即回到同一队列 | 有限延迟重试后 DLQ | requeue=false 并记录失败 |
| PERF-ART-006 | JAR 内嵌数百 MB 资源 | 高压缩比嵌套归档进入 classpath | 大文件放对象存储 | 小资源低于统一预算 |

## 修复示例

### 批量查询替代循环查询

```java
Set<String> uniqueIds = new HashSet<>(ids);
Map<String, User> usersById = userMapper.selectBatchIds(uniqueIds).stream()
    .collect(Collectors.toMap(User::getId, Function.identity()));
```

### 复用客户端并配置超时

```java
@Bean
RestTemplate restTemplate(RestTemplateBuilder builder) {
    return builder
        .setConnectTimeout(Duration.ofSeconds(2))
        .setReadTimeout(Duration.ofSeconds(5))
        .build();
}
```

### 有界批处理

```java
for (int from = 0; from < records.size(); from += BATCH_SIZE) {
    int to = Math.min(from + BATCH_SIZE, records.size());
    repository.saveBatch(records.subList(from, to));
}
```
