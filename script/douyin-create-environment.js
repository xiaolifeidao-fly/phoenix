#!/usr/bin/env node

/*
 * Action 1: create a fresh, reusable anonymous Douyin environment.
 *
 * Print JSON to stdout:
 *   node scripts/douyin-create-environment.js <aweme_id|video_url>
 *
 * Save it with owner-only permissions:
 *   node scripts/douyin-create-environment.js <aweme_id|video_url> \
 *     --output ./douyin-environment.json
 */

'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const {
  createDouyinEnvironment,
} = require('./douyin-detail-node.js');

function parseArguments(args) {
  let input;
  let outputPath;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--output' || argument === '-o') {
      outputPath = args[++index];
      if (!outputPath) throw new Error('--output 缺少文件路径');
    } else if (!input) {
      input = argument;
    } else {
      throw new Error(`无法识别的参数：${argument}`);
    }
  }
  return { input, outputPath };
}

async function main() {
  const { input, outputPath } = parseArguments(process.argv.slice(2));
  if (!input) {
    console.error(
      '用法：node scripts/douyin-create-environment.js ' +
        '<aweme_id|video_url> [--output environment.json]',
    );
    process.exitCode = 2;
    return;
  }

  const environment = await createDouyinEnvironment(input);
  const json = `${JSON.stringify(environment, null, 2)}\n`;
  if (!outputPath) {
    process.stdout.write(json);
    return;
  }

  const resolved = path.resolve(outputPath);
  await fs.writeFile(resolved, json, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  process.stdout.write(`${resolved}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}

