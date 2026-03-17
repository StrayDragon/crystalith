from __future__ import annotations

import logging
import os
import site
import sys
from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import dataclass, field, replace
from datetime import datetime
from typing import Any, Literal

import structlog
from cl_stdx.enumx.compact import StrEnum
from rich.logging import RichHandler
from structlog.typing import EventDict, FilteringBoundLogger, WrappedLogger

_CONFIGURED = False
"""
避免重复配置
"""

_CONFIG_LOCKED = False
"""
防止意外重新配置
"""

_LOG_LEVEL = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]


class StructLogKey(StrEnum):
    EVENT = "event"
    LEVEL = "level"
    TIMESTAMP = "timestamp"
    EXC_INFO = "exc_info"
    PID = "pid"
    THREAD_ID = "thread_id"
    THREAD_NAME = "thread_name"
    HOSTNAME = "hostname"
    ENVIRONMENT = "environment"
    CONTAINER = "container"
    SERVICE = "service"
    VERSION = "version"
    MODULE = "module"
    LOGGER_NAME = "logger_name"


@dataclass
class LogConfig:
    use_json: bool | None = None
    """
    输出格式控制:
    - None: 自动检测(推荐)- TTY=彩色,非TTY=JSON
    - True: 强制 JSON 输出(生产环境)
    - False: 强制彩色输出(开发环境)
    """

    level: _LOG_LEVEL = "INFO"
    """日志级别"""

    enable_rich: bool = True
    """
    开发环境 Rich 增强:
    - True: 启用彩色异常回溯和变量显示
    - False: 使用简单的文本格式
    """

    package_levels: dict[str, str] = field(default_factory=dict)
    """
    第三方包日志级别控制

    Examples:
        >>> {
        ...     "sqlalchemy": "WARNING",
        ...     "httpx": "WARNING",
        ...     "redis": "INFO"
        ... }
    """

    min_json_level: str = "INFO"
    """
    JSON 模式最低日志级别
    用于减少生产环境的日志噪音
    """

    def __post_init__(self) -> None:
        """验证和规范化配置参数"""
        if not isinstance(self.level, str):
            raise TypeError(f"level must be str, got {type(self.level)}")

        if not isinstance(self.min_json_level, str):
            raise TypeError(f"min_json_level must be str, got {type(self.min_json_level)}")

        # 规范化日志级别为大写
        self.level = self.level
        self.min_json_level = self.min_json_level.upper()

        # 规范化包级别
        for package, level in self.package_levels.items():
            if not isinstance(level, str):
                raise TypeError(f"package_levels[{package}] must be str, got {type(level)}")
            self.package_levels[package] = level.upper()


def detect_json_output(use_json: bool | None = None) -> bool:
    """
    智能检测是否应该使用 JSON 输出

    检测优先级:
    1. 环境变量 LOGX_FORMAT (最高优先级)
    2. 显式配置参数
    3. 容器环境检测
    4. TTY 检测 (最后判断)

    Args:
        use_json: 显式指定的输出格式

    Returns:
        True 如果应该使用 JSON 输出
    """
    # 1. 环境变量优先级最高
    env_format = os.getenv("LOGX_FORMAT", "").lower().strip()
    if env_format in ("json", "console"):
        return env_format == "json"

    # 2. 显式配置参数
    if use_json is not None:
        return use_json

    # 3. 容器环境检测 - 支持 "true", "1", "yes" 等常见值
    docker_env = os.getenv("RUNNING_IN_DOCKER", "").lower().strip()
    if docker_env in ("true", "1", "yes", "on"):
        return True

    # 4. TTY 检测
    return not sys.stderr.isatty()


