import type { ComponentProps } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import WorkspaceOnboardingBanner from "./WorkspaceOnboardingBanner";
import type { WorkspaceReadiness } from "../hooks/useWorkspaceReadiness";

beforeEach(() => {
  window.localStorage.clear();
});

function renderBanner(
  readiness: WorkspaceReadiness,
  showReadyGuide = true,
  overrides: Partial<ComponentProps<typeof WorkspaceOnboardingBanner>> = {},
) {
  const props = {
    readiness,
    showReadyGuide,
    onRetryConnection: vi.fn(),
    onOpenDiagnostics: vi.fn(),
    onOpenDeploymentDocs: vi.fn(),
    onCreateNotebook: vi.fn(),
    onUploadSources: vi.fn(),
    onAddSourceFromUrl: vi.fn(),
    onFocusSourceSearch: vi.fn(),
    onStartSession: vi.fn(),
    onFocusChat: vi.fn(),
    onOpenSlidesStudio: vi.fn(),
    slidesAvailable: true,
    slidesRecoveryHint: null,
    onRecoverSlides: vi.fn(),
    onOpenCommandPalette: vi.fn(),
    onOpenShortcutHelp: vi.fn(),
    ...overrides,
  };
  const view = render(<WorkspaceOnboardingBanner {...props} />);
  return { ...view, props };
}

test('renders "no sources" onboarding with CTAs and can be dismissed', () => {
  const { props } = renderBanner({ kind: "no_sources", notebookId: 1 });

  expect(screen.getByLabelText("Workspace 引导提示")).toBeInTheDocument();
  expect(screen.getByText("导入一些来源")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "上传文件" }));
  expect(props.onUploadSources).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "从 URL 导入" }));
  expect(props.onAddSourceFromUrl).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "搜索导入" }));
  expect(props.onFocusSourceSearch).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "关闭引导提示" }));
  expect(screen.queryByLabelText("Workspace 引导提示")).toBeNull();
});

test("does not render ready guide when showReadyGuide=false", () => {
  renderBanner({ kind: "ready", notebookId: 1 }, false);
  expect(screen.queryByLabelText("Workspace 引导提示")).toBeNull();
});

test("renders not connected guide without dismiss button", () => {
  renderBanner({ kind: "not_connected", connectionState: "error", error: "nope" });

  expect(screen.getByLabelText("Workspace 引导提示")).toBeInTheDocument();
  expect(screen.getByText("后端连接失败")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "关闭引导提示" })).toBeNull();
});

test("renders slides recovery CTA when slides tool is unavailable", () => {
  const { props } = renderBanner({ kind: "ready", notebookId: 1 }, true, {
    slidesAvailable: false,
    slidesRecoveryHint: "pip install crystalith[official-slides]",
  });

  expect(screen.queryByRole("button", { name: "生成 Slides" })).toBeNull();
  expect(screen.getByText("pip install crystalith[official-slides]")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "查看 Slides 指引" }));
  expect(props.onRecoverSlides).toHaveBeenCalledTimes(1);
});
