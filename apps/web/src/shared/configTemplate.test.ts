import { expect, test } from 'vitest';

import { renderConfigTemplate } from './configTemplate';

test('renderConfigTemplate renders env and secret namespaces', () => {
  const out = renderConfigTemplate('a={{ env.FOO }}, b={{ secret.BAR }}', {
    env: { FOO: '1' },
    secret: { BAR: '2' },
  });

  expect(out).toBe('a=1, b=2');
});

test('renderConfigTemplate throws on missing variables by default', () => {
  expect(() =>
    renderConfigTemplate('a={{ env.MISSING }}', {
      env: {},
      secret: {},
    }),
  ).toThrow(/undefined/i);
});

test('renderConfigTemplate supports default() and the default filter', () => {
  const filterOut = renderConfigTemplate("a={{ env.MISSING | default('x') }}", {
    env: {},
    secret: {},
  });
  expect(filterOut).toBe('a=x');

  const globalOut = renderConfigTemplate("a={{ default(env.MISSING, 'y') }}", {
    env: {},
    secret: {},
  });
  expect(globalOut).toBe('a=y');
});
