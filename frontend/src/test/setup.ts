import "@testing-library/jest-dom/vitest";

// jsdom is missing a few browser APIs the app touches (file downloads,
// scroll-into-view, matchMedia). Shim them so component tests don't crash.
// Guarded on `window` so node-environment logic tests are left untouched.
if (typeof window !== "undefined") {
  // jsdom's localStorage is incomplete under this Vitest config (no clear()).
  // Install a complete in-memory implementation.
  const store = new Map<string, string>();
  const localStorageMock = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
  } as unknown as Storage;
  Object.defineProperty(window, "localStorage", { value: localStorageMock, configurable: true });

  if (typeof URL.createObjectURL !== "function") {
    URL.createObjectURL = () => "blob:mock";
  }
  if (typeof URL.revokeObjectURL !== "function") {
    URL.revokeObjectURL = () => {};
  }
  if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = () => {};
  }
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
}