class CustomProcessor:
    @classmethod
    def timestamp(
        cls,
        _logger: FilteringBoundLogger,
        _method_name: str,
        event_dict: EventDict,
    ) -> EventDict:
        if (key := "timestamp") not in event_dict:
            event_dict[key] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return event_dict

    @classmethod
    def rich_text_renderer(cls, _logger: FilteringBoundLogger, _method_name: str, event_dict: EventDict) -> str:
        """输出适合Rich处理的文本格式"""
        parts: list[str] = []

        if (key := StructLogKey.EVENT.value) in event_dict:
            parts.append(event_dict[key])

        internal_fields = {i.value for i in StructLogKey}
        for key, value in event_dict.items():
            if key not in internal_fields:
                parts.append(f"{key}={value}")

        return " ".join(parts)

    @classmethod
    def add_stdlib_context(cls, _logger: WrappedLogger, _method_name: str, event_dict: EventDict) -> EventDict:
        """为标准库日志和结构化日志添加统一的上下文信息"""
        event_dict = structlog.contextvars.merge_contextvars(
            _logger,
            _method_name,
            event_dict,
        )
        ctx_snapshot = structlog.contextvars.get_contextvars()
        if ctx_snapshot:
            for key, value in ctx_snapshot.items():
                event_dict.setdefault(key, value)
        _ = cls.timestamp(_logger, _method_name, event_dict)
        return event_dict


def create_dev_processors() -> list[Any]:
    """
    创建rich库集成的人类友好的处理器链
    直接输出格式化文本给Rich handler处理
    """

    return [
        structlog.stdlib.filter_by_level,
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.ExtraAdder(),
        CustomProcessor.timestamp,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,  # 保留异常格式化
        structlog.processors.UnicodeDecoder(),
        CustomProcessor.rich_text_renderer,
    ]


def create_json_processors() -> list[Any]:
    """
    创建结构化日志环境(生产/离线脚本)的 JSON 处理器链
    包含丰富的上下文信息用于生产环境监控和调试
    """

    return [
        structlog.stdlib.filter_by_level,
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.ExtraAdder(),
        CustomProcessor.timestamp,
        CustomProcessor.add_stdlib_context,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
    ]


def create_third_party_levels(package_levels: dict[str, str]) -> dict[str, int]:
    """
    创建第三方包的日志级别映射

    Args:
        package_levels: 包名到级别的字符串映射

    Returns:
        包名到级别整数的映射
    """
    # 默认的第三方包级别设置
    default_levels = {
        "sqlalchemy": logging.WARNING,
        "sqlalchemy.engine": logging.WARNING,  # INFO => echo sql
        "sqlalchemy.pool": logging.WARNING,
        "httpx": logging.WARNING,
        "httpcore": logging.WARNING,
        "uvicorn.access": logging.INFO,
        "uvicorn.error": logging.INFO,
        "redis": logging.WARNING,
        "celery": logging.WARNING,
    }

    # 合并用户配置
    result = default_levels.copy()
    for package, level_str in package_levels.items():
        try:
            result[package] = getattr(logging, level_str.upper())
        except AttributeError:
            result[package] = logging.INFO  # 默认级别

    return result


def create_structlog_config(config: LogConfig) -> dict[str, Any]:
    use_json = detect_json_output(config.use_json)

    if use_json:
        processors = create_json_processors()
    else:
        processors = create_dev_processors()

    level = config.level if not use_json else config.min_json_level

    return {
        "processors": processors,
        "logger_factory": structlog.stdlib.LoggerFactory(),
        "cache_logger_on_first_use": True,
        "context_class": dict,
        "wrapper_class": structlog.make_filtering_bound_logger(getattr(logging, level, logging.INFO)),
    }


def configure_logging_once(config: LogConfig | None = None) -> None:
    """
    配置日志系统(单次模式)

    这是最常用的配置方式,确保整个应用程序只配置一次.
    """
    _configure_logging(config, force_reconfigure=False)


def reconfigure_logging(config: LogConfig | None = None) -> None:
    """
    重新配置日志系统

    用于特殊场景需要重新配置日志系统的情况,例如:
    - 测试环境需要不同的日志格式
    - 特定脚本需要静默或详细输出
    - 运行时动态调整日志级别

    Args:
        config: 新的日志配置,如果为 None 则使用默认配置
    """
    _configure_logging(config, force_reconfigure=True)


