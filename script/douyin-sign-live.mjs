import { createHash, randomFillSync, randomUUID } from 'node:crypto';
import vm from 'node:vm';

export const BDMS_VERSION = '1.0.1.19-fix.01';
export const BDMS_URL =
  'https://p-pc-weboff.byteimg.com/tos-cn-i-9r5gewecjs/bdms_1.0.1.19_fix.js';
export const BDMS_SHA256 =
  'a0e46f84476d63a1fa57bdcb47223e0e545c6ce0c3dacdd2818180dfa087909e';

export const WEB_SIGN_SALT = 'A96D855A08C0A9707F8BEF0D9A527E4E';

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/153.0.0.0 Safari/537.36';

const DEFAULT_BDMS_OPTIONS = Object.freeze({
  aid: 6383,
  pageId: 6241,
  paths: [
    '^/webcast/',
    '^/aweme/v1/',
    '^/aweme/v2/',
    '/douplus/',
    '^/api/ad/v1/inspire',
    '/v1/message/send',
    '^/live/',
    '^/captcha/',
    '^/ecom/',
    '^/luna/pc',
  ],
  boe: false,
  ddrt: 8.5,
  ic: 8.5,
});

const DEFAULT_FINGERPRINT = Object.freeze({
  userAgent: DEFAULT_USER_AGENT,
  platform: 'MacIntel',
  language: 'zh-CN',
  languages: ['zh-CN', 'zh'],
  hardwareConcurrency: 14,
  deviceMemory: 32,
  screenWidth: 1728,
  screenHeight: 1117,
  innerWidth: 1728,
  innerHeight: 1117,
  outerWidth: 1728,
  outerHeight: 1117,
  availWidth: 1728,
  availHeight: 1117,
  colorDepth: 24,
});

export function getSimulatedEnvironmentInfo(fingerprint = {}) {
  const fp = { ...DEFAULT_FINGERPRINT, ...fingerprint };
  return {
    sdk: {
      name: 'BDMS',
      version: BDMS_VERSION,
      sourceUrl: BDMS_URL,
      sha256: BDMS_SHA256,
      init: DEFAULT_BDMS_OPTIONS,
    },
    window: {
      tag: '[object Window]',
      innerWidth: fp.innerWidth,
      innerHeight: fp.innerHeight,
      outerWidth: fp.outerWidth,
      outerHeight: fp.outerHeight,
      devicePixelRatio: 2,
      isSecureContext: true,
      aliases: ['window', 'self', 'globalThis', 'top', 'parent', 'frames'],
    },
    navigator: {
      tag: '[object Navigator]',
      userAgent: fp.userAgent,
      platform: fp.platform,
      language: fp.language,
      languages: fp.languages,
      hardwareConcurrency: fp.hardwareConcurrency,
      deviceMemory: fp.deviceMemory,
      cookieEnabled: true,
      maxTouchPoints: 0,
      onLine: true,
      product: 'Gecko',
      productSub: '20030107',
      vendor: 'Google Inc.',
      vendorSub: '',
      webdriver: false,
      plugins: {
        tag: '[object PluginArray]',
        length: 0,
      },
      storage: '[object StorageManager]',
      pemrissions: null,
      vendorSubs: null,
    },
    screen: {
      tag: '[object Screen]',
      width: fp.screenWidth,
      height: fp.screenHeight,
      availWidth: fp.availWidth,
      availHeight: fp.availHeight,
      colorDepth: fp.colorDepth,
      pixelDepth: fp.colorDepth,
      availLeft: 0,
      availTop: 0,
      isExtended: false,
      orientation: {
        angle: 0,
        type: 'landscape-primary',
      },
    },
    document: {
      tag: '[object HTMLDocument]',
      URL: 'https://www.douyin.com/',
      referrer: '',
      charset: 'utf-8',
      characterSet: 'UTF-8',
      readyState: 'complete',
      hidden: false,
      visibilityState: 'visible',
      cookie: 'caller-provided; redacted; not read by current a_bogus calculation',
      all: {
        tag: '[object HTMLAllCollection]',
        chromiumSemantics: {
          typeof: 'undefined',
          boolean: false,
          looselyEqualsNull: true,
          strictlyEqualsUndefined: false,
        },
        implementation: 'HTMLDDA comparison opcode compatibility patch',
      },
      canvas: {
        tag: '[object HTMLCanvasElement]',
        width: 300,
        height: 150,
        context: null,
        toDataURL: 'data:image/png;base64,',
        nativeMethodAppearance: true,
      },
    },
    location: {
      tag: '[object Location]',
      href: 'https://www.douyin.com/',
      origin: 'https://www.douyin.com',
      protocol: 'https:',
      host: 'www.douyin.com',
      hostname: 'www.douyin.com',
      port: '',
      pathname: '/',
      search: '',
      hash: '',
    },
    history: {
      tag: '[object History]',
      length: 1,
      state: null,
    },
    storage: {
      localStorage: {
        tag: '[object Storage]',
        defaultEntries: {},
        optionalReadKey: 'xmst',
      },
      sessionStorage: {
        tag: '[object Storage]',
        defaultEntries: {},
      },
    },
    timing: {
      performanceNow: 'monotonic clock starting near 5000ms',
      requestAnimationFrame: 'uses the same monotonic clock',
      timeOrigin: 'current process wall-clock time',
    },
    request: {
      method: 'GET',
      origin: 'https://www.douyin.com',
      cookieRole: 'HTTP authentication only; not a direct BDMS input',
      headerRole:
        'request headers are set after a_bogus is generated; navigator fields are fingerprint inputs',
      signedUrlInputs: ['ordered query string', 'navigator/browser fingerprint', 'time', 'randomness'],
    },
  };
}

