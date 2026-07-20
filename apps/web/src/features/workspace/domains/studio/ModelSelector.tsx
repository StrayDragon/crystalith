/**
 * ModelSelector - Component for selecting AI models for generation tasks
 */

import type { ModelList, ModelRole } from '@crystalith/shared';
import { Select, Option, Typography, Chip, Alert } from '@material-tailwind/react';
import { CloudQueue as CloudIcon } from '@mui/icons-material';
import { useState, useEffect, useCallback } from 'react';

import { api } from '../../../../api/eden';

export interface ModelSelectorProps {
  /** Currently selected model ID */
  value: string | null;
  /** Callback when selection changes */
  onChange: (modelId: string | null) => void;
  /** Filter by model role (GET /v2/models?role=…) */
  role?: ModelRole;
  /** Label for the selector */
  label?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: 'md' | 'lg';
  /** Full width - handled by className in MT */
  fullWidth?: boolean;
  /** Optional class name */
  className?: string;
}

export function ModelSelector({
  value,
  onChange,
  role = 'chat',
  label = '选择模型',
  disabled = false,
  size = 'md',
  // Ignored in MT Select as it is block by default or controlled by container
  fullWidth: _fullWidth = true,
  className = '',
}: ModelSelectorProps) {
  const [modelsData, setModelsData] = useState<ModelList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch models on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchModels() {
      try {
        setLoading(true);
        setError(null);
        const { data, error: fetchErr } = await api.v2.models.get({
          query: { role },
        });
        if (fetchErr) throw new Error(typeof fetchErr === 'string' ? fetchErr : '加载模型列表失败');
        if (!cancelled) {
          setModelsData(data ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : '加载模型列表失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchModels();
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    if (value) return;
    if (!modelsData) return;

    // defaults.embedding is the default for role `embed` (config key ≠ role enum).
    const defaultModel =
      role === 'embed' ? modelsData.defaults?.embedding : modelsData.defaults?.chat;
    if (defaultModel) onChange(defaultModel);
  }, [role, modelsData, onChange, value]);

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      onChange(newValue || null);
    },
    [onChange],
  );

  // Render loading state
  if (loading) {
    return <div className={`h-10 w-full rounded-lg bg-gray-200 animate-pulse ${className}`} />;
  }

  // Render error state
  if (error) {
    return (
      <Alert color="amber" variant="ghost" className={`py-2 text-xs ${className}`}>
        {error}
      </Alert>
    );
  }

  // No models available
  if (!modelsData || modelsData.models.length === 0) {
    return (
      <Alert color="blue" variant="ghost" className={`py-2 text-xs ${className}`}>
        暂无可用模型
      </Alert>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label ? (
        <Typography variant="small" className="text-gray-600 dark:text-slate-300">
          {label}
        </Typography>
      ) : null}
      <Select
        value={value || ''}
        onChange={(val) => handleChange(val)}
        disabled={disabled}
        size={size}
      >
        {modelsData.models.map((model) => (
          <Option key={model.id} value={model.id}>
            <div className="flex items-center gap-2">
              <Typography className="text-sm font-medium">{model.id}</Typography>
              <Chip
                value={model.provider}
                color="blue"
                variant="ghost"
                size="sm"
                icon={<CloudIcon style={{ fontSize: 14 }} />}
              />
            </div>
          </Option>
        ))}
      </Select>
    </div>
  );
}
