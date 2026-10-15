import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

type WrapperProps = { children: ReactNode };

export function renderHook<T>(
  hook: () => T,
  options?: { wrapper?: (props: WrapperProps) => ReactNode },
) {
  const result = { current: null as T | null };

  function HookHarness() {
    result.current = hook();
    return null;
  }

  const Wrapper = options?.wrapper ?? (({ children }: WrapperProps) => <>{children}</>);
  const renderResult = render(
    <Wrapper>
      <HookHarness />
    </Wrapper>,
  );

  return {
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- 测试工具：泛型穿透
    result: result as { current: T },
    rerender: renderResult.rerender,
    unmount: renderResult.unmount,
  };
}
