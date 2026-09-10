import { expect, test, rs } from '@rstest/core';
import { render, screen } from '@testing-library/react';

import type { RenderDescriptor } from '../../shared/types';
import GenericOutputRenderer from './GenericOutputRenderer';

test('renders list layout', () => {
  const renderDescriptor: RenderDescriptor = {
    layout: 'list',
    itemSchema: {
      fields: [{ key: 'name', type: 'text', label: 'Name', children: [] }],
    },
    options: { itemsKey: 'items' },
  };

  render(
    <GenericOutputRenderer
      content={{ items: [{ name: 'Alpha' }, { name: 'Beta' }] }}
      renderDescriptor={renderDescriptor}
    />,
  );

  expect(screen.getAllByText('Name')).toHaveLength(2);
  expect(screen.getByText('Alpha')).toBeInTheDocument();
  expect(screen.getByText('Beta')).toBeInTheDocument();
});

test('renders cards layout', () => {
  const renderDescriptor: RenderDescriptor = {
    layout: 'cards',
    itemSchema: {
      fields: [{ key: 'title', type: 'heading', label: 'Title', children: [] }],
    },
    options: { itemsKey: 'items' },
  };

  render(
    <GenericOutputRenderer
      content={{ items: [{ title: 'Card A' }, { title: 'Card B' }] }}
      renderDescriptor={renderDescriptor}
    />,
  );

  expect(screen.getAllByText('Title')).toHaveLength(2);
  expect(screen.getByText('Card A')).toBeInTheDocument();
  expect(screen.getByText('Card B')).toBeInTheDocument();
});

test('renders timeline layout', () => {
  const renderDescriptor: RenderDescriptor = {
    layout: 'timeline',
    itemSchema: {
      fields: [
        { key: 'date', type: 'date', label: 'Date', children: [] },
        { key: 'event', type: 'heading', label: 'Event', children: [] },
        { key: 'description', type: 'text', label: 'Desc', children: [] },
      ],
    },
    options: { itemsKey: 'events' },
  };

  render(
    <GenericOutputRenderer
      content={{
        events: [{ date: '2024', event: 'Launch', description: 'First release' }],
      }}
      renderDescriptor={renderDescriptor}
    />,
  );

  expect(screen.getByText('2024')).toBeInTheDocument();
  expect(screen.getByText('Event')).toBeInTheDocument();
  expect(screen.getByText('Launch')).toBeInTheDocument();
});

test('renders sections layout', () => {
  const renderDescriptor: RenderDescriptor = {
    layout: 'sections',
    itemSchema: {
      fields: [
        { key: 'heading', type: 'heading', label: null, children: [] },
        { key: 'body', type: 'text', label: 'Body', children: [] },
      ],
    },
    options: { itemsKey: 'sections' },
  };

  render(
    <GenericOutputRenderer
      content={{ sections: [{ heading: 'Section 1', body: 'Hello' }] }}
      renderDescriptor={renderDescriptor}
    />,
  );

  expect(screen.getByText('Section 1')).toBeInTheDocument();
  expect(screen.getByText('Body')).toBeInTheDocument();
  expect(screen.getByText('Hello')).toBeInTheDocument();
});

test('renders table layout', () => {
  const renderDescriptor: RenderDescriptor = {
    layout: 'table',
    itemSchema: {
      fields: [
        { key: 'col1', type: 'text', label: 'Col 1', children: [] },
        { key: 'col2', type: 'text', label: 'Col 2', children: [] },
      ],
    },
    options: { itemsKey: 'rows' },
  };

  render(
    <GenericOutputRenderer
      content={{ rows: [{ col1: 'A', col2: 'B' }] }}
      renderDescriptor={renderDescriptor}
    />,
  );

  expect(screen.getByText('Col 1')).toBeInTheDocument();
  expect(screen.getByText('Col 2')).toBeInTheDocument();
  expect(screen.getByText('A')).toBeInTheDocument();
  expect(screen.getByText('B')).toBeInTheDocument();
});

test('renders tree layout', () => {
  const renderDescriptor: RenderDescriptor = {
    layout: 'tree',
    itemSchema: { fields: [] },
    options: { rootKey: 'root', childrenKey: 'children', labelKey: 'label' },
  };

  render(
    <GenericOutputRenderer
      content={{
        root: { label: 'Root', children: [{ label: 'Child', children: [] }] },
      }}
      renderDescriptor={renderDescriptor}
    />,
  );

  expect(screen.getByText('Root')).toBeInTheDocument();
  expect(screen.getByText('Child')).toBeInTheDocument();
});

test('falls back to JSON when renderDescriptor is missing', () => {
  render(<GenericOutputRenderer content={{ x: 1 }} renderDescriptor={null} />);
  expect(screen.getByText(/"x": 1/)).toBeInTheDocument();
});

test('falls back to JSON for unsupported layout and logs warning', () => {
  // Mock reason: silence expected warning output while asserting unsupported layout fallback.
  const warn = rs.spyOn(console, 'warn').mockImplementation(() => {});
  render(
    <GenericOutputRenderer
      content={{ x: 1 }}
      renderDescriptor={
        {
          layout: 'unknown',
          itemSchema: null,
          options: {},
        } as unknown as RenderDescriptor
      }
    />,
  );

  expect(warn).toHaveBeenCalled();
  expect(screen.getByText(/"x": 1/)).toBeInTheDocument();
  warn.mockRestore();
});

test('renders nested FieldDescriptor children', () => {
  const renderDescriptor: RenderDescriptor = {
    layout: 'cards',
    itemSchema: {
      fields: [
        {
          key: 'parent',
          type: 'text',
          label: 'Parent',
          children: [{ key: 'child', type: 'text', label: 'Child', children: [] }],
        },
      ],
    },
    options: { itemsKey: 'items' },
  };

  render(
    <GenericOutputRenderer
      content={{ items: [{ parent: { child: 'Nested value' } }] }}
      renderDescriptor={renderDescriptor}
    />,
  );

  expect(screen.getByText('Parent')).toBeInTheDocument();
  expect(screen.getByText('Child')).toBeInTheDocument();
  expect(screen.getByText('Nested value')).toBeInTheDocument();
});
