import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import TranslateButton from './TranslateButton.svelte';

afterEach(cleanup);

function setup(
  disabled = false,
  isLoading = false,
  shortcutLabel: string | null = null,
) {
  const onclick = vi.fn();
  const onOpenShortcutSettings = vi.fn();

  return {
    ...render(TranslateButton, {
      onclick,
      shortcutLabel,
      onOpenShortcutSettings,
      disabled,
      isLoading,
      shortcutSettingsUrl: 'chrome://extensions/shortcuts',
    }),
    onclick,
    onOpenShortcutSettings,
  };
}

describe('UI: translation shortcut link', () => {
  test('always underlines the link and opens settings without starting translation', async () => {
    const view = setup();
    const link = view.getByRole('link', { name: 'Shortcut not set' });

    expect(link.getAttribute('href')).toBe('chrome://extensions/shortcuts');
    expect(link.classList.contains('underline')).toBe(true);
    expect(link.closest('button')).toBeNull();
    await fireEvent.click(link);
    expect(view.onOpenShortcutSettings).toHaveBeenCalledOnce();
    expect(view.onclick).not.toHaveBeenCalled();
    await fireEvent.click(view.getByRole('button', { name: 'Translate' }));
    expect(view.onclick).toHaveBeenCalledOnce();
  });

  test('keeps shortcut setup accessible when translation is disabled', async () => {
    const view = setup(true);

    expect(view.getByRole('button').hasAttribute('disabled')).toBe(true);
    await fireEvent.click(view.getByRole('link', { name: 'Shortcut not set' }));
    expect(view.onOpenShortcutSettings).toHaveBeenCalledOnce();
    expect(view.onclick).not.toHaveBeenCalled();
  });

  test('shows an assigned shortcut without a setup link', () => {
    const view = setup(false, false, 'Ctrl+Shift+Y');

    expect(view.getByText('(Ctrl+Shift+Y)')).toBeDefined();
    expect(view.queryByRole('link')).toBeNull();
  });

  test('hides the setup link while processing', () => {
    const view = setup(false, true);

    expect(view.getByText('Processing...')).toBeDefined();
    expect(view.queryByRole('link')).toBeNull();
  });
});
