import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { getLogLevel, logger, setLogLevel } from '../../src/shared/logger.ts';

describe('structured logger', () => {
  let entries: Array<Record<string, unknown>>;
  let spies: Array<ReturnType<typeof spyOn>>;

  const capture = () => {
    entries = [];
    const push =
      (level: string) =>
      (...args: unknown[]) => {
        entries.push({ __channel: level, ...JSON.parse(String(args[0])) });
      };
    spies = [
      spyOn(console, 'log').mockImplementation(push('log')),
      spyOn(console, 'warn').mockImplementation(push('warn')),
      spyOn(console, 'error').mockImplementation(push('error')),
    ];
  };

  beforeEach(() => {
    capture();
    setLogLevel('info');
  });

  afterEach(() => {
    for (const s of spies) s.mockRestore();
  });

  it('emits single-line JSON with ts/level/msg', () => {
    logger.info('hello', { requestId: 'r1' });
    expect(entries.length).toBe(1);
    expect(entries[0]!.level).toBe('info');
    expect(entries[0]!.msg).toBe('hello');
    expect(entries[0]!.requestId).toBe('r1');
    expect(typeof entries[0]!.ts).toBe('string');
  });

  it('routes error/warn to stderr channels and info to stdout', () => {
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    expect(entries.find((e) => e.msg === 'i')?.__channel).toBe('log');
    expect(entries.find((e) => e.msg === 'w')?.__channel).toBe('warn');
    expect(entries.find((e) => e.msg === 'e')?.__channel).toBe('error');
  });

  it('filters below active level and keeps above/equal', () => {
    setLogLevel('warn');
    logger.info('dropped');
    logger.debug('dropped');
    logger.warn('kept');
    logger.error('kept');
    const msgs = entries.map((e) => e.msg);
    expect(msgs).toEqual(['kept', 'kept']);
  });

  it('child binds constant fields without mutating parent', () => {
    const req = logger.child({ requestId: 'abc' });
    req.error('boom', { code: 'X' });
    logger.info('no-fields');
    expect(entries.length).toBe(2);
    expect(entries[0]).toMatchObject({ requestId: 'abc', code: 'X' });
    expect(entries[1]?.requestId).toBeUndefined();
  });

  it('getLogLevel reflects overrides', () => {
    setLogLevel('debug');
    expect(getLogLevel()).toBe('debug');
    setLogLevel('error');
    expect(getLogLevel()).toBe('error');
  });

  it('auto-attaches requestId from requestContext (D3)', async () => {
    const { requestContext } = await import('../../src/shared/logger.ts');
    await requestContext.run({ requestId: 'als-42' }, () => {
      logger.warn('deep-service');
      logger.error('explicit-wins', { requestId: 'manual' });
    });
    logger.info('outside-context');
    const deep = entries.find((e) => e.msg === 'deep-service');
    const explicit = entries.find((e) => e.msg === 'explicit-wins');
    const outside = entries.find((e) => e.msg === 'outside-context');
    expect(deep?.requestId).toBe('als-42');
    expect(explicit?.requestId).toBe('manual');
    expect(outside?.requestId).toBeUndefined();
  });

  it('folds legacy varargs (string tail + Error)', () => {
    logger.error('[sessions] convert embedding failed:', new Error('boom'));
    const e = entries[0]!;
    expect(e.msg).toContain('[sessions] convert embedding failed: — boom');
    expect(e.errMessage ?? e.errorMessage).toBeDefined();
  });
});
