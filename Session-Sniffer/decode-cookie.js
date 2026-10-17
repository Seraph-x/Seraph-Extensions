#!/usr/bin/env node
// decode-cookie.js — 拆解 Google 那种「打包 cookie」
// 用法: node decode-cookie.js "gwus-pd=CjYACWuJ...:gwus-pd-hl=CkMACWuJ..."
// 或:   node decode-cookie.js --from-json dump.json COMPASS

const B64URL = /^[A-Za-z0-9_\-]+$/;

function fromB64Url(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

// --- 极简 protobuf wire-format 走查（无需 schema，字段号 + 类型 + 原始值）---
function readVarint(buf, i) {
  let shift = 0, val = 0n;
  while (i < buf.length) {
    const b = buf[i++];
    val |= BigInt(b & 0x7f) << BigInt(shift);
    if (!(b & 0x80)) return [val, i];
    shift += 7;
    if (shift > 63) throw new Error('varint too long');
  }
  throw new Error('truncated varint');
}

function walkProto(buf, indent = 0, depth = 0) {
  const pad = '  '.repeat(indent);
  const out = [];
  let i = 0;
  while (i < buf.length) {
    let key;
    [key, i] = readVarint(buf, i);
    const field = Number(key >> 3n);
    const wire = Number(key & 7n);
    let value;
    if (wire === 0) {
      [value, i] = readVarint(buf, i);
      out.push(pad + '#' + field + ' varint  = ' + value);
    } else if (wire === 2) {
      let len;
      [len, i] = readVarint(buf, i);
      const slice = buf.subarray(i, i + Number(len));
      i += Number(len);
      const asStr = slice.toString('utf8');
      const printable = /^[\x20-\x7e\t\r\n]*$/.test(asStr) && asStr.length > 0;
      // 尝试递归当作嵌套 message
      let nested = null;
      if (depth < 4 && slice.length) {
        try { nested = walkProto(slice, indent + 1, depth + 1); } catch { nested = null; }
      }
      out.push(pad + '#' + field + ' bytes[' + slice.length + ']' +
        (printable ? ' str=' + JSON.stringify(asStr) : ''));
      if (nested && nested.length && !printable) out.push(...nested);
      else if (!printable) out.push(pad + '  hex=' + slice.toString('hex').slice(0, 96));
    } else if (wire === 5) {
      value = buf.readUInt32LE(i); i += 4;
      out.push(pad + '#' + field + ' fixed32 = ' + value);
    } else if (wire === 1) {
      value = buf.readBigUInt64LE(i); i += 8;
      out.push(pad + '#' + field + ' fixed64 = ' + value);
    } else {
      out.push(pad + '#' + field + ' wire=' + wire + ' (unsupported, 停止)');
      break;
    }
  }
  return out;
}

function decodePacked(raw) {
  console.log('\n=== 打包 cookie 原文 (' + raw.length + ' chars) ===');
  console.log(raw);

  // 顶层用 ':' 分隔多个子 cookie
  const parts = raw.split(':');
  console.log('\n顶层子键 ' + parts.length + ' 个:');

  for (const part of parts) {
    const eq = part.indexOf('=');
    const k = eq >= 0 ? part.slice(0, eq) : '(no-key)';
    const v = eq >= 0 ? part.slice(eq + 1) : part;
    console.log('\n--- ' + k + ' ---  value ' + v.length + ' chars');

    if (!B64URL.test(v)) { console.log('  非 base64url，原样: ' + v); continue; }

    const buf = fromB64Url(v);
    console.log('  base64url -> ' + buf.length + ' bytes');
    console.log('  hex head : ' + buf.toString('hex').slice(0, 64) + (buf.length > 32 ? '…' : ''));

    try {
      const tree = walkProto(buf, 2);
      console.log('  protobuf 结构:');
      console.log(tree.slice(0, 60).join('\n'));
      if (tree.length > 60) console.log('  … 还有 ' + (tree.length - 60) + ' 行');
    } catch (e) {
      console.log('  不是合法 protobuf: ' + e.message);
      console.log('  尝试 utf8: ' + JSON.stringify(buf.toString('utf8').slice(0, 120)));
    }
  }
}

// ---- CLI ----
const argv = process.argv.slice(2);
if (argv[0] === '--from-json') {
  const dump = require(require('path').resolve(argv[1]));
  const name = argv[2] || 'COMPASS';
  const c = (dump.cookies || []).find(x => x.name === name);
  if (!c) { console.error('未找到 cookie: ' + name); process.exit(1); }
  console.log('domain=' + c.domain + '  path=' + c.path +
    '  secure=' + c.secure + '  httpOnly=' + c.httpOnly +
    '  sameSite=' + c.sameSite +
    (c.partitionKey ? '  partitionKey=' + JSON.stringify(c.partitionKey) : ''));
  decodePacked(c.value);
} else if (argv[0]) {
  decodePacked(argv[0].includes('=') ? argv[0] : argv[0]);
} else {
  console.log('用法:');
  console.log('  node decode-cookie.js "gwus-pd=XXXX:gwus-pd-hl=YYYY"');
  console.log('  node decode-cookie.js --from-json dump.json COMPASS');
}
