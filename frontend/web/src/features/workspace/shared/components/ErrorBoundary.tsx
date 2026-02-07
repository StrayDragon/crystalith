import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  onRetry?: () => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  nonce: number;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    nonce: 0,
  };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('ErrorBoundary caught error', error, info);
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      nonce: prev.nonce + 1,
    }));
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      const title = this.props.title ?? '组件加载失败';
      const description =
        this.props.description ?? '请稍后重试，若问题持续请刷新页面。';

      return (
        <div className="m-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="font-semibold">{title}</div>
          <div className="mt-1 text-xs text-red-600">{description}</div>
          <button
            type="button"
            className="mt-3 inline-flex items-center rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
            onClick={this.handleRetry}
          >
            重试
          </button>
        </div>
      );
    }

    return <Fragment key={this.state.nonce}>{this.props.children}</Fragment>;
  }
}