let cachedOfficialSource;

class EventTargetShim {
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }
}

function markNativeFunction(fn, name = fn.name) {
  Object.defineProperty(fn, 'toString', {
    configurable: true,
    value: () => `function ${name}() { [native code] }`,
  });
  return fn;
}

class HTMLDocumentShim extends EventTargetShim {}
Object.defineProperty(HTMLDocumentShim.prototype, Symbol.toStringTag, {
  value: 'HTMLDocument',
});

class WindowShim extends EventTargetShim {}
Object.defineProperty(WindowShim.prototype, Symbol.toStringTag, {
  value: 'Window',
});

class HistoryShim {
  constructor() {
    this.length = 1;
    this.state = null;
  }

  pushState() {}
  replaceState() {}
}
Object.defineProperty(HistoryShim.prototype, Symbol.toStringTag, {
  value: 'History',
});

class LocationShim {
  assign() {}
  reload() {}

  toString() {
    return this.href;
  }

  valueOf() {
    return this;
  }
}
Object.defineProperty(LocationShim.prototype, Symbol.toStringTag, {
  value: 'Location',
});

class StorageShim {
  constructor(initialValues = {}) {
    this._values = new Map(
      Object.entries(initialValues).map(([key, value]) => [String(key), String(value)]),
    );
  }

  get length() {
    return this._values.size;
  }

  clear() {
    this._values.clear();
  }

  getItem(key) {
    key = String(key);
    return this._values.has(key) ? this._values.get(key) : null;
  }

  key(index) {
    return [...this._values.keys()][index] ?? null;
  }

  removeItem(key) {
    this._values.delete(String(key));
  }

  setItem(key, value) {
    this._values.set(String(key), String(value));
  }
}
Object.defineProperty(StorageShim.prototype, Symbol.toStringTag, {
  value: 'Storage',
});

class PluginArrayShim {
  constructor() {
    Object.defineProperty(this, 'length', { value: 0 });
  }

  item() {
    return null;
  }

  namedItem() {
    return null;
  }

  refresh() {}
}
Object.defineProperty(PluginArrayShim.prototype, Symbol.toStringTag, {
  value: 'PluginArray',
});

class HTMLCanvasElementShim extends EventTargetShim {
  constructor() {
    super();
    this.height = 150;
    this.style = {};
    this.width = 300;
  }

  getContext() {
    return null;
  }

  toDataURL() {
    return 'data:image/png;base64,';
  }
}
Object.defineProperty(HTMLCanvasElementShim.prototype, Symbol.toStringTag, {
  value: 'HTMLCanvasElement',
});
markNativeFunction(HTMLCanvasElementShim.prototype.toDataURL, 'toDataURL');

