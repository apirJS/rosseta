export type LoginView = 'main' | 'api-key';

export class LoginState {
  currentView = $state<LoginView>('main');
  apiKeyInput = $state('');
}

export function createLoginController() {
  const state = new LoginState();

  function showApiKeyInput() {
    state.currentView = 'api-key';
  }

  function showMain() {
    state.currentView = 'main';
    state.apiKeyInput = '';
  }

  function setApiKeyInput(value: string) {
    state.apiKeyInput = value;
  }

  return {
    state,
    showApiKeyInput,
    showMain,
    setApiKeyInput,
  };
}
