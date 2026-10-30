// covers: r382/r383/r384/r385（workspace-command-registry）——GET /v2/commands 端点：非空、kind 容错、preset 反映、trigger 升序。
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: 'mocked' }),
  streamText: () => ({
    stream: (async function* () {})(),
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  tool: (def: unknown) => def,
}));

import { notebooks } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'commands-test' }).returning().get().id;
});
afterAll(teardownIntegrationEnv);

async function getCommands(): Promise<Array<Record<string, unknown>>> {
  const res = await app.handle(new Request(`${BASE}/v2/commands`));
  expect(res.status).toBe(200);
  return (await res.json()) as Array<Record<string, unknown>>;
}

describe('r382 GET /v2/commands returns non-empty array', () => {
  it('responds 200 with at least one command', async () => {
    const commands = await getCommands();
    expect(commands.length).toBeGreaterThanOrEqual(1);
  });
});

describe('r383 each command has valid kind', () => {
  it('all commands carry a known kind field', async () => {
    const commands = await getCommands();
    const kinds = new Set(commands.map((c) => c.kind));
    for (const k of kinds) expect(['nav', 'prompt_preset']).toContain(k);
  });
});

describe('r384 built-in /prompt:stats command is present', () => {
  it('contains the built-in stats preset command', async () => {
    const commands = await getCommands();
    const stats = commands.find((c) => c.trigger === '/prompt:stats');
    expect(stats).toBeTruthy();
    expect(stats!.source).toBe('builtin');
  });
});

describe('r385 commands are sorted by trigger ascending', () => {
  it('two consecutive GETs return the same trigger-ascending order', async () => {
    const [a, b] = await Promise.all([getCommands(), getCommands()]);
    const ta = a.map((c) => c.trigger as string);
    const tb = b.map((c) => c.trigger as string);
    const sorted = [...ta].sort();
    expect(ta).toEqual(sorted);
    expect(tb).toEqual(sorted);
  });
});