class HTMLAllCollectionShim {}
Object.defineProperty(HTMLAllCollectionShim.prototype, Symbol.toStringTag, {
  value: 'HTMLAllCollection',
});

function makeStorage(initialValues = {}) {
  return new StorageShim(initialValues);
}

function makeDocument(cookie = '') {
  const document = new HTMLDocumentShim();
  const all = Object.create(HTMLAllCollectionShim.prototype);
  Object.defineProperty(all, '__isHTMLDDA', { value: true });
  Object.assign(document, {
    // This cannot be fully falsy like Chromium's exotic HTMLDDA object, but
    // preserving its prototype and string tag lets BDMS collect the expected
    // HTMLAllCollection fingerprint fields.
    all,
    body: Object.assign(new EventTargetShim(), {
      style: {},
      appendChild() {},
      getAttribute() {
        return null;
      },
    }),
    charset: 'utf-8',
    characterSet: 'UTF-8',
    cookie,
    documentElement: Object.assign(new EventTargetShim(), {
      style: {},
      getAttribute() {
        return null;
      },
    }),
    head: Object.assign(new EventTargetShim(), { appendChild() {} }),
    hidden: false,
    readyState: 'complete',
    referrer: '',
    title: '',
    URL: 'https://www.douyin.com/',
    visibilityState: 'visible',
    createElement(tag) {
      if (String(tag).toLowerCase() === 'canvas') {
        return new HTMLCanvasElementShim();
      }
      return Object.assign(new EventTargetShim(), {
        tagName: String(tag || '').toUpperCase(),
        style: {},
        width: 0,
        height: 0,
        appendChild() {},
        getAttribute() {
          return null;
        },
        getContext() {
          return null;
        },
        removeChild() {},
        setAttribute() {},
      });
    },
    createEvent() {
      return { initEvent() {}, initCustomEvent() {} };
    },
    createTextNode() {
      return { data: '' };
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  });
  markNativeFunction(document.createElement, 'createElement');
  return document;
}

function makeSandbox({
  cookie = '',
  fingerprint = {},
  localStorageValues = {},
  traceAccess,
  traceBytecode,
  traceReturn,
} = {}) {
  const fp = { ...DEFAULT_FINGERPRINT, ...fingerprint };
  const NativeError = Error;
  const monotonicStartedAt = globalThis.performance.now();
  const monotonicBase = 5_000;
  const monotonicNow = () =>
    monotonicBase + globalThis.performance.now() - monotonicStartedAt;

  function BrowserError(...args) {
    const error = new NativeError(...args);
    Object.defineProperty(error, 'stack', {
      configurable: true,
      enumerable: false,
      value:
        `${error.name}${error.message ? `: ${error.message}` : ''}\n` +
        '    at d (<anonymous>:7029:37)\n' +
        '    at X (<anonymous>:6962:13)\n' +
        '    at XMLHttpRequest.n [as send] (<anonymous>:6943:18)',
      writable: true,
    });
    return error;
  }
  BrowserError.prototype = NativeError.prototype;

  class XMLHttpRequestShim extends EventTargetShim {
    static DONE = 4;

    constructor() {
      super();
      this._body = null;
      this._headers = {};
      this._method = 'GET';
      this._url = '';
      this.readyState = 0;
      this.responseText = '{}';
      this.status = 200;
      this.upload = new EventTargetShim();
    }

    abort() {}

    getAllResponseHeaders() {
      return '';
    }

    getResponseHeader() {
      return null;
    }

    open(method, url, async = true) {
      traceAccess?.(`xhr.open.before ${String(method).toUpperCase()} ${String(url)}`);
      this._method = String(method).toUpperCase();
      this._url = String(url);
      this._async = async;
      traceAccess?.(`xhr.open.after ${this._method} ${this._url}`);
    }

    overrideMimeType() {}

    send(body) {
      traceAccess?.(`xhr.send.before ${this._url}`);
      this._body = body;
      this.readyState = XMLHttpRequestShim.DONE;
      this.onreadystatechange?.();
      this.onload?.();
      this.onloadend?.();
      traceAccess?.(`xhr.send.after ${this._url}`);
    }

    setRequestHeader(name, value) {
      traceAccess?.(`xhr.header ${String(name)}: ${String(value)}`);
      this._headers[String(name)] = String(value);
    }
  }

  let document = makeDocument(cookie);
  const localStorage = makeStorage(localStorageValues);
  const sessionStorage = makeStorage();
  let timerId = 0;

  const traceObject = (name, value) => {
    if (typeof traceAccess !== 'function' || value == null) return value;
    return new Proxy(value, {
      get(target, property, receiver) {
        if (typeof property !== 'symbol') traceAccess(`${name}.${String(property)}`);
        const result = Reflect.get(target, property, receiver);
        if (typeof result !== 'function' || typeof property === 'symbol') return result;
        return function tracedMethod(...args) {
          traceAccess(
            `${name}.${String(property)}(${args.map((arg) => String(arg)).join(',')})`,
          );
          return Reflect.apply(result, target, args);
        };
      },
      has(target, property) {
        if (typeof property !== 'symbol') traceAccess(`${name} has ${String(property)}`);
        return Reflect.has(target, property);
      },
    });
  };

  document = traceObject('document', document);

  const StorageManager = function StorageManager() {};
  Object.defineProperty(StorageManager.prototype, Symbol.toStringTag, {
    value: 'StorageManager',
  });
  Object.defineProperties(StorageManager.prototype, {
    estimate: {
      configurable: true,
      enumerable: true,
      value() {
        return Promise.resolve({ quota: 0, usage: 0 });
      },
    },
    persisted: {
      configurable: true,
      enumerable: true,
      value() {
        return Promise.resolve(false);
      },
    },
  });

  const navigatorValues = {
    cookieEnabled: true,
    deviceMemory: fp.deviceMemory,
    hardwareConcurrency: fp.hardwareConcurrency,
    language: fp.language,
    languages: fp.languages,
    maxTouchPoints: 0,
    onLine: true,
    platform: fp.platform,
    product: 'Gecko',
    productSub: '20030107',
    plugins: new PluginArrayShim(),
    storage: new StorageManager(),
    userAgent: fp.userAgent,
    vendor: 'Google Inc.',
    vendorSub: '',
    webdriver: false,
    sendBeacon() {
      return true;
    },
  };
  const navigatorKeys = [
    'vendorSub', 'productSub', 'vendor', 'maxTouchPoints', 'scheduling',
    'userActivation', 'geolocation', 'doNotTrack', 'webkitTemporaryStorage',
    'webkitPersistentStorage', 'windowControlsOverlay', 'hardwareConcurrency',
    'cookieEnabled', 'appCodeName', 'appName', 'appVersion', 'platform',
    'product', 'userAgent', 'language', 'languages', 'onLine', 'webdriver',
    'plugins', 'mimeTypes', 'pdfViewerEnabled', 'connection', 'getGamepads',
    'javaEnabled', 'sendBeacon', 'vibrate', 'cpuPerformance',
    'deprecatedRunAdAuctionEnforcesKAnonymity', 'protectedAudience',
    'bluetooth', 'clipboard', 'credentials', 'keyboard', 'managed',
    'mediaDevices', 'serviceWorker', 'virtualKeyboard', 'wakeLock',
    'deviceMemory', 'userAgentData', 'locks', 'storage', 'gpu', 'login', 'ink',
    'mediaCapabilities', 'permissions', 'devicePosture', 'hid', 'mediaSession',
    'presentation', 'serial', 'usb', 'xr', 'storageBuckets',
    'adAuctionComponents', 'runAdAuction', 'canLoadAdAuctionFencedFrame',
    'canShare', 'share', 'clearAppBadge', 'getBattery', 'getUserMedia',
    'requestMIDIAccess', 'requestMediaKeySystemAccess', 'setAppBadge',
    'webkitGetUserMedia', 'clearOriginJoinedAdInterestGroups',
    'createAuctionNonce', 'joinAdInterestGroup', 'leaveAdInterestGroup',
    'updateAdInterestGroups', 'deprecatedReplaceInURN', 'deprecatedURNToURL',
    'getInstalledRelatedApps', 'getInterestGroupAdAuctionData',
    'registerProtocolHandler', 'unregisterProtocolHandler',
  ];
  const Navigator = function Navigator() {};
  Object.defineProperty(Navigator.prototype, Symbol.toStringTag, {
    value: 'Navigator',
  });
  for (const key of navigatorKeys) {
    Object.defineProperty(Navigator.prototype, key, {
      configurable: true,
      enumerable: true,
      get() {
        return navigatorValues[key];
      },
    });
  }
  const navigatorObject = traceObject('navigator', new Navigator());

  const screenValues = {
    availHeight: fp.availHeight,
    availLeft: 0,
    availTop: 0,
    availWidth: fp.availWidth,
    colorDepth: fp.colorDepth,
    height: fp.screenHeight,
    isExtended: false,
    onchange: null,
    orientation: { angle: 0, type: 'landscape-primary' },
    pixelDepth: fp.colorDepth,
    width: fp.screenWidth,
  };
  const Screen = function Screen() {};
  Object.defineProperty(Screen.prototype, Symbol.toStringTag, { value: 'Screen' });
  for (const key of [
    'availWidth', 'availHeight', 'width', 'height', 'colorDepth', 'pixelDepth',
    'availLeft', 'availTop', 'orientation', 'onchange', 'isExtended',
  ]) {
    Object.defineProperty(Screen.prototype, key, {
      configurable: true,
      enumerable: true,
      get() {
        return screenValues[key];
      },
    });
  }
  const screenObject = traceObject('screen', new Screen());
  const locationObject = traceObject('location', Object.assign(new LocationShim(), {
    hash: '',
    host: 'www.douyin.com',
    hostname: 'www.douyin.com',
    href: 'https://www.douyin.com/',
    origin: 'https://www.douyin.com',
    pathname: '/',
    port: '',
    protocol: 'https:',
    search: '',
  }));
  document.location = locationObject;

  const sandbox = {
    Blob,
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    Event: class Event {
      constructor(type) {
        this.type = type;
      }
    },
    Error: BrowserError,
    EventTarget: EventTargetShim,
    FormData,
    Headers,
    HTMLAllCollection: HTMLAllCollectionShim,
    Image: class Image {},
    Notification: class Notification {
      static permission = 'denied';
      static requestPermission() {
        return Promise.resolve('denied');
      }
    },
    IntersectionObserver: class IntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    MutationObserver: class MutationObserver {
      observe() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
    Navigator,
    PluginArray: PluginArrayShim,
    Request,
    Response,
    Screen,
    StorageManager,
    TextDecoder,
    TextEncoder,
    URL,
    URLSearchParams,
    WebSocket: class WebSocket extends EventTargetShim {},
    Worker: class Worker {},
    XMLHttpRequest: XMLHttpRequestShim,
    addEventListener() {},
    atob(value) {
      return Buffer.from(String(value), 'base64').toString('binary');
    },
    btoa(value) {
      return Buffer.from(String(value), 'binary').toString('base64');
    },
    cancelAnimationFrame() {},
    clearInterval() {},
    clearTimeout() {},
    console: Object.freeze({
      debug() {},
      error() {},
      info() {},
      log() {},
      warn() {},
    }),
    crypto: {
      getRandomValues(array) {
        return randomFillSync(array);
      },
      randomUUID,
    },
    document,
    devicePixelRatio: 2,
    external: {},
    fetch: async () => new Response('{}', { status: 200 }),
    getComputedStyle() {
      return { getPropertyValue() { return ''; } };
    },
    history: traceObject('history', new HistoryShim()),
    indexedDB: {
      open() {
        return {
          error: null,
          onerror: null,
          onsuccess: null,
          onupgradeneeded: null,
          result: null,
        };
      },
    },
    innerHeight: fp.innerHeight,
    innerWidth: fp.innerWidth,
    isSecureContext: true,
    localStorage: traceObject('localStorage', localStorage),
    locationbar: {},
    location: locationObject,
    matchMedia() {
      return {
        matches: false,
        addEventListener() {},
        addListener() {},
        removeEventListener() {},
        removeListener() {},
      };
    },
    navigator: navigatorObject,
    outerHeight: fp.outerHeight,
    outerWidth: fp.outerWidth,
    performance: traceObject('performance', {
      getEntriesByType() {
        return [];
      },
      mark() {},
      measure() {},
      now: monotonicNow,
      timeOrigin: Date.now(),
      timing: { navigationStart: Date.now() },
    }),
    removeEventListener() {},
    requestAnimationFrame(callback) {
      callback(monotonicNow());
      return ++timerId;
    },
    screen: screenObject,
    sessionStorage: traceObject('sessionStorage', sessionStorage),
    setInterval() {
      return ++timerId;
    },
    setTimeout(callback, delay = 0) {
      if (delay <= 0) queueMicrotask(callback);
      return ++timerId;
    },
    webviewBridge: {
      callBrowserWindow() {
        return '';
      },
    },
    toolbar: {},
  };

  Object.setPrototypeOf(sandbox, WindowShim.prototype);
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.top = sandbox;
  sandbox.parent = sandbox;
  sandbox.frames = sandbox;
  if (typeof traceBytecode === 'function' || typeof traceAccess === 'function') {
    Object.defineProperty(sandbox, '__traceGlobalName', {
      configurable: true,
      value: traceBytecode ?? traceAccess,
    });
  }
  if (typeof traceReturn === 'function') {
    Object.defineProperty(sandbox, '__traceReturn', {
      configurable: true,
      value: traceReturn,
    });
  }
  return sandbox;
}

export async function loadOfficialBdmsSource({
  fetchImpl = globalThis.fetch,
  sdkUrl = BDMS_URL,
} = {}) {
  if (cachedOfficialSource) return cachedOfficialSource;
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchImpl is required to load the official BDMS source');
  }

  const response = await fetchImpl(sdkUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`BDMS download failed: HTTP ${response.status}`);
  }

  const source = await response.text();
  if (!source.includes('window.bdms') || !source.includes('1.0.1.19-fix.01')) {
    throw new Error('Downloaded file is not the expected BDMS 1.0.1.19-fix.01 build');
  }
  const digest = createHash('sha256').update(source).digest('hex');
  if (digest !== BDMS_SHA256) {
    throw new Error(`BDMS changed: expected ${BDMS_SHA256}, received ${digest}`);
  }
  cachedOfficialSource = source;
  return source;
}

