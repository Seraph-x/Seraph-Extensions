/* CodecLens - codecs.js
 * 各编码格式的纯函数解码/编码实现。
 * 统一约定：decode(raw) -> { text: string, bytes: Uint8Array|null, meta: object }
 * 失败时 throw Error。
 * 挂载到 globalThis.CodecLens.codecs
 */
(function () {
  'use strict';

  var NS = (globalThis.CodecLens = globalThis.CodecLens || {});
  if (NS.codecs) return;
  var U = NS.util;

  var B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  var B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  /* ================================================================ *
   * 通用
   * ================================================================ */

  function bytesToResult(bytes) {
    var text;
    var strict = true;
    try {
      text = U.bytesToUtf8(bytes, true);
    } catch (e) {
      strict = false;
      text = U.bytesToUtf8(bytes, false);
    }
    return { text: text, bytes: bytes, meta: { utf8: strict } };
  }

  function stripWs(s) {
    return String(s).replace(/[\s\r\n\t]+/g, '');
  }

  /* ================================================================ *
   * Base64 / Base64URL
   * ================================================================ */

  function b64Normalize(input) {
    var s = stripWs(input);
    if (!s) throw new Error('base64: 空输入');
    var urlSafe = /[-_]/.test(s);
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    s = s.replace(/=+$/, '');
    if (/[^A-Za-z0-9+/]/.test(s)) throw new Error('base64: 含非法字符');
    if (s.length % 4 === 1) throw new Error('base64: 长度非法');
    var need = (4 - (s.length % 4)) % 4;
    return { body: s + new Array(need + 1).join('='), urlSafe: urlSafe, pad: need };
  }

  function base64Decode(input) {
    var n = b64Normalize(input);
    var bin = atob(n.body);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var r = bytesToResult(bytes);
    r.meta.variant = n.urlSafe ? 'base64url' : 'base64';
    r.meta.padding = n.pad;
    return r;
  }

  function base64Encode(text, urlSafe) {
    return base64EncodeBytes(U.utf8ToBytes(text), urlSafe);
  }

  /* 直接对原始字节做 Base64，避免经过 UTF-8 二次编码破坏二进制数据 */
  function base64EncodeBytes(bytes, urlSafe) {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes || []);
    var bin = U.bytesToLatin1(bytes);
    var out = btoa(bin);
    if (urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return out;
  }

  /* ================================================================ *
   * Base58（Bitcoin 字母表）
   * ================================================================ */

  function base58Decode(input) {
    var s = stripWs(input);
    if (!s) throw new Error('base58: 空输入');
    var num = 0n;
    var base = 58n;
    for (var i = 0; i < s.length; i++) {
      var idx = B58_ALPHABET.indexOf(s[i]);
      if (idx < 0) throw new Error('base58: 含非法字符 ' + s[i]);
      num = num * base + BigInt(idx);
    }
    var bytes = [];
    while (num > 0n) {
      bytes.unshift(Number(num & 0xffn));
      num = num >> 8n;
    }
    var zeros = 0;
    while (zeros < s.length && s[zeros] === '1') zeros++;
    while (zeros-- > 0) bytes.unshift(0);
    var r = bytesToResult(new Uint8Array(bytes));
    r.meta.variant = 'base58';
    return r;
  }

  function base58Encode(text) {
    var bytes = U.utf8ToBytes(text);
    var num = 0n;
    for (var i = 0; i < bytes.length; i++) {
      num = num * 256n + BigInt(bytes[i]);
    }
    var out = '';
    while (num > 0n) {
      var rem = Number(num % 58n);
      out = B58_ALPHABET[rem] + out;
      num = num / 58n;
    }
    for (var j = 0; j < bytes.length && bytes[j] === 0; j++) out = '1' + out;
    return out || '1';
  }

  /* ================================================================ *
   * Base32（RFC 4648）
   * ================================================================ */

  function base32Decode(input) {
    var s = stripWs(input).toUpperCase().replace(/=+$/, '');
    if (!s) throw new Error('base32: 空输入');
    if (/[^A-Z2-7]/.test(s)) throw new Error('base32: 含非法字符');
    var bits = 0;
    var value = 0;
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var idx = B32_ALPHABET.indexOf(s[i]);
      if (idx < 0) throw new Error('base32: 含非法字符');
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        out.push((value >>> bits) & 0xff);
        value = value & ((1 << bits) - 1);
      }
    }
    var r = bytesToResult(new Uint8Array(out));
    r.meta.variant = 'base32';
    return r;
  }

  function base32Encode(text) {
    var bytes = U.utf8ToBytes(text);
    var out = '';
    var bits = 0;
    var value = 0;
    for (var i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        out += B32_ALPHABET[(value >>> bits) & 31];
      }
    }
    if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
    while (out.length % 8 !== 0) out += '=';
    return out;
  }

  /* ================================================================ *
   * Hex
   * ================================================================ */

  function hexDecode(input) {
    var s = stripWs(input).replace(/^0[xX]/, '');
    if (!s) throw new Error('hex: 空输入');
    if (s.length % 2 !== 0) throw new Error('hex: 长度为奇数');
    if (/[^0-9a-fA-F]/.test(s)) throw new Error('hex: 含非法字符');
    var out = new Uint8Array(s.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    var r = bytesToResult(out);
    r.meta.variant = 'hex';
    return r;
  }

  function hexEncode(text) {
    var bytes = U.utf8ToBytes(text);
    var out = '';
    for (var i = 0; i < bytes.length; i++) {
      out += ('0' + bytes[i].toString(16)).slice(-2);
    }
    return out;
  }

  /* ================================================================ *
   * Ascii85 / Base85
   * ================================================================ */

  function ascii85Decode(input) {
    var s = stripWs(input);
    var wrapped = /^<~/.test(s) && /~>$/.test(s);
    if (wrapped) s = s.slice(2, -2);
    if (!s) throw new Error('ascii85: 空输入');
    var out = [];
    var group = [];
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === 'z' && group.length === 0) {
        out.push(0, 0, 0, 0);
        continue;
      }
      var code = ch.charCodeAt(0) - 33;
      if (code < 0 || code > 84) throw new Error('ascii85: 含非法字符');
      group.push(code);
      if (group.length === 5) {
        var v = 0;
        for (var k = 0; k < 5; k++) v = v * 85 + group[k];
        out.push(Math.floor(v / 16777216) & 0xff, Math.floor(v / 65536) & 0xff, Math.floor(v / 256) & 0xff, v & 0xff);
        group = [];
      }
    }
    if (group.length === 1) throw new Error('ascii85: 尾部长度非法');
    if (group.length > 1) {
      var pad = 5 - group.length;
      var v2 = 0;
      for (var k2 = 0; k2 < group.length; k2++) v2 = v2 * 85 + group[k2];
      for (var p = 0; p < pad; p++) v2 = v2 * 85 + 84;
      var full = [Math.floor(v2 / 16777216) & 0xff, Math.floor(v2 / 65536) & 0xff, Math.floor(v2 / 256) & 0xff, v2 & 0xff];
      for (var q = 0; q < 4 - pad; q++) out.push(full[q]);
    }
    var r = bytesToResult(new Uint8Array(out));
    r.meta.variant = 'ascii85';
    return r;
  }

  /* ================================================================ *
   * URL 百分号编码
   * ================================================================ */

  function urlDecode(input) {
    var text;
    try {
      text = decodeURIComponent(input);
    } catch (e) {
      // 含孤立 % 或非法序列时退化为逐段解码
      text = input.replace(/(?:%[0-9A-Fa-f]{2})+/g, function (m) {
        try { return decodeURIComponent(m); } catch (e2) { return m; }
      });
    }
    return { text: text, bytes: null, meta: { variant: 'percent-encoding' } };
  }

  /* ================================================================ *
   * HTML 实体
   * ================================================================ */

  function htmlEntityDecode(input) {
    var text = input;
    try {
      var doc = new DOMParser().parseFromString('<textarea>' + input + '</textarea>', 'text/html');
      var ta = doc.querySelector('textarea');
      if (ta) text = ta.value;
    } catch (e) {
      text = input
        .replace(/&#(\d{1,7});/g, function (_, d) { return String.fromCodePoint(parseInt(d, 10)); })
        .replace(/&#[xX]([0-9A-Fa-f]{1,6});/g, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
    }
    return { text: text, bytes: null, meta: { variant: 'html-entity' } };
  }

  function htmlEntityEncode(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ================================================================ *
   * Unicode / Hex 转义序列
   * ================================================================ */

  function unicodeEscapeDecode(input) {
    var text = input
      .replace(/\\u\{([0-9A-Fa-f]{1,6})\}/g, function (_, h) { return safeFromCodePoint(parseInt(h, 16)); })
      .replace(/\\u([0-9A-Fa-f]{4})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/\\x([0-9A-Fa-f]{2})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/\\U([0-9A-Fa-f]{8})/g, function (_, h) { return safeFromCodePoint(parseInt(h, 16)); });
    return { text: text, bytes: null, meta: { variant: 'unicode-escape' } };
  }

  function safeFromCodePoint(cp) {
    try { return String.fromCodePoint(cp); } catch (e) { return '\ufffd'; }
  }

  /* ================================================================ *
   * ROT13
   * ================================================================ */

  /* ROT13 是对合运算：加密与解密是同一个变换。
   * 拆出纯字符串版本 rot13Str 供 encode 使用，rot13 保持 decode 的统一返回约定。 */
  function rot13Str(input) {
    input = String(input);
    var out = '';
    for (var i = 0; i < input.length; i++) {
      var c = input.charCodeAt(i);
      if (c >= 65 && c <= 90) out += String.fromCharCode(((c - 65 + 13) % 26) + 65);
      else if (c >= 97 && c <= 122) out += String.fromCharCode(((c - 97 + 13) % 26) + 97);
      else out += input[i];
    }
    return out;
  }

  function rot13(input) {
    var out = rot13Str(input);
    return { text: out, bytes: U.utf8ToBytes(out), meta: { variant: 'rot13' } };
  }

  /* ================================================================ *
   * JWT
   * ================================================================ */

  function jwtDecode(input) {
    var parts = stripWs(input).split('.');
    if (parts.length < 2) throw new Error('jwt: 段数不足');
    var header = null;
    var payload = null;
    var rawHeader = '';
    var rawPayload = '';
    try {
      rawHeader = base64Decode(parts[0]).text;
      header = JSON.parse(rawHeader);
    } catch (e) { header = null; rawHeader = ''; }
    try {
      rawPayload = base64Decode(parts[1]).text;
      payload = JSON.parse(rawPayload);
    } catch (e) { payload = null; rawPayload = ''; }
    if (!header && !payload) throw new Error('jwt: 无法解析 header/payload');

    var lines = [];
    lines.push('=== JWT ===');
    lines.push('算法 alg: ' + (header && header.alg ? header.alg : '(未知)'));
    if (header && header.typ) lines.push('类型 typ: ' + header.typ);
    if (header && header.kid) lines.push('密钥 ID kid: ' + header.kid);
    lines.push('');
    lines.push('--- Header ---');
    lines.push(header ? JSON.stringify(header, null, 2) : rawHeader);
    lines.push('');
    lines.push('--- Payload ---');
    lines.push(payload ? JSON.stringify(payload, null, 2) : rawPayload);
    if (payload && typeof payload === 'object') {
      var exp = payload.exp || payload.iat || payload.nbf;
      if (exp) {
        lines.push('');
        lines.push('--- 时间字段 ---');
        ['iat', 'nbf', 'exp'].forEach(function (k) {
          if (payload[k]) {
            var d = new Date(payload[k] * 1000);
            lines.push(k + ': ' + d.toISOString() + '  (' + d.toLocaleString() + ')');
          }
        });
      }
    }
    lines.push('');
    lines.push('--- Signature (未校验) ---');
    lines.push(parts[2] || '(无)');

    return {
      text: lines.join('\n'),
      bytes: null,
      meta: {
        variant: 'jwt',
        structured: { header: header, payload: payload, signature: parts[2] || '' }
      }
    };
  }

  /* ================================================================ *
   * 压缩流嗅探 + 解压
   * ================================================================ */

  function sniffCompression(bytes) {
    if (!bytes || bytes.length < 2) return null;
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) return 'gzip';
    if (bytes[0] === 0x78 && (bytes[1] === 0x01 || bytes[1] === 0x9c || bytes[1] === 0xda || bytes[1] === 0x5e)) return 'zlib';
    if (bytes[0] === 0x42 && bytes[1] === 0x5a && bytes[2] === 0x68) return 'bzip2';
    if (bytes[0] === 0x28 && bytes[1] === 0xb5 && bytes[2] === 0x2f && bytes[3] === 0xfd) return 'zstd';
    return null;
  }

  function decompressBytes(bytes, kind) {
    var fmt = kind === 'zlib' ? 'deflate' : kind;
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('当前环境不支持 DecompressionStream'));
    }
    if (fmt !== 'gzip' && fmt !== 'deflate' && fmt !== 'deflate-raw') {
      return Promise.reject(new Error('不支持的压缩格式: ' + kind));
    }
    var ds = new DecompressionStream(fmt);
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (buf) {
      return new Uint8Array(buf);
    });
  }

  /* ================================================================ *
   * 编码（用于手动工具面板）
   * ================================================================ */

  function caesarEncode(text, shift) {
    var out = '';
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c >= 65 && c <= 90) out += String.fromCharCode(((c - 65 + shift + 26 * 100) % 26) + 65);
      else if (c >= 97 && c <= 122) out += String.fromCharCode(((c - 97 + shift + 26 * 100) % 26) + 97);
      else out += text[i];
    }
    return out;
  }

  NS.codecs = {
    base64: {
      decode: base64Decode,
      encodeBytes: base64EncodeBytes,
      encode: base64Encode
    },
    base58: {
      decode: base58Decode,
      encode: base58Encode
    },
    base32: {
      decode: base32Decode,
      encode: base32Encode
    },
    hex: {
      decode: hexDecode,
      encode: hexEncode
    },
    ascii85: {
      decode: ascii85Decode
    },
    url: {
      decode: urlDecode,
      encode: function (t) { return encodeURIComponent(t); }
    },
    htmlEntity: {
      decode: htmlEntityDecode,
      encode: htmlEntityEncode
    },
    unicodeEscape: {
      decode: unicodeEscapeDecode,
      encode: function (t) {
        var out = '';
        for (var i = 0; i < t.length; i++) {
          var c = t.charCodeAt(i);
          if (c < 128 && c >= 32 && c !== 92) out += t[i];
          else out += '\\u' + ('0000' + c.toString(16)).slice(-4);
        }
        return out;
      }
    },
    rot13: { decode: rot13, encode: rot13Str },
    jwt: { decode: jwtDecode },
    bytesToBase64: base64EncodeBytes,
    sniffCompression: sniffCompression,
    decompressBytes: decompressBytes
  };
})();
