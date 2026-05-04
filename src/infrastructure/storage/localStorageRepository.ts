export type LocalStorageRepository = {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export const browserLocalStorageRepository: LocalStorageRepository = {
  async getItem<T>(key: string): Promise<T | null> {
    const rawValue = window.localStorage.getItem(key);

    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as T;
  },

  async setItem<T>(key: string, value: T): Promise<void> {
    window.localStorage.setItem(key, JSON.stringify(value));
  },

  async removeItem(key: string): Promise<void> {
    window.localStorage.removeItem(key);
  },
};
