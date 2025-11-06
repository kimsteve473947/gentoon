/**
 * 🔥 CRITICAL: Global browser API polyfills for Node.js environment
 * This must run before any Supabase code is loaded
 */
if (typeof self === 'undefined') {
  global.self = global;
}

if (typeof window === 'undefined') {
  global.window = global;
}

if (typeof document === 'undefined') {
  // Create a more complete document mock with all necessary properties
  const mockElement = {
    addEventListener: () => {},
    removeEventListener: () => {},
    appendChild: () => mockElement,
    removeChild: () => mockElement,
    setAttribute: () => {},
    getAttribute: () => null,
    hasAttribute: () => false,
    removeAttribute: () => {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: {},
    children: [],
    childNodes: [],
    parentNode: null,
    firstChild: null,
    lastChild: null,
    nextSibling: null,
    previousSibling: null,
    textContent: '',
    innerHTML: '',
  };

  global.document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    getElementsByClassName: () => [],
    getElementsByTagName: () => [],
    getElementsByName: () => [],
    createElement: () => mockElement,
    createTextNode: () => mockElement,
    createDocumentFragment: () => mockElement,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    body: mockElement,
    head: mockElement,
    documentElement: mockElement,
    defaultView: null,
    styleSheets: [],
    scripts: [],
    images: [],
    forms: [],
    links: [],
    cookie: '',
    domain: 'localhost',
    referrer: '',
    URL: 'https://localhost',
    baseURI: 'https://localhost',
    readyState: 'complete',
  };
}

if (typeof navigator === 'undefined') {
  global.navigator = { userAgent: 'node' };
}

if (typeof location === 'undefined') {
  global.location = { href: '', origin: '', protocol: 'https:', hostname: 'localhost' };
}
