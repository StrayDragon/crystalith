import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from '@rstest/core';

const webRoot = join(import.meta.dirname, '../../..');

function walk(dir: string, acc: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else if (/\.(ts|tsx)$/u.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('web-ui-no-material-tailwind', () => {
  it('runtime package.json does not list Material Tailwind', () => {
    const pkg = JSON.parse(readFileSync(join(webRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.['@material-tailwind/react']).toBeUndefined();
    expect(pkg.devDependencies?.['@material-tailwind/react']).toBeUndefined();
  });

  it('source does not import Material Tailwind', () => {
    const hits = walk(join(webRoot, 'src'), []).filter((file) => {
      const text = readFileSync(file, 'utf8');
      return /from\s+['"]@material-tailwind\/react['"]/u.test(text);
    });
    expect(hits).toEqual([]);
  });
});
