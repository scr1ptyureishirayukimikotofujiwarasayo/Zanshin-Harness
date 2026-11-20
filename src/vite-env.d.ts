/// <reference types="vite/client" />

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface Window {
  zanshinDesktop?: {
    isDesktop: true;
    platform: string;
    chooseWorkspace(): Promise<string | null>;
    chat(model: string, messages: OllamaMessage[]): Promise<{ content: string } | { error: string }>;
  };
}
