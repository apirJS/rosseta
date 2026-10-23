import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import DescriptionSection from './DescriptionSection.svelte';

afterEach(cleanup);

describe('UI: Markdown description', () => {
  test('renders formatted descriptions with semantic Markdown elements', () => {
    const { container, getByRole, getByText } = render(DescriptionSection, {
      text: [
        '# Context',
        '',
        'A **clear** and *natural* explanation of `term`.',
        '',
        '- First detail',
        '- Second detail',
        '',
        '1. Read the title',
        '2. Read the caption',
        '',
        '| Text | Meaning |',
        '| --- | --- |',
        '| Title | Song name |',
        '',
        '```text',
        'A quoted example',
        '```',
      ].join('\n'),
    });

    expect(getByRole('heading', { name: 'Context', level: 1 })).toBeTruthy();
    expect(getByRole('heading').hasAttribute('id')).toBe(false);
    expect(getByText('clear').tagName).toBe('STRONG');
    expect(getByText('natural').tagName).toBe('EM');
    expect(getByText('term').tagName).toBe('CODE');
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.querySelectorAll('ul > li')).toHaveLength(2);
    expect(container.querySelectorAll('ol > li')).toHaveLength(2);
    expect(getByRole('table')).toBeTruthy();
    expect(getByRole('columnheader', { name: 'Meaning' })).toBeTruthy();
    expect(getByRole('cell', { name: 'Song name' })).toBeTruthy();

    expect(container.querySelector('pre > code')?.textContent).toContain(
      'A quoted example',
    );
  });

  test('continues to display saved plain-text descriptions', () => {
    const text =
      'This image contains a title and a short caption. No formatting is needed.';

    const { container, getByText } = render(DescriptionSection, { text });

    expect(getByText(text).tagName).toBe('P');

    expect(container.querySelector('.description-text')?.textContent).toBe(
      text,
    );
  });

  test('displays HTML as text without creating active HTML elements', () => {
    const { container } = render(DescriptionSection, {
      text: [
        '<script>alert("unsafe")</script>',
        '',
        '<img src="https://example.com/pixel.png" onerror="alert(1)">',
        '',
        '<a href="https://example.com" onclick="alert(1)">HTML link</a>',
        '',
        '<iframe src="https://example.com"></iframe>',
        '',
        '<style>body { display: none; }</style>',
      ].join('\n'),
    });

    expect(container.textContent).toContain('HTML link');
    expect(container.textContent).toContain('alert("unsafe")');
    expect(container.textContent).toContain('<img');
    expect(container.querySelector('script, img, a, iframe, style')).toBeNull();
    expect(container.querySelector('[onclick], [onerror]')).toBeNull();
  });

  test.each([
    'javascript:alert%281%29',
    'data:text/html;base64,PHNjcmlwdD4=',
    'file:///private.txt',
    '/relative',
    '../relative',
    '#page-heading',
    '//example.com/page',
    'mailto:person@example.com',
    'tel:12345',
  ])('keeps a disallowed destination as readable text: %s', (destination) => {
    const { container, getByText } = render(DescriptionSection, {
      text: `[Readable label](${destination})`,
    });

    expect(getByText('Readable label')).toBeTruthy();
    expect(container.querySelector('a')).toBeNull();
  });

  test('opens HTTP and HTTPS links separately with safe link attributes', () => {
    const { getByRole } = render(DescriptionSection, {
      text: '[Guide](https://example.com/guide "More details") and [Reference](http://example.com/reference).',
    });

    const guide = getByRole('link', { name: 'Guide' });
    const reference = getByRole('link', { name: 'Reference' });

    expect(guide.getAttribute('href')).toBe('https://example.com/guide');
    expect(guide.getAttribute('title')).toBe('More details');
    expect(reference.getAttribute('href')).toBe('http://example.com/reference');

    for (const link of [guide, reference]) {
      expect(link.getAttribute('target')).toBe('_blank');

      expect(link.getAttribute('rel')?.split(' ')).toEqual(
        expect.arrayContaining(['noopener', 'noreferrer']),
      );
    }
  });

  test('shows Markdown image text without loading the image', () => {
    const { container, getByText } = render(DescriptionSection, {
      text: 'Details: ![A helpful diagram](https://example.com/pixel.png "Remote image")',
    });

    expect(getByText('A helpful diagram')).toBeTruthy();
    expect(container.querySelector('img, picture, source')).toBeNull();
  });

  test('updates unfinished Markdown and clears replaced content without losing a resized box', async () => {
    const { container, rerender } = render(DescriptionSection, {
      text: 'Context **impor',
    });

    const box = container.querySelector<HTMLElement>('.description-box')!;

    box.style.height = '173px';
    expect(box.textContent).toContain('impor');

    await rerender({ text: 'Context **important**\n\n- First detail' });

    await waitFor(() => {
      expect(box.querySelector('strong')?.textContent).toBe('important');
      expect(box.querySelectorAll('li')).toHaveLength(1);
    });

    await rerender({
      text: 'Context **important**\n\n- First detail\n- Second detail',
    });

    await waitFor(() => expect(box.querySelectorAll('li')).toHaveLength(2));
    await rerender({ text: 'Replacement *only*' });
    expect(box.querySelector('em')?.textContent).toBe('only');
    expect(box.textContent).not.toContain('important');
    expect(box.querySelector('li')).toBeNull();

    await rerender({ text: '' });
    expect(box.textContent).toBe('');
    expect(container.querySelector('.description-box')).toBe(box);
    expect(box.style.height).toBe('173px');
  });
});
