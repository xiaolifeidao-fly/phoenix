#!/usr/bin/env node

/*
 * Pure Node.js Douyin favorite-list client. No browser is launched.
 *
 * Module usage:
 *
 *   const {
 *     getDouyinFavoriteVideos,
 *   } = require('./scripts/douyin-favorites-node.js');
 *
 *   const videos = await getDouyinFavoriteVideos({
 *     secUserId: '...',
 *     cursor: 'max_cursor=0&min_cursor=0',
 *     cookie: '...',
 *     webid: '...',
 *     uifid: '...',
 *     msToken: '...',
 *     verifyFp: '...',
 *   });
 *
 *   console.log(videos);
 *
 * CLI usage (the JSON file contains the same fields):
 *
 *   node scripts/douyin-favorites-node.js ./douyin-session.json
 *   node scripts/douyin-favorites-node.js --print-environment
 *
 * Security: keep the session JSON outside version control. Cookie, msToken,
 * UIFID and verifyFp are account/session credentials.
 */

'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DEFAULT_CURSOR = 'max_cursor=0&min_cursor=0';
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/153.0.0.0 Safari/537.36';

let signerModulePromise;

function loadSignerModule() {
  if (!signerModulePromise) {
    const moduleUrl = pathToFileURL(
      path.join(__dirname, 'douyin-sign-live.mjs'),
    ).href;
    signerModulePromise = import(moduleUrl);
  }
  return signerModulePromise;
}

function requireString(options, name) {
  const value = options?.[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} 必须是非空字符串`);
  }
  return value;
}

function normalizeOptions(options) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('options 必须是对象');
  }

  return {
    cursor: options.cursor || DEFAULT_CURSOR,
    fingerprint: {
      ...(options.fingerprint || {}),
      userAgent: options.userAgent || DEFAULT_USER_AGENT,
    },
    headers: options.headers || {},
    secUserId: requireString(options, 'secUserId'),
    session: {
      cookie: requireString(options, 'cookie'),
      msToken: requireString(options, 'msToken'),
      uifid: requireString(options, 'uifid'),
      verifyFp: requireString(options, 'verifyFp'),
      webid:
        typeof options.webid === 'string' && options.webid.length > 0
          ? options.webid
          : undefined,
    },
  };
}

function parseCurlText(text) {
  const urlMatch = String(text).match(/curl\s+--url\s+'([^']+)'/);
  const cookieMatch = String(text).match(/(?:^|\s)-b\s+'([^']+)'/m);
  if (!urlMatch || !cookieMatch) {
    throw new Error('cURL 文本中没有解析到 --url 或 -b Cookie');
  }

  const requestUrl = new URL(urlMatch[1]);
  const query = requestUrl.searchParams;
  const requestHeaders = {};
  for (const match of String(text).matchAll(/-H\s+'([^']+)'/g)) {
    const separator = match[1].indexOf(':');
    if (separator <= 0) continue;
    requestHeaders[match[1].slice(0, separator).trim().toLowerCase()] =
      match[1].slice(separator + 1).trim();
  }

  return {
    cookie: cookieMatch[1],
    cursor:
      `max_cursor=${query.get('max_cursor') || 0}` +
      `&min_cursor=${query.get('min_cursor') || 0}`,
    fingerprint: {
      deviceMemory: Number(query.get('device_memory')) || 32,
      hardwareConcurrency: Number(query.get('cpu_core_num')) || 14,
      language: query.get('browser_language') || 'zh-CN',
      platform: query.get('browser_platform') || 'MacIntel',
      screenHeight: Number(query.get('screen_height')) || 1117,
      screenWidth: Number(query.get('screen_width')) || 1728,
    },
    headers: {
      'accept-language':
        requestHeaders['accept-language'] || 'zh-CN,zh;q=0.9',
    },
    msToken: query.get('msToken') || '',
    secUserId: query.get('sec_user_id') || '',
    uifid: query.get('uifid') || requestHeaders.uifid || '',
    userAgent: requestHeaders['user-agent'] || DEFAULT_USER_AGENT,
    verifyFp: query.get('verifyFp') || query.get('fp') || '',
    webid: query.get('webid') || undefined,
  };
}

/**
 * Fetch one favorite-list page and return only its aweme_list.
 *
 * @param {object} options
 * @param {string} options.secUserId
 * @param {string|URLSearchParams|object} [options.cursor]
 * @param {string} options.cookie
 * @param {string} [options.webid]
 * @param {string} options.uifid
 * @param {string} options.msToken
 * @param {string} options.verifyFp
 * @param {string} [options.userAgent]
 * @param {object} [options.headers]
 * @param {object} [options.fingerprint]
 * @returns {Promise<object[]>}
 */
async function getDouyinFavoriteVideos(options) {
  const normalized = normalizeOptions(options);
  const { getDouyinFavorites } = await loadSignerModule();

  const { data } = await getDouyinFavorites({
    cursor: normalized.cursor,
    fingerprint: normalized.fingerprint,
    headers: normalized.headers,
    secUserId: normalized.secUserId,
    session: normalized.session,
  });

  if (!Array.isArray(data?.aweme_list)) {
    throw new Error(
      `接口没有返回 aweme_list：${JSON.stringify(data).slice(0, 500)}`,
    );
  }

  return data.aweme_list;
}

async function getDouyinSimulatedEnvironmentInfo(fingerprint = {}) {
  const { getSimulatedEnvironmentInfo } = await loadSignerModule();
  return getSimulatedEnvironmentInfo(fingerprint);
}

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    console.error(
      '用法：node scripts/douyin-favorites-node.js ./douyin-session.json',
    );
    process.exitCode = 2;
    return;
  }

  if (configPath === '--print-environment') {
    const environment = await getDouyinSimulatedEnvironmentInfo();
    process.stdout.write(`${JSON.stringify(environment, null, 2)}\n`);
    return;
  }

  const input = await fs.readFile(path.resolve(configPath), 'utf8');
  let options;
  try {
    options = JSON.parse(input);
  } catch {
    options = parseCurlText(input);
  }
  const videos = await getDouyinFavoriteVideos(options);

  // The CLI intentionally prints only the requested video list.
  process.stdout.write(`${JSON.stringify(videos, null, 2)}\n`);
}

module.exports = {
  getDouyinFavoriteVideos,
  getDouyinSimulatedEnvironmentInfo,
  normalizeOptions,
  parseCurlText,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
