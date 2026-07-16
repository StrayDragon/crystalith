// Tests for c56 studio config interpretation — range expansion, frontmatter
// 6-key shape, override path, preference→retrieval tuning, and config_schema
// completeness. Verifies v1 slides/config.py + generator.py parity.
import { describe, expect, it } from 'bun:test';

import {
  buildSlidesConfigSchema,
  resolveBulletRange,
  resolveQuantityRange,
  resolveRetrievalTuning,
  THEME_PRESET_TEMPLATES,
} from '../../src/features/studio/config.ts';
import { buildConfigHints } from '../../src/features/studio/service.ts';
import { buildFrontmatter } from '../../src/features/studio/theme-presets.ts';

describe('c56: config range expansion (v1 config.py parity)', () => {
  it('expands quantity=detailed to the 12-18 range', () => {
    expect(resolveQuantityRange('detailed')).toEqual([12, 18]);
  });

  it('expands quantity=short to 6-8', () => {
    expect(resolveQuantityRange('short')).toEqual([6, 8]);
  });

  it('falls back to standard (8-12) for unknown/missing quantity', () => {
    expect(resolveQuantityRange(null)).toEqual([8, 12]);
    expect(resolveQuantityRange('nonexistent')).toEqual([8, 12]);
  });

  it('expands density=dense to 5-7 bullets', () => {
    expect(resolveBulletRange('dense')).toEqual([5, 7]);
  });

  it('falls back to standard density (3-5)', () => {
    expect(resolveBulletRange(null)).toEqual([3, 5]);
  });

  it('buildConfigHints produces concrete ranges in Chinese (not raw token)', () => {
    const hints = buildConfigHints({
      quantity: 'detailed',
      density: 'sparse',
      language: 'zh',
      audience: 'executive',
    });
    expect(hints).toContain('12-18 张幻灯片');
    expect(hints).toContain('2-3 个要点');
    expect(hints).toContain('输出语言：中文');
    expect(hints).toContain('受众定位：强调结论与决策要点，简洁直达');
    // MUST NOT contain the raw token 'detailed'
    expect(hints).not.toContain('~detailed');
  });
});

describe('c56: frontmatter 6-key shape (v1 THEME_PRESET_TEMPLATES parity)', () => {
  it('emits theme: default for minimal-clean (not seriph/bricks)', () => {
    const fm = buildFrontmatter('minimal-clean');
    expect(fm).toContain('theme: default');
    expect(fm).not.toContain('seriph');
  });

  it('contains all 6 v1 keys for every preset', () => {
    for (const [id, template] of Object.entries(THEME_PRESET_TEMPLATES)) {
      const fm = buildFrontmatter(id);
      expect(fm).toContain('theme: default'); // v1 always uses default
      expect(fm).toContain(`colorSchema: ${template.colorSchema}`);
      expect(fm).toContain('fonts:');
      expect(fm).toContain(`sans: ${template.fonts.sans}`);
      expect(fm).toContain(`serif: ${template.fonts.serif}`);
      expect(fm).toContain(`mono: ${template.fonts.mono}`);
      expect(fm).toContain(`transition: ${template.transition}`);
      expect(fm).toContain(`background: ${template.background}`);
      expect(fm).toContain(`class: ${template.class}`);
    }
  });

  it('creative-visual uses dark colorSchema', () => {
    expect(THEME_PRESET_TEMPLATES['creative-visual']!.colorSchema).toBe('dark');
    const fm = buildFrontmatter('creative-visual');
    expect(fm).toContain('colorSchema: dark');
  });

  it('wraps body in --- fences', () => {
    const fm = buildFrontmatter('minimal-clean');
    expect(fm.startsWith('---\n')).toBe(true);
    expect(fm.endsWith('---\n')).toBe(true);
  });
});

describe('c56: frontmatter override path (v1 _normalize_frontmatter_override)', () => {
  it('uses the override verbatim when frontmatter is non-empty', () => {
    const fm = buildFrontmatter('minimal-clean', null, 'theme: seriph\nbackground: black');
    expect(fm).toContain('theme: seriph');
    expect(fm).toContain('background: black');
    // preset template keys MUST NOT appear
    expect(fm).not.toContain('colorSchema: light');
  });

  it('strips surrounding --- fences from the override', () => {
    const fm = buildFrontmatter('minimal-clean', null, '---\ntheme: apple-basic\n---');
    expect(fm).toContain('theme: apple-basic');
    // Should not have doubled fences inside
    expect(fm.match(/---/g)?.length).toBe(2);
  });

  it('prepends title: when title provided and override lacks it', () => {
    const fm = buildFrontmatter('minimal-clean', 'My Talk', 'theme: seriph');
    expect(fm).toContain('title: My Talk');
    expect(fm).toContain('theme: seriph');
  });

  it('does not prepend title when override already has one', () => {
    const fm = buildFrontmatter('minimal-clean', 'Ignored', 'title: Kept\ntheme: seriph');
    expect(fm).toContain('title: Kept');
    expect(fm).not.toContain('Ignored');
  });

  it('falls back to preset when override is empty/whitespace', () => {
    const fm = buildFrontmatter('minimal-clean', null, '   ');
    expect(fm).toContain('theme: default');
    expect(fm).toContain('colorSchema: light');
  });
});

describe('c56: preference → retrieval tuning (v1 SLIDES tuning table)', () => {
  it('quality yields larger topK and lower minScore', () => {
    const q = resolveRetrievalTuning('quality');
    expect(q.topK).toBe(12);
    expect(q.minScore).toBe(0.1);
  });

  it('speed yields smaller topK', () => {
    const s = resolveRetrievalTuning('speed');
    expect(s.topK).toBe(6);
    expect(s.minScore).toBe(0.22);
  });

  it('no preference falls back to module constants (8/0.2), not DEFAULT_TUNING (5)', () => {
    const d = resolveRetrievalTuning(null);
    expect(d.topK).toBe(8);
    expect(d.minScore).toBe(0.2);
  });
});

describe('c56: buildSlidesConfigSchema completeness (workspace-api-contract r20)', () => {
  const schema = buildSlidesConfigSchema();

  it('returns all 7 options arrays non-empty', () => {
    expect(schema.quantityOptions.length).toBeGreaterThan(0);
    expect(schema.audienceOptions.length).toBeGreaterThan(0);
    expect(schema.structureOptions.length).toBeGreaterThan(0);
    expect(schema.toneOptions.length).toBeGreaterThan(0);
    expect(schema.languageOptions.length).toBeGreaterThan(0);
    expect(schema.densityOptions.length).toBeGreaterThan(0);
    expect(schema.themePresetOptions.length).toBeGreaterThan(0);
  });

  it('each option has id, label, isDefault', () => {
    for (const opt of schema.quantityOptions) {
      expect(typeof opt.id).toBe('string');
      expect(typeof opt.label).toBe('string');
      expect(typeof opt.isDefault).toBe('boolean');
    }
  });

  it('defaults object is populated', () => {
    expect(schema.defaults).toBeTruthy();
    expect(typeof schema.defaults).toBe('object');
  });

  it('engine is slidev', () => {
    expect(schema.engine).toBe('slidev');
  });

  it('has exactly one default per options array', () => {
    const arrays = [
      schema.quantityOptions,
      schema.audienceOptions,
      schema.structureOptions,
      schema.toneOptions,
      schema.languageOptions,
      schema.densityOptions,
    ];
    for (const arr of arrays) {
      const defaults = arr.filter((o) => o.isDefault);
      expect(defaults.length).toBe(1);
    }
  });
});
