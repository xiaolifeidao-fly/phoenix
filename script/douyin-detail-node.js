#!/usr/bin/env node

/*
 * Pure Node.js Douyin public-detail client. No browser is launched and no
 * logged-in Cookie is required.
 *
 * CLI:
 *   node scripts/douyin-detail-node.js 7699461873925892322
 *   node scripts/douyin-detail-node.js 7699461873925892322 \
 *     --environment ./douyin-environment.json
 *
 * Module:
 *   const { getDouyinAwemeDetail } = require('./douyin-detail-node.js');
 *   const detail = await getDouyinAwemeDetail('7699461873925892322');
 *
 * Runtime requirement: Node.js 20+ (built-in fetch and Headers).
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/153.0.0.0 Safari/537.36';

const DEFAULT_FINGERPRINT = Object.freeze({
  deviceMemory: 32,
  hardwareConcurrency: 14,
  language: 'zh-CN',
  platform: 'MacIntel',
  screenHeight: 1117,
  screenWidth: 1728,
  userAgent: DEFAULT_USER_AGENT,
});

const TTWID_REGISTER_URL =
  'https://ttwid.bytedance.com/ttwid/union/register/';

let signerModulePromise;

function loadSignerModule() {
  if (!signerModulePromise) {
    signerModulePromise = import(
      pathToFileURL(path.join(__dirname, 'douyin-sign-live.mjs')).href
    );
  }
  return signerModulePromise;
}

function getSetCookieLines(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const combined = headers.get('set-cookie');
  if (!combined) return [];
  return combined.split(/,(?=\s*[^;,=\s]+=)/g);
}

function getSetCookieValue(headers, name) {
  const prefix = `${name}=`;
  for (const line of getSetCookieLines(headers)) {
    if (!line.startsWith(prefix)) continue;
    const end = line.indexOf(';');
    return line.slice(prefix.length, end < 0 ? undefined : end);
  }
  return undefined;
}

function normalizeAwemeId(input) {
  const value = String(input || '').trim();
  if (/^\d{10,30}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const fromQuery = url.searchParams.get('aweme_id');
    if (fromQuery && /^\d{10,30}$/.test(fromQuery)) return fromQuery;
    const fromPath = url.pathname.match(/\/video\/(\d{10,30})/)?.[1];
    if (fromPath) return fromPath;
  } catch {}
  throw new TypeError('awemeId 必须是视频 ID 或包含视频 ID 的抖音 URL');
}

function normalizeDouyinEnvironment(environment) {
  if (!environment || typeof environment !== 'object') {
    throw new TypeError('environment 必须是对象');
  }
  if (
    typeof environment.cookie !== 'string' ||
    !/(?:^|;\s*)ttwid=/.test(environment.cookie)
  ) {
    throw new TypeError('environment.cookie 中没有 ttwid');
  }
  if (typeof environment.uifid !== 'string' || environment.uifid.length === 0) {
    throw new TypeError('environment.uifid 必须是非空字符串');
  }
  return {
    cookie: environment.cookie,
    fingerprint: {
      ...DEFAULT_FINGERPRINT,
      ...(environment.fingerprint || {}),
    },
    uifid: environment.uifid,
  };
}

async function readDouyinEnvironment(filePath) {
  const text = await fs.readFile(path.resolve(filePath), 'utf8');
  let environment;
  try {
    environment = JSON.parse(text);
  } catch {
    throw new Error(`环境文件不是合法 JSON：${filePath}`);
  }
  return normalizeDouyinEnvironment(environment);
}

function navigationHeaders(userAgent, extra = {}) {
  return {
    accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,' +
      'image/avif,image/webp,image/apng,*/*;q=0.8,' +
      'application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'zh-CN,zh;q=0.9',
    'user-agent': userAgent,
    ...extra,
  };
}

