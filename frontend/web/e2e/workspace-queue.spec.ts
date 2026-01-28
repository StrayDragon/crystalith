import { test, expect } from '@playwright/test';

const baseNotebook = {
  id: 1,
  name: 'Demo Notebook',
  updated_at: '2026-01-01T00:00:00Z',
};

const slidesConfigResponse = {
  defaults: {
    quantity: 'standard',
    audience: 'general',
    structure: 'standard',
    tone: 'professional',
    language: 'zh',
    density: 'standard',
    theme_preset: 'minimal-clean',
    frontmatter: '',
  },
  quantity_options: [
    { id: 'short', label: '精简', is_default: false },
    { id: 'standard', label: '标准', is_default: true },
  ],
  audience_options: [{ id: 'general', label: '通用受众', is_default: true }],
  structure_options: [{ id: 'standard', label: '通用结构', is_default: true }],
  tone_options: [{ id: 'professional', label: '正式专业', is_default: true }],
  language_options: [{ id: 'zh', label: '中文', is_default: true }],
  density_options: [{ id: 'standard', label: '标准', is_default: true }],
  theme_preset_options: [
    {
      id: 'minimal-clean',
      label: '清爽极简',
      template: { theme: 'default', transition: 'fade', background: '#fff' },
    },
  ],
};

const workspaceToolsResponse = {
  tools: [
    {
      id: 'slides',
      label: '演示',
      description: '演示文稿',
      tone: 'slate',
      output_type: 'SLIDES',
      prompt: '生成演示大纲与 Slidev Markdown。',
      enabled: true,
    },
  ],
};

const modelsResponse = {
  models: [
    {
      id: 'test-chat',
      provider: 'openai',
      model: 'gpt',
      display_name: '测试模型',
      description: '测试模型',
      capabilities: ['chat'],
    },
  ],
  default_chat: 'test-chat',
  default_embedding: null,
};

const extractorsResponse = {
  extractors: [],
  default_extractor: null,
  fallback_enabled: false,
};

async function mockWorkspaceApi(page) {
  await page.route('**/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/v1/notebooks' && method === 'GET') {
      return route.fulfill({ json: [baseNotebook] });
    }

    if (path === '/v1/workspace/tools' && method === 'GET') {
      return route.fulfill({ json: workspaceToolsResponse });
    }

    if (path === '/v1/workspace/tools/slides/config' && method === 'GET') {
      return route.fulfill({ json: slidesConfigResponse });
    }

    if (path === '/v1/models' && method === 'GET') {
      return route.fulfill({ json: modelsResponse });
    }

    if (path === `/v1/notebooks/${baseNotebook.id}/sources` && method === 'GET') {
      return route.fulfill({ json: [] });
    }

    if (path === `/v1/notebooks/${baseNotebook.id}/sources/extractors` && method === 'GET') {
      return route.fulfill({ json: extractorsResponse });
    }

    if (path === `/v1/notebooks/${baseNotebook.id}/sessions` && method === 'GET') {
      return route.fulfill({ json: [] });
    }

    if (path === `/v1/notebooks/${baseNotebook.id}/outputs` && method === 'GET') {
      return route.fulfill({ json: [] });
    }

    if (path === `/v1/notebooks/${baseNotebook.id}/sources/search` && method === 'POST') {
      let body: any = null;
      try {
        body = request.postDataJSON();
      } catch {
        body = null;
      }
      const query = body?.query ?? 'search';
      const engine = body?.engine ?? 'Web';
      const mode = body?.mode ?? 'Fast Research';
      return route.fulfill({
        json: {
          status: 'ok',
          query,
          engine,
          mode,
          results: [
            {
              title: `${query} 结果`,
              url: 'https://example.com/result',
              snippet: '示例摘要',
              source: 'mock',
            },
          ],
          message: '',
          created_at: '2026-01-01T00:00:00Z',
        },
      });
    }

    return route.fulfill({ status: 404, body: 'Not mocked' });
  });
}

test('slides config loads and preview matches template', async ({ page }) => {
  await mockWorkspaceApi(page);
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();

  await page.getByRole('button', { name: '演示' }).first().click();
  await expect(page.getByText('演示生成')).toBeVisible();

  await page.getByRole('button', { name: '高级设置' }).click();
  await expect(page.getByText(/transition: "fade"/)).toBeVisible();
});

test('search queue displays results', async ({ page }) => {
  await mockWorkspaceApi(page);
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();

  const searchInput = page.getByPlaceholder('在网络中搜索新来源');
  await searchInput.fill('OpenAI');
  await searchInput.press('Enter');

  const queueHeader = page.getByRole('button', { name: /OpenAI/ });
  await expect(queueHeader).toBeVisible();
  await queueHeader.click();

  await expect(page.getByText('OpenAI 结果')).toBeVisible();
});
