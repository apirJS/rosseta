import { describe, expect, test } from 'vitest';
import { createLoginController } from './LoginController.svelte';

describe('UI Controller: LoginController', () => {
  test('initial state has empty apiKeyInput and "main" view', () => {
    const controller = createLoginController();

    expect(controller.state.apiKeyInput).toBe('');
    expect(controller.state.currentView).toBe('main');
  });

  test('showApiKeyInput switches view to "api-key"', () => {
    const controller = createLoginController();

    controller.showApiKeyInput();

    expect(controller.state.currentView).toBe('api-key');
  });

  test('showMain resets view to "main" and clears apiKeyInput', () => {
    const controller = createLoginController();

    // Setup: navigate away and type something
    controller.showApiKeyInput();
    controller.setApiKeyInput('sk-test-key-123');
    expect(controller.state.currentView).toBe('api-key');
    expect(controller.state.apiKeyInput).toBe('sk-test-key-123');

    // Act
    controller.showMain();

    // Assert: both reset
    expect(controller.state.currentView).toBe('main');
    expect(controller.state.apiKeyInput).toBe('');
  });

  test('setApiKeyInput updates the apiKeyInput value', () => {
    const controller = createLoginController();

    controller.setApiKeyInput('AIza-fake-key');

    expect(controller.state.apiKeyInput).toBe('AIza-fake-key');
  });

  test('setApiKeyInput can be called multiple times, last value wins', () => {
    const controller = createLoginController();

    controller.setApiKeyInput('first');
    controller.setApiKeyInput('second');
    controller.setApiKeyInput('third');

    expect(controller.state.apiKeyInput).toBe('third');
  });

  test('view transitions are idempotent', () => {
    const controller = createLoginController();

    controller.showApiKeyInput();
    controller.showApiKeyInput();
    expect(controller.state.currentView).toBe('api-key');

    controller.showMain();
    controller.showMain();
    expect(controller.state.currentView).toBe('main');
  });
});