async function fetchJson(response, label) {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${label} 返回非 JSON：HTTP ${response.status}`);
  }
  if (!response.ok || data?.status_code !== 0) {
    throw new Error(
      `${label} 失败：HTTP ${response.status}, status_code=${data?.status_code}`,
    );
  }
  return data;
}

/**
 * Ask ByteDance's official anonymous-device endpoint for a ttwid, then use
 * the supplied callback ticket to scope that cookie to .douyin.com.
 */
async function registerAnonymousTtwid({ fetchImpl, userAgent }) {
  const response = await fetchImpl(TTWID_REGISTER_URL, {
    body: JSON.stringify({
      aid: 6383,
      cbUrlProtocol: 'https',
      migrate_info: { source: 'node', ticket: '' },
      needFid: false,
      region: 'cn',
      service: 'www.douyin.com',
      union: true,
    }),
    headers: {
      'content-type': 'application/json',
      origin: 'https://www.douyin.com',
      referer: 'https://www.douyin.com/',
      'user-agent': userAgent,
    },
    method: 'POST',
    redirect: 'manual',
  });
  const data = await fetchJson(response, 'ttwid 注册');
  const callbackUrl = new URL(data.redirect_url);
  if (
    callbackUrl.hostname !== 'www.douyin.com' ||
    callbackUrl.pathname !== '/ttwid/union/register/callback/'
  ) {
    throw new Error('ttwid 注册返回了非预期 callback URL');
  }

  const callback = await fetchImpl(callbackUrl, {
    headers: navigationHeaders(userAgent, {
      referer: 'https://www.douyin.com/',
    }),
    redirect: 'manual',
  });
  const ttwid = getSetCookieValue(callback.headers, 'ttwid');
  if (!callback.ok || !ttwid) {
    throw new Error(`ttwid callback 失败：HTTP ${callback.status}`);
  }
  return ttwid;
}

function extractAcrawlerChallenge(html) {
  for (const match of String(html).matchAll(
    /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi,
  )) {
    if (match[1].includes('_$jsvmprt')) return match[1];
  }
  throw new Error('页面中没有找到当前 acrawler challenge');
}

/**
 * Create a fresh anonymous Douyin device session entirely in Node:
 * ttwid -> nonce -> current first-party challenge -> UIFID_TEMP.
 */
async function createAnonymousDouyinSession(awemeIdInput, options = {}) {
  const awemeId = normalizeAwemeId(awemeIdInput);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  const fingerprint = {
    ...DEFAULT_FINGERPRINT,
    ...(options.fingerprint || {}),
  };
  const { signAcChallenge } = await loadSignerModule();
  const pageUrl = `https://www.douyin.com/video/${awemeId}`;

  let ttwid = await registerAnonymousTtwid({
    fetchImpl,
    userAgent: fingerprint.userAgent,
  });

  const firstCookie = `ttwid=${ttwid}`;
  const first = await fetchImpl(pageUrl, {
    headers: navigationHeaders(fingerprint.userAgent, {
      cookie: firstCookie,
    }),
    redirect: 'manual',
  });
  const nonce = getSetCookieValue(first.headers, '__ac_nonce');
  const html = await first.text();
  if (!first.ok || !nonce) {
    throw new Error(`匿名页面 challenge 获取失败：HTTP ${first.status}`);
  }

  const challengeSource = extractAcrawlerChallenge(html);
  const acSignature = signAcChallenge({
    challengeSource,
    cookie: `${firstCookie}; __ac_nonce=${nonce}`,
    fingerprint,
    nonce,
  });
  const challengeCookie =
    `${firstCookie}; __ac_nonce=${nonce}; ` +
    `__ac_signature=${acSignature}; __ac_referer=__ac_blank`;
  const second = await fetchImpl(pageUrl, {
    headers: navigationHeaders(fingerprint.userAgent, {
      cookie: challengeCookie,
      referer: pageUrl,
    }),
    redirect: 'manual',
  });
  // The successful challenge response rotates ttwid and issues UIFID_TEMP.
  ttwid = getSetCookieValue(second.headers, 'ttwid') || ttwid;
  const uifid = getSetCookieValue(second.headers, 'UIFID_TEMP');
  await second.arrayBuffer();
  if (!second.ok || !uifid) {
    throw new Error(`UIFID_TEMP 获取失败：HTTP ${second.status}`);
  }

  return {
    cookie: `ttwid=${ttwid}`,
    fingerprint,
    pageUrl,
    uifid,
  };
}

