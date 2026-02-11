/**
 * Node/serverless polyfill for DOMMatrix (used by pdfjs-dist inside pdf-parse).
 * Must be imported before any code that loads pdf-parse.
 */
if (typeof globalThis.DOMMatrix === 'undefined') {
  const g = globalThis as unknown as { DOMMatrix: unknown }
  g.DOMMatrix = class DOMMatrix {
    a = 1
    b = 0
    c = 0
    d = 1
    e = 0
    f = 0
    constructor(_init?: string | number[]) {}
    multiply() { return this }
    translate() { return this }
    scale() { return this }
    invertSelf() { return this }
    transformPoint() { return { x: 0, y: 0 } }
  }
}