function patchHtmlDdaSemantics(source) {
  if (source.includes('__isHTMLDDA&&null==w')) return source;

  const compact = 'w=v[p--],v[p]=v[p]!=w';
  const expanded = '((w = v[p--]), (v[p] = v[p] != w))';
  const replacement =
    'w=v[p--],v[p]=v[p]&&v[p].__isHTMLDDA&&null==w?!1:' +
    'w&&w.__isHTMLDDA&&null==v[p]?!1:v[p]!=w';

  if (source.includes(compact)) return source.replace(compact, replacement);
  if (source.includes(expanded)) return source.replace(expanded, `(${replacement})`);
  throw new Error('BDMS HTMLDDA comparison opcode was not found');
}

/**
 * Execute Douyin's current first-page acrawler challenge in the same pure
 * Node browser shim used by the BDMS signer. The challenge source is taken
 * directly from the first HTML response, so this does not embed a copied or
 * third-party __ac_signature implementation.
 */
export function signAcChallenge({
  challengeSource,
  cookie = '',
  fingerprint = {},
  nonce,
} = {}) {
  if (typeof challengeSource !== 'string' || challengeSource.length === 0) {
    throw new TypeError('challengeSource is required');
  }
  if (typeof nonce !== 'string' || nonce.length === 0) {
    throw new TypeError('nonce is required');
  }

  const sandbox = makeSandbox({ cookie, fingerprint });
  const context = vm.createContext(sandbox);
  vm.runInContext(challengeSource, context, {
    filename: 'douyin-acrawler-challenge.js',
    timeout: 10_000,
  });

  const acrawler = context.byted_acrawler;
  if (!acrawler || typeof acrawler.init !== 'function' || typeof acrawler.sign !== 'function') {
    throw new Error('Challenge did not expose window.byted_acrawler');
  }
  acrawler.init({ aid: 99999999, dfp: 0 });
  const signature = acrawler.sign('', nonce);
  if (typeof signature !== 'string' || signature.length === 0) {
    throw new Error('acrawler did not return __ac_signature');
  }
  return signature;
}