/**
 * Serializable environment that can be saved and reused for detail requests.
 */
async function createDouyinEnvironment(awemeIdInput, options = {}) {
  const session = await createAnonymousDouyinSession(awemeIdInput, options);
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    cookie: session.cookie,
    fingerprint: session.fingerprint,
    uifid: session.uifid,
  };
}

function put(params, name, value) {
  params.append(name, String(value));
}

async function buildDetailUrl(awemeIdInput, session) {
  const awemeId = normalizeAwemeId(awemeIdInput);
  const fp = session.fingerprint;
  const params = new URLSearchParams();
  put(params, 'device_platform', 'webapp');
  put(params, 'aid', 6383);
  put(params, 'channel', 'channel_pc_web');
  put(params, 'aweme_id', awemeId);
  put(params, 'request_source', 600);
  put(params, 'origin_type', 'video_page');
  put(params, 'update_version_code', 170400);
  put(params, 'pc_client_type', 1);
  put(params, 'pc_libra_divert', 'Mac');
  put(params, 'support_h265', 1);
  put(params, 'support_dash', 1);
  put(params, 'cpu_core_num', fp.hardwareConcurrency);
  put(params, 'version_code', 190500);
  put(params, 'version_name', '19.5.0');
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
  put(params, 'downlink', 10);
  put(params, 'effective_type', '4g');
  put(params, 'round_trip_time', 100);
  put(params, 'uifid', session.uifid);

  const { createABogusSigner, signWebUrl } = await loadSignerModule();
  const signABogus = await createABogusSigner({
    cookie: session.cookie,
    fingerprint: fp,
  });
  const bdms = signABogus(
    `https://www.douyin.com/aweme/v1/web/aweme/detail/?${params}`,
  );
  return signWebUrl(bdms.url, session.uifid);
}

/**
 * Fetch one public aweme_detail using a freshly bootstrapped anonymous device.
 */
async function getDouyinAwemeDetail(awemeIdInput, options = {}) {
  const awemeId = normalizeAwemeId(awemeIdInput);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const session = normalizeDouyinEnvironment(
    options.environment ||
      options.session ||
      (await createDouyinEnvironment(awemeId, {
        fetchImpl,
        fingerprint: options.fingerprint,
      })),
  );
  const signed = await buildDetailUrl(awemeId, session);
  const headers = new Headers({
    accept: 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9',
    cookie: session.cookie,
    referer: `https://www.douyin.com/video/${awemeId}`,
    'user-agent': session.fingerprint.userAgent,
  });
  for (const [name, value] of Object.entries(signed.headers)) {
    headers.set(name, value);
  }

  const response = await fetchImpl(signed.url, {
    headers,
    method: 'GET',
    redirect: 'manual',
  });
  const data = await fetchJson(response, 'aweme detail');
  if (!data.aweme_detail) {
    throw new Error('接口成功但没有返回 aweme_detail');
  }
  return data.aweme_detail;
}

async function main() {
  const args = process.argv.slice(2);
  let input;
  let environmentPath;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--environment' || argument === '-e') {
      environmentPath = args[++index];
      if (!environmentPath) throw new Error('--environment 缺少文件路径');
    } else if (!input) {
      input = argument;
    } else {
      throw new Error(`无法识别的参数：${argument}`);
    }
  }
  if (!input) {
    console.error(
      '用法：node scripts/douyin-detail-node.js <aweme_id|video_url> ' +
        '[--environment environment.json]',
    );
    process.exitCode = 2;
    return;
  }
  const environment = environmentPath
    ? await readDouyinEnvironment(environmentPath)
    : undefined;
  const detail = await getDouyinAwemeDetail(input, { environment });
  process.stdout.write(`${JSON.stringify(detail, null, 2)}\n`);
}

module.exports = {
  buildDetailUrl,
  createAnonymousDouyinSession,
  createDouyinEnvironment,
  getDouyinAwemeDetail,
  normalizeAwemeId,
  normalizeDouyinEnvironment,
  readDouyinEnvironment,
  registerAnonymousTtwid,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
