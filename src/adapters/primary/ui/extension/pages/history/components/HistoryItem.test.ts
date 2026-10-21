import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import HistoryItem from './HistoryItem.svelte';

afterEach(cleanup);

test('provides separate native buttons for opening and deleting a history item', async () => {
  const onopen = vi.fn();
  const ondelete = vi.fn();

  const { getByRole } = render(HistoryItem, {
    previewText: 'Hello world',
    formattedDate: '01-02 03:04',
    onopen,
    ondelete,
  });

  const openButton = getByRole('button', { name: 'Hello world 01-02 03:04' });
  const deleteButton = getByRole('button', { name: 'Delete translation' });

  expect(openButton.tagName).toBe('BUTTON');
  expect(deleteButton.closest('button')).toBe(deleteButton);
  expect(openButton.contains(deleteButton)).toBe(false);

  await fireEvent.click(deleteButton);
  expect(ondelete).toHaveBeenCalledOnce();
  expect(onopen).not.toHaveBeenCalled();

  await fireEvent.click(openButton);
  expect(onopen).toHaveBeenCalledOnce();
});