/**
 * Pure Node VM wrapper around the current official BDMS build.
 *
 * The browser shims reproduce the fingerprint branches used by this build,
 * including Chromium's otherwise-unconstructable HTMLDDA document.all rules.
 * Its output has been checked byte-for-byte against Chromium under fixed time
 * and randomness and accepted by the live favorite-list endpoint.
 */
export async function createABogusSigner({
  additionalBdmsOptions = [],
  bdmsOptions = {},
  cookie = '',
  fingerprint = {},
  localStorageValues = {},
  sdkSource,
  sdkUrl = BDMS_URL,
  traceAccess,
  traceBytecode,
  traceReturn,
} = {}) {
  const officialSource = sdkSource ?? await loadOfficialBdmsSource({ sdkUrl });
  // document.all is a Chromium-only HTMLDDA exotic object. JavaScript cannot
  // construct another value with its loose-null comparison behavior, so the
  // official bytecode interpreter is adjusted only at that comparison opcode.
  const source = patchHtmlDdaSemantics(officialSource);
  const sandbox = makeSandbox({
    cookie,
    fingerprint,
    localStorageValues,
    traceAccess,
    traceBytecode,
    traceReturn,
  });
  // A Proxy around the VM global hides context intrinsics such as Object from
  // Reflect.get(target, ...), changing the SDK's runtime. Trace only the
  // browser objects explicitly installed by makeSandbox so observation does
  // not alter the code being observed.
  const context = vm.createContext(sandbox);

  vm.runInContext(source, context, {
    filename: `bdms-${BDMS_VERSION}.js`,
    timeout: 10_000,
  });

  if (!context.bdms || typeof context.bdms.init !== 'function') {
    throw new Error('BDMS initialized without exposing bdms.init()');
  }

  context.bdms.init({ ...DEFAULT_BDMS_OPTIONS, ...bdmsOptions });
  for (const options of additionalBdmsOptions) {
    context.bdms.init(options);
  }

  return function signABogus(input) {
    const url = input instanceof URL
      ? input.toString()
      : /^https?:\/\//i.test(String(input))
        ? String(input)
        : `https://www.douyin.com/aweme/v1/web/aweme/favorite/?${String(input).replace(/^\?/, '')}`;

    const xhr = new context.XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.send(null);

    const signedUrl = new URL(xhr._url);
    const aBogus = signedUrl.searchParams.get('a_bogus');
    if (!aBogus) throw new Error('BDMS did not append a_bogus');

    return {
      aBogus,
      query: signedUrl.search.slice(1),
      url: signedUrl.toString(),
    };
  };
}

