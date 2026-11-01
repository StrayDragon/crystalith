// covers: r304（studio-output-types）——timeline 事件以时间轴形式可视化，点击展开事件详情，展开后其余事件仍可继续浏览。
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, within } from '@testing-library/react';

import TimelineViewer, { type TimelineEvent } from './TimelineViewer';

const EVENTS: TimelineEvent[] = [
  { date: '2024-03-01', event: '项目启动', description: '确定目标与里程碑。' },
  { date: '2024-04-15', event: '首个版本发布', description: '发布 0.1.0 并收集反馈。' },
  { date: '2024-06-30', event: '开放注册', description: '对外开放账号注册。' },
];

test('renders events as a timeline with spine markers, in order', () => {
  const { container } = render(<TimelineViewer events={EVENTS} />);

  const timeline = container.querySelector<HTMLElement>('.space-y-4');
  expect(timeline).not.toBeNull();

  const rows = within(timeline as HTMLElement).getAllByRole('button');
  expect(rows).toHaveLength(EVENTS.length);

  // 按事件顺序呈现：每行先日期后事件名
  expect(rows[0]).toHaveTextContent('2024-03-01');
  expect(rows[0]).toHaveTextContent('项目启动');
  expect(rows[1]).toHaveTextContent('首个版本发布');
  expect(rows[2]).toHaveTextContent('开放注册');

  // 时间轴形态：每个事件行带圆点标记与竖向连接线
  expect(timeline?.querySelectorAll('span.rounded-full')).toHaveLength(EVENTS.length);
  expect(timeline?.querySelectorAll('span.w-px')).toHaveLength(EVENTS.length);
});

test('expands an event detail on click and collapses it on second click', () => {
  render(<TimelineViewer events={EVENTS} />);

  expect(screen.queryByText('发布 0.1.0 并收集反馈。')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /首个版本发布/ }));
  expect(screen.getByText('发布 0.1.0 并收集反馈。')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /首个版本发布/ }));
  expect(screen.queryByText('发布 0.1.0 并收集反馈。')).not.toBeInTheDocument();
});

test('timeline stays browsable after expanding an event', () => {
  render(<TimelineViewer events={EVENTS} />);

  fireEvent.click(screen.getByRole('button', { name: /项目启动/ }));
  expect(screen.getByText('确定目标与里程碑。')).toBeInTheDocument();

  // 已展开一条详情后，其余事件行仍可见且可继续展开（两条详情同时在场）
  fireEvent.click(screen.getByRole('button', { name: /开放注册/ }));
  expect(screen.getByText('确定目标与里程碑。')).toBeInTheDocument();
  expect(screen.getByText('对外开放账号注册。')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /首个版本发布/ })).toBeInTheDocument();
});
