import "@testing-library/jest-dom/vitest"

// jsdom has no layout engine and does not implement Element.scrollTo, which
// the vendored chat UI kit (src/components/ui/chat) calls on mount to jump
// to the latest message. Polyfilled here rather than in that vendored file.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {}
}