/**
 * Pure current runtime_bundler_34 web-sign calculation.
 * The returned headers are the same three values produced by the live runtime.
 */
export function signWebUrl(input, uifid, timestamp = Math.floor(Date.now() / 1000)) {
  if (!uifid) throw new TypeError('uifid is required');

  const url = input instanceof URL ? new URL(input) : new URL(String(input));
  url.searchParams.delete('timestamp');
  url.searchParams.delete('x-secsdk-web-signature');
  if (!url.searchParams.has('uifid')) url.searchParams.append('uifid', uifid);

  const stamp = String(Math.trunc(Number(timestamp)));
  url.searchParams.append('timestamp', stamp);
  const canonicalQuery = url.searchParams.toString();
  const signature = createHash('md5')
    .update(`${uifid}_${stamp}_${WEB_SIGN_SALT}_${canonicalQuery}`)
    .digest('hex');

  url.searchParams.append('x-secsdk-web-signature', signature);
  return {
    canonicalQuery,
    headers: {
      uifid,
      'x-secsdk-web-expire': stamp,
      'x-secsdk-web-signature': signature,
    },
    signature,
    timestamp: stamp,
    url: url.toString(),
  };
}

function put(params, name, value) {
  if (value !== undefined && value !== null) params.append(name, String(value));
}

