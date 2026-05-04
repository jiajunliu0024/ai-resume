export type ChromeStorageRepository = {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
};

// Thin wrapper around chrome.storage.local.
// Keeping this behind a repository makes it easy to swap storage later.
export const chromeStorageRepository: ChromeStorageRepository = {
  async getItem<T>(key: string): Promise<T | null> {
    // When running outside Chrome extension context, fail gracefully.
    if (!globalThis.chrome?.storage?.local) {
      return null;
    }

    const result = await globalThis.chrome.storage.local.get(key);

    return (result[key] as T | undefined) ?? null;
  },

  async setItem<T>(key: string, value: T): Promise<void> {
    // No-op in non-extension environments such as Vite preview.
    if (!globalThis.chrome?.storage?.local) {
      return;
    }

    await globalThis.chrome.storage.local.set({ [key]: value });
  },

  async removeItem(key: string): Promise<void> {
    // No-op in non-extension environments.
    if (!globalThis.chrome?.storage?.local) {
      return;
    }

    await globalThis.chrome.storage.local.remove(key);
  },
};
