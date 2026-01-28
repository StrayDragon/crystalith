/**
 * ModelSelector - Component for selecting AI models for generation tasks
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Select,
  Option,
  Typography,
  Chip,
  Alert,
} from '@material-tailwind/react';
import {
  SmartToy as AIIcon,
  CloudQueue as CloudIcon,
  Computer as LocalIcon,
} from '@mui/icons-material';

import { listModels, type ModelRead, type ModelsListResponse } from '../../shared/api';
import { LAYER_LEVELS } from '../../../../shared/layer';

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
  fullWidth = true, // Ignored in MT Select as it is block by default or controlled by container
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
    (newValue: string | undefined) => {
      onChange(newValue || null);
    },
    [onChange]
  );

  // Render loading state
  if (loading) {
    return (
      <div className={`h-10 w-full rounded-lg bg-gray-200 animate-pulse ${className}`} />
    );
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

  const models = modelsData.models;

  // Find selected model for rendering custom selected state if needed
  // MT Select handles display automatically based on Option children

  return (
    <div className={className}>
      <Select
        label={label}
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
        size={size}
        menuProps={{
          className: "max-h-60 overflow-y-auto",
          style: { zIndex: LAYER_LEVELS.popover },
        }}
        selected={(element) => {
          // Custom render for selected value
          // element is the React Element of the selected Option
          if (!element) return null;
          const modelId = element.props.value;
          const model = models.find((m) => m.id === modelId);
          if (!model) return element;

          return (
             <div className="flex items-center gap-2">
                {model.provider === 'openai' ? (
                  <CloudIcon className="h-4 w-4 text-blue-500" />
                ) : (
                  <LocalIcon className="h-4 w-4 text-green-500" />
                )}
                <span className="text-sm text-gray-900">{model.display_name}</span>
             </div>
          );
        }}
      >
        {models.map((model) => (
          <Option key={model.id} value={model.id} className="flex items-center gap-2 p-2">
            <div className="flex items-center gap-2 w-full">
              {model.provider === 'openai' ? (
                <CloudIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
              ) : (
                <LocalIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0 flex flex-col">
                <Typography variant="small" className="font-medium text-gray-900 leading-snug">
                  {model.display_name}
                </Typography>
                {model.description && (
                  <Typography
                    variant="small"
                    className="text-[10px] text-gray-500 font-medium truncate"
                  >
                    {model.description}
                  </Typography>
                )}
              </div>
              <Chip
                value={model.provider}
                size="sm"
                variant="outlined"
                className="h-5 px-1.5 text-[10px] font-medium rounded-full normal-case border-gray-200 text-gray-500 flex items-center"
              />
            </div>
          </Option>
        ))}
      </Select>
    </div>
  );
}

export default ModelSelector;
