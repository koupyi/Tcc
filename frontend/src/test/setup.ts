import "@testing-library/jest-dom";

// jsdom has no IntersectionObserver — needed by framer-motion's `whileInView` (used by ProductCard).
class MockIntersectionObserver {
  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
  takeRecords = () => [];
}
// @ts-expect-error — test-only polyfill, not a spec-accurate implementation
window.IntersectionObserver = MockIntersectionObserver;
// @ts-expect-error — same as above, for code that references the global directly
global.IntersectionObserver = MockIntersectionObserver;

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
    dispatchEvent: () => {},
  }),
});
