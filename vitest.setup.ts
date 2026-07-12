import "@testing-library/jest-dom/vitest";

// Polyfill matchMedia for jsdom (required by xterm.js)
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Polyfill ResizeObserver for jsdom (required by xterm.js TerminalEmulator)
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserver {
    constructor(_callback: ResizeObserverCallback) {}
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserver as any;
}

// Polyfill HTMLCanvasElement.getContext for jsdom (required by xterm.js)
if (typeof HTMLCanvasElement !== "undefined") {
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...args: any[]) {
    try {
      return origGetContext.apply(this, args);
    } catch {
      return null as any;
    }
  } as any;
}
