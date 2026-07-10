/**
 * ModelSelector - Component for selecting AI models for generation tasks
 */

import { Select, Option, Typography, Chip, Alert } from '@material-tailwind/react';
import { CloudQueue as CloudIcon, Computer as LocalIcon } from '@mui/icons-material';
import { useState, useEffect, useCallback, type ReactElement } from 'react';

import { api } from '../../../../api/eden';
import { LAYER_LEVELS } from '../../../../shared/layer';

interface ModelsListResponse {
  models: Array<{ id: string; name: string; provider: string; capabilities: string[] }>;
  default_chat?: string | null;
  default_embedding?: string | null;
}

export interface ModelSelectorProps {
  /** Currently selected model ID */
  value: string | null;
  /** Callback when selection changes */
  onChange: (modelId: string | null) => void;
  /** Filter by capability */
  capability?: 'chat' | 'embedding';
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
  capability = 'chat',
  label = '选择模型',
  disabled = false,
  size = 'md',
  fullWidth: _fullWidth = true, // Ignored in MT Select as it is block by default or controlled by container
  className = '',
}: ModelSelectorProps) {
  const [modelsData, setModelsData] = useState<ModelsListResponse | null>(null);
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
          query: capability ? { capability } : undefined,
        });
        if (fetchErr) throw fetchErr;
        if (!cancelled) {
          setModelsData(
            data as unknown as ModelsListResponse,
          );
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

    fetchModels();
    return () => {
      cancelled = true;
    };
  }, [capability]);

  useEffect(() => {
    if (value) return;
    if (!modelsData) return;

    const defaultModel =
      capability === 'embedding' ? modelsData.default_embedding : modelsData.default_chat;
    if (defaultModel) onChange(defaultModel);
  }, [capability, modelsData, onChange, value]);

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

  // Extract model IDs from the models array
  const modelIds = modelsData.models.map((model) => model.id);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label ? (
        <Typography variant="small" className="text-gray-600 dark:text-slate-300">
          {label}
        </Typography>
      ) : null}
      <Select
        value={value || ''}
        onChange={(val) => handleChange(val as string)}
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
