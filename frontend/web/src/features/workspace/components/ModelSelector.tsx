/**
 * ModelSelector - Component for selecting AI models for generation tasks
 */

import { useState, useEffect, useCallback } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Chip,
  Skeleton,
  Alert,
  type SelectChangeEvent,
} from '@mui/material';
import {
  SmartToy as AIIcon,
  CloudQueue as CloudIcon,
  Computer as LocalIcon,
} from '@mui/icons-material';

import { listModels, type ModelRead, type ModelsListResponse } from '../api';

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
  size?: 'small' | 'medium';
  /** Full width */
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
  size = 'small',
  fullWidth = true,
  className,
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
        const data = await listModels(capability);
        if (!cancelled) {
          setModelsData(data);
          // Set default value if not already set
          if (!value && data.default_chat) {
            onChange(data.default_chat);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载模型列表失败');
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

  const handleChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      const newValue = event.target.value;
      onChange(newValue || null);
    },
    [onChange]
  );

  // Render loading state
  if (loading) {
    return (
      <Box className={className} sx={{ width: fullWidth ? '100%' : 'auto' }}>
        <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Alert severity="warning" sx={{ py: 0.5, fontSize: '0.75rem' }}>
        {error}
      </Alert>
    );
  }

  // No models available
  if (!modelsData || modelsData.models.length === 0) {
    return (
      <Alert severity="info" sx={{ py: 0.5, fontSize: '0.75rem' }}>
        暂无可用模型
      </Alert>
    );
  }

  const models = modelsData.models;
  const selectedModel = models.find((m) => m.id === value);

  return (
    <FormControl
      fullWidth={fullWidth}
      size={size}
      disabled={disabled}
      className={className}
    >
      <InputLabel id="model-selector-label">{label}</InputLabel>
      <Select
        labelId="model-selector-label"
        id="model-selector"
        value={value || ''}
        label={label}
        onChange={handleChange}
        renderValue={(selected) => {
          const model = models.find((m) => m.id === selected);
          if (!model) return selected;
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {model.provider === 'openai' ? (
                <CloudIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              ) : (
                <LocalIcon sx={{ fontSize: 16, color: 'success.main' }} />
              )}
              <Typography variant="body2">{model.display_name}</Typography>
            </Box>
          );
        }}
      >
        {models.map((model) => (
          <MenuItem key={model.id} value={model.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              {model.provider === 'openai' ? (
                <CloudIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              ) : (
                <LocalIcon sx={{ fontSize: 18, color: 'success.main' }} />
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {model.display_name}
                </Typography>
                {model.description && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {model.description}
                  </Typography>
                )}
              </Box>
              <Chip
                label={model.provider}
                size="small"
                variant="outlined"
                sx={{
                  fontSize: '0.65rem',
                  height: 20,
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default ModelSelector;
