# test-stability Specification

## Purpose
TBD - created by archiving change test-stability-pass. Update Purpose after archive.
## Requirements
### Requirement: Tests MUST avoid wall-clock timing thresholds
测试 MUST 避免使用 `sleep` + `perf_counter` 阈值来证明并发行为；应改用可控的同步原语（`asyncio.Event`/`threading.Event`/barrier）进行确定性断言。

#### Scenario: Executor non-blocking is asserted without perf thresholds
- **WHEN** 测试需要验证“慢解析不会阻塞快速请求”
- **THEN** 测试使用屏障控制慢解析进度，并断言快速请求在屏障未放行时仍可完成

### Requirement: Cache TTL tests MUST use controllable time
缓存 TTL 相关测试 MUST 使用可控时钟（monkeypatch time source）或足够大的 TTL/余量，避免毫秒级 sleep 导致 flake。

#### Scenario: TTL expiry is deterministic
- **WHEN** 测试需要验证 TTL 过期
- **THEN** 测试通过推进可控时钟使条目过期，而不是依赖真实 sleep

### Requirement: Frontend timer-based tests MUST use fake timers
前端测试中依赖 `setTimeout`/interval 的逻辑 MUST 使用 fake timers（如 `vi.useFakeTimers()`）推进时间，并避免真实等待。

#### Scenario: Cancel behavior does not depend on real setTimeout
- **WHEN** 测试需要覆盖基于定时器的取消/重试逻辑
- **THEN** 测试通过推进 fake timers 触发状态变化并断言结果
