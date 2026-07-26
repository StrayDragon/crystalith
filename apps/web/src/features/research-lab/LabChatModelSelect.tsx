/**
 * Optional chat model select for Lab Compose / retry-synthesize (r454).
 * Empty value = server default (do not auto-pick).
 */
import { useEffect, useState } from 'react';

import { api } from '../../api/eden';

export function LabChatModelSelect(props: {
  value: string | null | undefined;
  onChange: (modelId: string | null) => void;
  className?: string;
  disabled?: boolean;
  'data-testid'?: string;
}) {
  const { value, onChange, className, disabled } = props;
  const [models, setModels] = useState<Array<{ id: string; provider: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    void api.v2.models
      .get({ query: { role: 'chat' } })
      .then((r) => {
        if (cancelled) return;
        if (r.error || !r.data) {
          setModels([]);
          return;
        }
        setModels((r.data.models ?? []).map((m) => ({ id: m.id, provider: m.provider })));
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      className={
        className ??
        'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/25'
      }
      data-testid={props['data-testid']}
    >
      <option value="">默认（服务端）</option>
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.id} · {m.provider}
        </option>
      ))}
    </select>
  );
}
