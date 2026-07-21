import type { PluginConfig } from '@crystalith/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { toApiGenerationPreference } from '../../../shared/hooks/useGenerationPreference';
import type { GenerationPreferenceSetting, SlideGenerationConfig } from '../../../shared/types';
import { buildFrontmatterPreview } from '../utils/slides';
import { resolveOptionId } from './slidesStudioUtils';

export function useSlidesConfigForm({
  slidesConfig,
  globalPreference,
  open,
  title,
}: {
  slidesConfig: PluginConfig | null;
  globalPreference: GenerationPreferenceSetting;
  open: boolean;
  title: string;
}) {
  const [configPreference, setConfigPreference] = useState<GenerationPreferenceSetting>(
    () => globalPreference,
  );
  const [configQuantity, setConfigQuantity] = useState('');
  const [configAudience, setConfigAudience] = useState('');
  const [configStructure, setConfigStructure] = useState('');
  const [configTone, setConfigTone] = useState('');
  const [configLanguage, setConfigLanguage] = useState('');
  const [configDensity, setConfigDensity] = useState('');
  const [configThemePreset, setConfigThemePreset] = useState('');
  const [configFrontmatter, setConfigFrontmatter] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [configModelId, setConfigModelId] = useState<string | null>(null);

  const configDefaults = slidesConfig?.defaults ?? null;

  const selectedThemePreset = useMemo(() => {
    const options = slidesConfig?.themePresetOptions ?? [];
    if (!options.length) return null;
    return options.find((option) => option.id === configThemePreset) ?? options[0] ?? null;
  }, [configThemePreset, slidesConfig?.themePresetOptions]);

  const frontmatterPreview = useMemo(
    () =>
      buildFrontmatterPreview(
        title.trim() || '演示',
        selectedThemePreset?.template,
        configFrontmatter,
      ),
    [configFrontmatter, selectedThemePreset?.template, title],
  );

  const applyGenerationConfig = useCallback(
    (config: SlideGenerationConfig | null | undefined) => {
      const defaults = configDefaults;
      const quantityOptions = slidesConfig?.quantityOptions ?? [];
      const audienceOptions = slidesConfig?.audienceOptions ?? [];
      const structureOptions = slidesConfig?.structureOptions ?? [];
      const toneOptions = slidesConfig?.toneOptions ?? [];
      const languageOptions = slidesConfig?.languageOptions ?? [];
      const densityOptions = slidesConfig?.densityOptions ?? [];
      const themeOptions = slidesConfig?.themePresetOptions ?? [];
      const preferenceValue =
        config?.preference === 'quality' || config?.preference === 'speed'
          ? config.preference
          : globalPreference;
      setConfigPreference(preferenceValue);
      setConfigQuantity(
        resolveOptionId(config?.quantity ?? defaults?.quantity ?? null, quantityOptions),
      );
      setConfigAudience(
        resolveOptionId(config?.audience ?? defaults?.audience ?? null, audienceOptions),
      );
      setConfigStructure(
        resolveOptionId(config?.structure ?? defaults?.structure ?? null, structureOptions),
      );
      setConfigTone(resolveOptionId(config?.tone ?? defaults?.tone ?? null, toneOptions));
      setConfigLanguage(
        resolveOptionId(config?.language ?? defaults?.language ?? null, languageOptions),
      );
      setConfigDensity(
        resolveOptionId(config?.density ?? defaults?.density ?? null, densityOptions),
      );
      setConfigThemePreset(
        resolveOptionId(config?.themePreset ?? defaults?.themePreset ?? null, themeOptions),
      );
      setConfigFrontmatter(config?.frontmatter ?? defaults?.frontmatter ?? '');
    },
    [configDefaults, globalPreference, slidesConfig],
  );

  const resetConfigFields = useCallback(() => {
    const defaults = configDefaults;
    const quantityOptions = slidesConfig?.quantityOptions ?? [];
    const audienceOptions = slidesConfig?.audienceOptions ?? [];
    const structureOptions = slidesConfig?.structureOptions ?? [];
    const toneOptions = slidesConfig?.toneOptions ?? [];
    const languageOptions = slidesConfig?.languageOptions ?? [];
    const densityOptions = slidesConfig?.densityOptions ?? [];
    const themeOptions = slidesConfig?.themePresetOptions ?? [];
    setConfigPreference(globalPreference);
    setConfigQuantity(resolveOptionId(defaults?.quantity ?? null, quantityOptions));
    setConfigAudience(resolveOptionId(defaults?.audience ?? null, audienceOptions));
    setConfigStructure(resolveOptionId(defaults?.structure ?? null, structureOptions));
    setConfigTone(resolveOptionId(defaults?.tone ?? null, toneOptions));
    setConfigLanguage(resolveOptionId(defaults?.language ?? null, languageOptions));
    setConfigDensity(resolveOptionId(defaults?.density ?? null, densityOptions));
    setConfigThemePreset(resolveOptionId(defaults?.themePreset ?? null, themeOptions));
    setConfigFrontmatter(defaults?.frontmatter ?? '');
    setShowAdvanced(false);
    setConfigModelId(null);
  }, [configDefaults, globalPreference, slidesConfig]);

  useEffect(() => {
    if (!open || !slidesConfig) return;
    setConfigQuantity(
      (prev) =>
        prev || resolveOptionId(configDefaults?.quantity ?? null, slidesConfig.quantityOptions),
    );
    setConfigAudience(
      (prev) =>
        prev || resolveOptionId(configDefaults?.audience ?? null, slidesConfig.audienceOptions),
    );
    setConfigStructure(
      (prev) =>
        prev || resolveOptionId(configDefaults?.structure ?? null, slidesConfig.structureOptions),
    );
    setConfigTone(
      (prev) => prev || resolveOptionId(configDefaults?.tone ?? null, slidesConfig.toneOptions),
    );
    setConfigLanguage(
      (prev) =>
        prev || resolveOptionId(configDefaults?.language ?? null, slidesConfig.languageOptions),
    );
    setConfigDensity(
      (prev) =>
        prev || resolveOptionId(configDefaults?.density ?? null, slidesConfig.densityOptions),
    );
    setConfigThemePreset(
      (prev) =>
        prev ||
        resolveOptionId(configDefaults?.themePreset ?? null, slidesConfig.themePresetOptions),
    );
    setConfigFrontmatter((prev) => prev || configDefaults?.frontmatter || '');
  }, [configDefaults, open, slidesConfig]);

  const buildGenerationConfig = useCallback((): SlideGenerationConfig => {
    const frontmatter = configFrontmatter.trim();
    const apiPreference = toApiGenerationPreference(configPreference);
    return {
      preference: apiPreference,
      quantity: configQuantity,
      audience: configAudience,
      structure: configStructure,
      tone: configTone,
      language: configLanguage,
      density: configDensity,
      themePreset: configThemePreset,
      frontmatter: frontmatter || undefined,
    };
  }, [
    configAudience,
    configDensity,
    configFrontmatter,
    configLanguage,
    configPreference,
    configQuantity,
    configStructure,
    configThemePreset,
    configTone,
  ]);

  const buildGenerationConfigPayload = useCallback(() => {
    const config = buildGenerationConfig();
    const apiPreference = config.preference;
    return {
      ...(apiPreference ? { preference: apiPreference } : {}),
      quantity: config.quantity,
      audience: config.audience,
      structure: config.structure,
      tone: config.tone,
      language: config.language,
      density: config.density,
      themePreset: config.themePreset,
      frontmatter: config.frontmatter,
    };
  }, [buildGenerationConfig]);

  return {
    configPreference,
    setConfigPreference,
    configQuantity,
    setConfigQuantity,
    configAudience,
    setConfigAudience,
    configStructure,
    setConfigStructure,
    configTone,
    setConfigTone,
    configLanguage,
    setConfigLanguage,
    configDensity,
    setConfigDensity,
    configThemePreset,
    setConfigThemePreset,
    configFrontmatter,
    setConfigFrontmatter,
    showAdvanced,
    setShowAdvanced,
    configModelId,
    setConfigModelId,
    configDefaults,
    selectedThemePreset,
    frontmatterPreview,
    applyGenerationConfig,
    resetConfigFields,
    buildGenerationConfig,
    buildGenerationConfigPayload,
    quantityOptions: slidesConfig?.quantityOptions ?? [],
    structureOptions: slidesConfig?.structureOptions ?? [],
    audienceOptions: slidesConfig?.audienceOptions ?? [],
    toneOptions: slidesConfig?.toneOptions ?? [],
    languageOptions: slidesConfig?.languageOptions ?? [],
    densityOptions: slidesConfig?.densityOptions ?? [],
    themePresetOptions: slidesConfig?.themePresetOptions ?? [],
  };
}