/**
 * Reproduces the current favorite-list parameter order:
 * base query -> a_bogus -> verifyFp/fp -> timestamp/web signature.
 */
export async function buildFavoriteUrl({
  count = 18,
  cursor = 'max_cursor=0&min_cursor=0',
  fingerprint = {},
  noCache,
  secUserId,
  session,
  signer,
} = {}) {
  if (!secUserId) throw new TypeError('secUserId is required');
  if (!session?.uifid) throw new TypeError('session.uifid is required');

  const fp = { ...DEFAULT_FINGERPRINT, ...fingerprint };
  const cursors = cursor instanceof URLSearchParams
    ? cursor
    : new URLSearchParams(String(cursor).replace(/^\?/, ''));
  const params = new URLSearchParams();

  put(params, 'device_platform', 'webapp');
  put(params, 'aid', 6383);
  put(params, 'channel', 'channel_pc_web');
  put(params, 'sec_user_id', secUserId);
  put(params, 'max_cursor', cursors.get('max_cursor') ?? 0);
  put(params, 'min_cursor', cursors.get('min_cursor') ?? 0);
  put(params, 'whale_cut_token', cursors.get('whale_cut_token') ?? '');
  put(params, 'cut_version', 1);
  put(params, 'count', count);
  put(params, 'publish_video_strategy_type', 2);
  put(params, 'update_version_code', 170400);
  put(params, 'pc_client_type', 1);
  put(params, 'pc_libra_divert', 'Mac');
  put(params, 'support_h265', 1);
  put(params, 'support_dash', 1);
  put(params, 'cpu_core_num', fp.hardwareConcurrency);
  put(params, 'version_code', 170400);
  put(params, 'version_name', '17.4.0');
  put(params, 'cookie_enabled', true);
  put(params, 'screen_width', fp.screenWidth);
  put(params, 'screen_height', fp.screenHeight);
  put(params, 'browser_language', fp.language);
  put(params, 'browser_platform', fp.platform);
  put(params, 'browser_name', 'Chrome');
  put(params, 'browser_version', '153.0.0.0');
  put(params, 'browser_online', true);
  put(params, 'engine_name', 'Blink');
  put(params, 'engine_version', '153.0.0.0');
  put(params, 'os_name', 'Mac OS');
  put(params, 'os_version', '10.15.7');
  put(params, 'device_memory', fp.deviceMemory);
  put(params, 'platform', 'PC');
  put(params, 'downlink', 6.75);
  put(params, 'effective_type', '4g');
  put(params, 'round_trip_time', 100);
  put(params, 'webid', session.webid);
  put(params, 'uifid', session.uifid);
  put(params, 'msToken', session.msToken);
  put(params, '_nocache', noCache);

  const signABogus = signer ?? await createABogusSigner({
    cookie: session.cookie ?? '',
    fingerprint: fp,
  });
  const bdmsSigned = signABogus(
    `https://www.douyin.com/aweme/v1/web/aweme/favorite/?${params}`,
  );
  const withFingerprint = new URL(bdmsSigned.url);
  put(withFingerprint.searchParams, 'verifyFp', session.verifyFp);
  put(withFingerprint.searchParams, 'fp', session.verifyFp);

  const webSigned = signWebUrl(withFingerprint, session.uifid);
  return {
    ...webSigned,
    aBogus: bdmsSigned.aBogus,
    userAgent: fp.userAgent,
  };
}

/**
 * Pure Node fetch wrapper. The cookie is sent as the logged-in credential but
 * is not an input to BDMS a_bogus calculation.
 */
export async function getDouyinFavorites(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');

  const signed = await buildFavoriteUrl(options);
  const headers = new Headers(options.headers);
  headers.set('accept', 'application/json, text/plain, */*');
  headers.set('referer', `https://www.douyin.com/user/${options.secUserId}?showTab=like`);
  headers.set('user-agent', signed.userAgent);
  for (const [name, value] of Object.entries(signed.headers)) {
    headers.set(name, value);
  }
  if (options.session?.cookie) headers.set('cookie', options.session.cookie);

  const response = await fetchImpl(signed.url, {
    cache: 'no-store',
    credentials: 'include',
    headers,
    method: 'GET',
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Douyin returned non-JSON HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  if (!response.ok) {
    throw new Error(`Douyin returned HTTP ${response.status}: ${JSON.stringify(data).slice(0, 500)}`);
  }

  return { data, response, signed };
}

