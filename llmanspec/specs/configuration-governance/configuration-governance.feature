# language: zh-CN
# capability: configuration-governance
# purpose: 定义 Crystalith 的配置管理体系：配置源优先级、命名约定、加载校验流水线、存储路径派生规则、accessor 规范与确定性要求。该规范覆盖所有运行时配置的读取与管理行为，不覆盖业务语义。
# scope: apps/server/src/shared/, apps/server/src/db/, apps/server/src/features/, config/

功能: configuration-governance

  @req:r27 @human
  场景: Configuration source priority chain
    - 系统 MUST 支持三级配置源优先级链：1) 环境变量（CL_* 前缀）最高优先级；2) YAML 配置文件（config/app.yaml）中间优先级；3) 硬编码默认值最低优先级。高优先级源 MUST 覆盖低优先级源的对应键。MUST NOT 出现配置源绕过优先级链直接生效的行为。

  @req:r85 @human
  场景: CL_* environment variable naming convention
    - 环境变量 MUST 使用 CL_ 前缀命名空间。MUST 采用 SCREAMING_SNAKE_CASE。MUST 在 config/app.yaml 的 {{ env.CL_* }} 模板中声明对应的 YAML 缺省值。非 CL_ 前缀的环境变量（如 SEARXNG_HOST）仅作为向后兼容 fallback，新配置 MUST 使用 CL_ 前缀。

  @req:r122 @human
  场景: YAML config loading pipeline
    - config/app.yaml MUST 经过三段加载流水线：1) 模板渲染 {{ env.* }}/{{ secret.* }}；2) YAML parse（支持 anchors）；3) Zod schema 校验。三个阶段任一失败 MUST 抛出可读错误并在启动时阻止服务启动（非静默降级）。

  @req:r158 @human
  场景: Typed config accessor requirement
    - 所有配置读取 MUST 通过 typed accessor 函数（数据根目录、默认模型等均各有 accessor）。Accessor MUST 从配置节 + schema 默认值解析并返回类型化对象。MUST NOT 在业务代码中直接解构 raw config 对象。

  @req:r193 @human
  场景: Unified storage data root
    - 所有运行时文件存储路径（SQLite DB、slides、uploads、content storage）MUST 从 storage.data_root 派生。MUST NOT 独立硬编码路径或使用独立的默认路径（如 ~/.crystalith/storage）。CL_DATA_ROOT 环境变量 MUST 覆盖 YAML 配置。

  @req:r224 @human
  场景: Timeout and limit config governance
    - 业务超时与限值（timeout、max_retries、max_results、batch_size 等）MUST 通过 config schema 定义默认值并通过 accessor 读取。MUST NOT 在业务代码中直接硬编码数字常量作为运行时逻辑分支依据。UI/前端常量不受此约束。

  @req:r249 @human
  场景: YAML section naming convention
    - config/app.yaml 段落 MUST 使用 snake_case。段落名 MUST 与 Zod schema 名对齐（如 concurrency、embedding、storage、search），避免含混缩写。optional_services 等跨层段落需在段落注释中标注用途与消费者。

  @req:r8 @human
  场景: Configuration must be deterministic
    - 同一组环境变量 + 同一份 config/app.yaml MUST 产生完全相同的 AppConfig 对象。配置加载 MUST 是纯函数（无随机、无网络 I/O、无时间依赖）。secret.env 的缺失 MUST 不改变行为（仅日志警告），应用继续以环境变量提供的值运行。

  @req:r27 @human
  场景: happy
    - 必须成立：当 设置 CL_DATA_ROOT=/custom，同时 config 中 storage.data_root=./data；那么 数据根 accessor 返回 /custom
    当 设置 CL_DATA_ROOT=/custom，同时 config 中 storage.data_root=./data
    那么 数据根 accessor 返回 /custom

  @req:r27 @human
  场景: precedence_env_overrides_yaml
    - 必须成立：假如 storage.data_root 设为 ./data_local；当 设置 CL_DATA_ROOT=/prod；那么 数据根 accessor 返回 /prod（env 优先）
    假如 storage.data_root 设为 ./data_local
    当 设置 CL_DATA_ROOT=/prod
    那么 数据根 accessor 返回 /prod（env 优先）

  @req:r85 @human
  场景: naming_new_config
    - 必须成立：假如 新增某个功能的 CL_ 配置；当 检查命名；那么 前缀为 CL_，SCREAMING_SNAKE_CASE
    假如 新增某个功能的 CL_ 配置
    当 检查命名
    那么 前缀为 CL_，SCREAMING_SNAKE_CASE

  @req:r122 @human
  场景: loading_failure
    - 必须成立：假如 config/app.yaml 语法错误；当 启动 server；那么 服务拒绝启动，抛出可读错误
    假如 config/app.yaml 语法错误
    当 启动 server
    那么 服务拒绝启动，抛出可读错误

  @req:r158 @human
  场景: typed_accessor_in_code
    - 必须成立：假如 需要读取 embedding chunk_size；当 调用 getEmbeddingSettings()；那么 返回 typed EmbeddingSettings 对象
    假如 需要读取 embedding chunk_size
    当 调用 getEmbeddingSettings()
    那么 返回 typed EmbeddingSettings 对象

  @req:r193 @human
  场景: storage_alignment
    - 必须成立：假如 内容存储默认基目录；当 检查默认值；那么 派生自数据根 accessor，非 ~/.crystalith/storage
    假如 内容存储默认基目录
    当 检查默认值
    那么 派生自数据根 accessor，非 ~/.crystalith/storage

  @req:r193 @human
  场景: data_root_env
    - 必须成立：假如 CL_DATA_ROOT 设为 /mnt/data；当 读取数据根 accessor；那么 返回 /mnt/data
    假如 CL_DATA_ROOT 设为 /mnt/data
    当 读取数据根 accessor
    那么 返回 /mnt/data

  @req:r224 @human
  场景: timeout_in_config
    - 必须成立：假如 新增一个 HTTP 调用超时；当 在 config 中定义并设置默认值；那么 业务代码通过 accessor 读取，无硬编码数字
    假如 新增一个 HTTP 调用超时
    当 在 config 中定义并设置默认值
    那么 业务代码通过 accessor 读取，无硬编码数字

  @req:r249 @human
  场景: section_naming
    - 必须成立：假如 新增一个配置段落；当 检查段落名；那么 snake_case 且与 Zod schema 名一致
    假如 新增一个配置段落
    当 检查段落名
    那么 snake_case 且与 Zod schema 名一致

  @req:r8 @human
  场景: deterministic_load
    - 必须成立：假如 同一份 YAML + 同一组 env；当 两次调用 loadConfig()；那么 返回完全相同的 AppConfig 对象
    假如 同一份 YAML + 同一组 env
    当 两次调用 loadConfig()
    那么 返回完全相同的 AppConfig 对象