def _configure_logging(config: LogConfig | None = None, *, force_reconfigure: bool = False) -> None:
    """
    内部日志配置函数

    Args:
        config: 日志配置
        force_reconfigure: 是否强制重新配置
    """
    global _CONFIGURED, _CONFIG_LOCKED  # noqa: PLW0603

    # 如果已经配置且锁定,不允许重新配置
    if _CONFIGURED and _CONFIG_LOCKED and not force_reconfigure:
        return

    # 如果已经配置但不锁定,检查是否需要重新配置
    if _CONFIGURED and not force_reconfigure:
        return

    # 如果需要强制重新配置,允许覆盖锁定状态
    if force_reconfigure:
        _CONFIG_LOCKED = False

    # 复制配置以避免修改传入实例
    _config = replace(config) if config is not None else LogConfig()

    # 检测环境变量配置(高优先级)
    use_json = detect_json_output(_config.use_json)
    _config.use_json = use_json

    # 配置 structlog
    structlog_config = create_structlog_config(_config)
    structlog.configure(**structlog_config)

    # 配置标准库 logging 和 处理第三方包日志
    _setup_stdlib_logging(_config)

    _CONFIGURED = True

    # 强制重新配置后默认锁定,防止意外重复配置
    if force_reconfigure:
        _CONFIG_LOCKED = True


@contextmanager
def temporary_logging_config(config: LogConfig) -> Generator[None, None, None]:
    """
    临时日志配置上下文管理器

    用于在特定代码块中临时使用不同的日志配置,
    退出上下文后自动恢复到原始配置.
    """
    global _CONFIG_LOCKED  # noqa: PLW0603

    # 保存当前配置锁定状态
    original_locked = _CONFIG_LOCKED

    try:
        # 解锁配置以允许重新配置
        _CONFIG_LOCKED = False
        reconfigure_logging(config)
        yield
    finally:
        # 恢复原始锁定状态
        _CONFIG_LOCKED = original_locked


def _setup_stdlib_logging(config: LogConfig) -> None:
    env_level = os.getenv("LOG_LEVEL", "").upper().strip()
    effective_level = env_level if env_level in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"} else config.level
    use_json = config.use_json is True or (config.use_json is None and not sys.stderr.isatty())

    if use_json:  # JSON 输出:使用 ProcessorFormatter 统一处理 structlog 和标准库日志
        formatter = structlog.stdlib.ProcessorFormatter(
            processor=structlog.processors.JSONRenderer(
                indent=None,
                ensure_ascii=False,
                sort_keys=False,
            ),
            foreign_pre_chain=[
                structlog.stdlib.add_logger_name,
                structlog.stdlib.add_log_level,
                CustomProcessor.add_stdlib_context,
                structlog.processors.format_exc_info,
            ],
        )
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(formatter)
        handlers = [handler]
    else:  # 创建 Rich handler,配置异常增强
        rich_handler = RichHandler(
            tracebacks_show_locals=config.enable_rich,
            tracebacks_suppress=site.getsitepackages(),  # 抑制第三方库栈帧
            omit_repeated_times=False,
            rich_tracebacks=True,  # 启用美化的异常追踪
            markup=False,  # 默认关闭 markup,避免第三方库输出冲突
            show_time=True,  # 显示时间
            show_level=True,  # 显示日志级别
            show_path=True,  # 显示路径便于调试
            enable_link_path=False,  # 禁用路径链接
            tracebacks_max_frames=3,
            tracebacks_word_wrap=False,
        )

        # Rich handler直接使用标准formatter,并设置日期格式
        formatter = logging.Formatter(
            fmt="%(message)s",
            datefmt="[%Y-%m-%d %H:%M:%S]",  # 标准日期格式
        )
        rich_handler.setFormatter(formatter)
        handlers = [rich_handler]

    logging.basicConfig(
        level=getattr(logging, effective_level, logging.INFO),
        handlers=handlers,
        force=True,  # 强制重新配置
    )

    # 设置第三方包的日志级别
    package_levels = create_third_party_levels(config.package_levels)
    for package, level in package_levels.items():
        logging.getLogger(package).setLevel(level)


def get_logger(name: str = "") -> FilteringBoundLogger:
    """
    获取结构化日志记录器

    这是项目的主要日志入口点,提供统一的日志接口.
    自动适配运行环境,开发使用彩色输出,生产使用 JSON 格式.
    """
    if not _CONFIGURED:
        configure_logging_once()

    logger = structlog.get_logger(name)
    return logger.bind()


def reset_logging_state() -> None:
    """在测试场景下重置内部状态,允许重新配置日志系统."""
    global _CONFIGURED, _CONFIG_LOCKED  # noqa: PLW0603
    _CONFIGURED = False
    _CONFIG_LOCKED = False
