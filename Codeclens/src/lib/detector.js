/* CodecLens - detector.js
 * 候选提取 + 解码打分 + 链式解码。
 * 挂载到 globalThis.CodecLens.detector
 */
(function () {
  'use strict';

  var NS = (globalThis.CodecLens = globalThis.CodecLens || {});
  if (NS.detector) return;
  var U = NS.util;
  var C = NS.codecs;

  var TYPE_LABEL = {
    base64: 'Base64',
    base64url: 'Base64URL',
    base58: 'Base58',
    base32: 'Base32',
    hex: 'Hex',
    ascii85: 'Ascii85',
    jwt: 'JWT',
    url: 'URL 编码',
    htmlEntity: 'HTML 实体',
    unicodeEscape: 'Unicode 转义',
    rot13: 'ROT13',
    dataUri: 'Data URI',
    gzip: '压缩流',
    unknown: '未知编码'
  };

  /* ================================================================ *
   * 正则（用 new RegExp 构造，避免旧引擎在解析期直接抛错）
   * ================================================================ */

  function safeRe(source, flags, fallback) {
    try { return new RegExp(source, flags); }
    catch (e) { return fallback ? new RegExp(fallback, flags) : null; }
  }

  var RE = {
    jwt: safeRe('\\beyJ[A-Za-z0-9_-]{4,}\\.[A-Za-z0-9_-]{4,}\\.[A-Za-z0-9_-]*', 'g'),
    dataUri: safeRe('data:[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]{8,}', 'g'),
    urlEnc: safeRe('(?:%[0-9A-Fa-f]{2}){3,}', 'g'),
    htmlEnt: safeRe('(?:&#[0-9]{1,7};|&#[xX][0-9A-Fa-f]{1,6};|&[a-zA-Z][a-zA-Z0-9]{1,31};){2,}', 'g'),
    uniEsc: safeRe('(?:\\\\u\\{[0-9A-Fa-f]{1,6}\\}|\\\\u[0-9A-Fa-f]{4}|\\\\x[0-9A-Fa-f]{2}){2,}', 'g'),
    token: safeRe('(?<![A-Za-z0-9+/_=-])[A-Za-z0-9+/_-]{8,}={0,2}(?![A-Za-z0-9+/_=-])', 'g',
      '[A-Za-z0-9+/_-]{8,}={0,2}'),
    base32: safeRe('(?<![A-Z2-7=])[A-Z2-7]{16,}={0,6}(?![A-Z2-7=])', 'g',
      '[A-Z2-7]{16,}={0,6}'),
    rot13: safeRe('\\b[A-Za-z]{6,}\\b', 'g')
  };

  var PRIORITY = {
    jwt: 100,
    dataUri: 95,
    unicodeEscape: 80,
    htmlEntity: 80,
    url: 80,
    base32: 60,
    token: 50,
    rot13: 10
  };

  /* ================================================================ *
   * 候选提取
   * ================================================================ */

  function runRegex(re, text, type, out, minLength) {
    if (!re) return;
    re.lastIndex = 0;
    var m;
    var guard = 0;
    while ((m = re.exec(text)) !== null) {
      if (++guard > 5000) break;
      var raw = m[0];
      if (!raw) { re.lastIndex++; continue; }
      if (minLength && raw.length < minLength && type !== 'jwt' && type !== 'dataUri') continue;
      out.push({
        start: m.index,
        end: m.index + raw.length,
        raw: raw,
        hint: type,
        priority: PRIORITY[type] || 0
      });
    }
  }

  /* HTML 实体：实体之间常被普通文本隔开（&lt;div class=&quot;x&quot;&gt;），
   * 单纯的「连续实体」正则抓不到。改为：先找出所有实体标记，
   * 把 80 字符窗口内相邻的实体串成一段，整段作为候选。 */
  var ENTITY_RE = /&#[0-9]{1,7};|&#[xX][0-9A-Fa-f]{1,6};|&[a-zA-Z][a-zA-Z0-9]{1,31};/g;
  var ENTITY_GAP = 80;

  function collectEntityRuns(text, out, minLength) {
    ENTITY_RE.lastIndex = 0;
    var marks = [];
    var m;
    var guard = 0;
    while ((m = ENTITY_RE.exec(text)) !== null) {
      if (++guard > 5000) break;
      marks.push({ start: m.index, end: m.index + m[0].length });
    }
    if (marks.length < 2) return;
    var need = Math.max(6, minLength || 12);
    var i = 0;
    while (i < marks.length) {
      var j = i;
      while (j + 1 < marks.length && marks[j + 1].start - marks[j].end <= ENTITY_GAP) j++;
      if (j > i) {
        var start = marks[i].start;
        var end = marks[j].end;
        var raw = text.slice(start, end);
        if (raw.length >= need) {
          out.push({
            start: start,
            end: end,
            raw: raw,
            hint: 'htmlEntity',
            priority: PRIORITY.htmlEntity || 0
          });
        }
      }
      i = j + 1;
    }
  }

  function collectCandidates(text, settings) {
    var out = [];
    var types = settings.types || {};
    var minLength = Math.max(6, settings.minLength || 12);

    if (types.jwt) runRegex(RE.jwt, text, 'jwt', out, 0);
    if (types.dataUri) runRegex(RE.dataUri, text, 'dataUri', out, 0);
    if (types.url) runRegex(RE.urlEnc, text, 'url', out, minLength);
    if (types.htmlEntity) collectEntityRuns(text, out, minLength);
    if (types.unicodeEscape) runRegex(RE.uniEsc, text, 'unicodeEscape', out, minLength);
    if (types.base32) runRegex(RE.base32, text, 'base32', out, minLength);
    if (types.base64 || types.base64url || types.base58 || types.hex) {
      runRegex(RE.token, text, 'token', out, minLength);
    }
    if (types.rot13) runRegex(RE.rot13, text, 'rot13', out, Math.max(minLength, 12));

    // 去重：按起点升序、长度降序、优先级降序，贪心选取互不重叠的候选
    out.sort(function (a, b) {
      if (a.start !== b.start) return a.start - b.start;
      if (a.end !== b.end) return b.end - a.end;
      return b.priority - a.priority;
    });

    var picked = [];
    var lastEnd = -1;
    for (var i = 0; i < out.length; i++) {
      var c = out[i];
      if (c.start < lastEnd) continue;
      picked.push(c);
      lastEnd = c.end;
    }
    return picked;
  }

  /* ================================================================ *
   * 打分
   * ================================================================ */

  var MIN_SCORE = 52;

  function scoreDecoded(decoded, raw, type) {
    if (decoded == null || decoded === '' || decoded === raw) return -1e9;

    var pr = U.printableRatio(decoded);
    if (pr < 0.55) return -1e9;

    /* 乱码闸门：随机字节流经 latin1 兜底后仍会「看起来可打印」，
     * 但会留下大量 U+FFFD 与孤立的符号字符。用质量画像把它们挡掉。 */
    var q = U.textQuality(decoded);
    if (q.badRatio > 0.08) return -1e9;
    if (q.readable < 0.70) return -1e9;

    var s = 0;
    s += pr * 45;
    if (pr >= 0.99) s += 8;

    var t = decoded.trim();

    if ((t.charAt(0) === '{' || t.charAt(0) === '[') && /[\]}]$/.test(t)) {
      try { JSON.parse(t); s += 50; } catch (e) { s -= 6; }
    }
    if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//.test(t)) s += 42;
    if (/^[\w.\-]+\.[a-zA-Z]{2,}(\/\S*)?$/.test(t)) s += 18;
    if (/[a-zA-Z_][\w]*\s*[:=]/.test(t)) s += 12;

    var letters = (decoded.match(/[A-Za-z\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
    var lr = letters / decoded.length;
    if (lr > 0.65) s += 22;
    else if (lr > 0.4) s += 10;

    if (/[ \t]/.test(decoded)) s += 10;
    if (/[,;:!?"'(){}\[\]]/.test(decoded)) s += 8;

    s -= U.countControlChars(decoded) * 7;

    if (decoded.length < 3) s -= 25;
    else if (decoded.length < 6) s -= 8;

    if (type === 'hex') s -= 10;
    if (type === 'base58') s -= 6;
    if (type === 'ascii85') s -= 20;
    if (type === 'base32') s -= 4;
    if (type === 'rot13') s -= 15;
    if (type === 'base64' || type === 'base64url') s += 4;
    if (type === 'jwt') s += 35;
    if (type === 'url' || type === 'htmlEntity' || type === 'unicodeEscape') s += 28;

    return s;
  }

  /* ================================================================ *
   * 单 token 解码
   * ================================================================ */

  function isBase64ish(raw) { return /^[A-Za-z0-9+/_-]+={0,2}$/.test(raw); }
  function isHexish(raw) { return /^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0; }
  function isBase32ish(raw) { return /^[A-Z2-7]+=*$/.test(raw); }
  function isBase58ish(raw) { return /^[1-9A-HJ-NP-Za-km-z]+$/.test(raw); }

  function tryOne(fn, raw, type, settings) {
    if (!settings.types[type]) return null;
    var res;
    try { res = fn(raw); } catch (e) { return null; }
    if (!res || typeof res.text !== 'string') return null;
    var score = scoreDecoded(res.text, raw, type);
    if (score < MIN_SCORE) return null;
    var meta = res.meta || {};
    /* Base64URL 与 Base64 共用解码器，但展示时区分开更有用 */
    var realType = (type === 'base64' && meta.variant === 'base64url') ? 'base64url' : type;
    if (!settings.types[realType]) return null;
    return {
      type: realType,
      label: TYPE_LABEL[realType] || realType,
      raw: raw,
      text: res.text,
      bytes: res.bytes || null,
      meta: meta,
      score: score
    };
  }

  function decodeCandidate(cand, settings) {
    var raw = cand.raw;
    var results = [];
    var t = settings.types || {};

    if (cand.hint === 'jwt' && t.jwt) {
      var rj = tryOne(C.jwt.decode, raw, 'jwt', settings);
      if (rj) return rj;
    }
    if (cand.hint === 'dataUri' && t.dataUri) {
      var rdu = tryDataUri(raw, settings);
      if (rdu) return rdu;
    }
    if (cand.hint === 'url' && t.url) {
      var ru = tryOne(C.url.decode, raw, 'url', settings);
      if (ru) return ru;
    }
    if (cand.hint === 'htmlEntity' && t.htmlEntity) {
      var rh = tryOne(C.htmlEntity.decode, raw, 'htmlEntity', settings);
      if (rh) return rh;
    }
    if (cand.hint === 'unicodeEscape' && t.unicodeEscape) {
      var re2 = tryOne(C.unicodeEscape.decode, raw, 'unicodeEscape', settings);
      if (re2) return re2;
    }
    if (cand.hint === 'rot13' && t.rot13) {
      var rr = tryOne(C.rot13.decode, raw, 'rot13', settings);
      if (rr) return rr;
    }

    // token 型：依次尝试 base64 / base64url / base58 / base32 / hex / ascii85
    if (isBase64ish(raw)) {
      if (t.base64 || t.base64url) {
        var rb = tryOne(C.base64.decode, raw, 'base64', settings);
        if (rb) {
          rb.type = rb.meta && rb.meta.variant === 'base64url' ? 'base64url' : 'base64';
          rb.label = TYPE_LABEL[rb.type];
          results.push(rb);
        }
      }
      if (t.base58 && isBase58ish(raw) && raw.length >= 12) {
        var r5 = tryOne(C.base58.decode, raw, 'base58', settings);
        if (r5) results.push(r5);
      }
    }
    if (t.hex && isHexish(raw) && raw.length >= 16) {
      var rhx = tryOne(C.hex.decode, raw, 'hex', settings);
      if (rhx) results.push(rhx);
    }
    if (t.base32 && isBase32ish(raw) && raw.length >= 16) {
      var r32 = tryOne(C.base32.decode, raw, 'base32', settings);
      if (r32) results.push(r32);
    }
    if (t.ascii85 && /^[!-u]{10,}$/.test(raw)) {
      var r85 = tryOne(C.ascii85.decode, raw, 'ascii85', settings);
      if (r85) results.push(r85);
    }

    if (!results.length) return null;
    results.sort(function (a, b) { return b.score - a.score; });
    return results[0];
  }

  function tryDataUri(raw, settings) {
    var m = raw.match(/^data:([^;,]*);base64,(.*)$/);
    if (!m) return null;
    var mime = m[1] || 'application/octet-stream';
    var bytes;
    try { bytes = C.base64.decode(m[2]).bytes; } catch (e) { return null; }
    if (!bytes) return null;
    var kind = C.sniffCompression(bytes);
    var head = '';
    var text = '';
    if (kind) {
      head = '压缩类型: ' + kind + ' (可展开)';
    }
    if (mime.indexOf('text/') === 0 || /json|javascript|xml|svg|html/.test(mime)) {
      text = U.bytesToUtf8(bytes, false);
    } else {
      text = hexdump(bytes, 256);
    }
    var score = scoreDecoded(text, raw, 'dataUri') + 20;
    return {
      type: 'dataUri',
      label: 'Data URI (' + mime + ')',
      raw: raw,
      text: (head ? head + '\n\n' : '') + text,
      bytes: bytes,
      meta: { mime: mime, compression: kind },
      score: score
    };
  }

  /* ================================================================ *
   * 链式解码
   * ================================================================ */

  function deepDecode(first, settings) {
    var chain = [first];
    var maxDepth = Math.max(1, Math.min(8, settings.maxDepth || 4));
    var current = first;

    for (var depth = 1; depth < maxDepth; depth++) {
      var text = current.text;
      if (!text || text.length < 8 || text.length > 200000) break;
      var next = decodeWholeText(text, settings, current.type);
      if (!next) break;
      if (next.text === current.text) break;
      chain.push(next);
      current = next;
    }
    return chain;
  }

  /* 把整段文本当作一个编码串来解（链式解码专用，允许更长更宽松） */
  function decodeWholeText(text, settings, prevType) {
    var trimmed = text.trim();
    if (!trimmed) return null;
    var fake = { start: 0, end: trimmed.length, raw: trimmed, hint: 'token', priority: 50 };
    if (trimmed.length < 8) return null;

    var cands = [];
    var r = decodeCandidate(fake, settings);
    if (r) cands.push(r);
    // 再单独试一次 URL / 实体 / unicode 转义
    ['url', 'htmlEntity', 'unicodeEscape'].forEach(function (t) {
      if (!settings.types[t]) return;
      if (t === 'url' && !/%[0-9A-Fa-f]{2}/.test(trimmed)) return;
      if (t === 'htmlEntity' && !/&[#a-zA-Z]/.test(trimmed)) return;
      if (t === 'unicodeEscape' && !/\\\\?u[0-9A-Fa-f{]/.test(trimmed)) return;
      var rr = tryOne(C[t].decode, trimmed, t, settings);
      if (rr) cands.push(rr);
    });

    cands.sort(function (a, b) { return b.score - a.score; });
    var best = cands[0] || null;
    if (!best) return null;
    if (prevType && best.type === prevType && best.text === text) return null;
    return best;
  }

  /* ================================================================ *
   * 主入口
   * ================================================================ */

  function detectText(text, settings) {
    if (!text || text.length < (settings.minLength || 12)) return [];
    var cands = collectCandidates(text, settings);
    var out = [];
    for (var i = 0; i < cands.length; i++) {
      var hit = decodeCandidate(cands[i], settings);
      if (!hit) continue;
      hit.start = cands[i].start;
      hit.end = cands[i].end;
      hit.hint = cands[i].hint;
      hit.chain = deepDecode(hit, settings);
      out.push(hit);
    }
    return out;
  }

  /* 手动解码：对整段输入尝试所有解码器，返回全部命中 */
  function decodeAny(text, settings) {
    var results = [];
    var map = [
      ['jwt', 'jwt', /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/],
      ['base64', 'base64', /^[A-Za-z0-9+/_-]+={0,2}$/],
      ['base58', 'base58', /^[1-9A-HJ-NP-Za-km-z]+$/],
      ['base32', 'base32', /^[A-Z2-7]+=*$/],
      ['hex', 'hex', /^[0-9a-fA-F]+$/],
      ['url', 'url', /%[0-9A-Fa-f]{2}/],
      ['htmlEntity', 'htmlEntity', /&[#a-zA-Z]/],
      ['unicodeEscape', 'unicodeEscape', /\\\\?u[0-9A-Fa-f{]/],
      ['ascii85', 'ascii85', /^[!-u]{6,}$/],
      ['rot13', 'rot13', /^[A-Za-z\s]{4,}$/]
    ];
    var t = text.trim();
    if (!t) return results;

    for (var i = 0; i < map.length; i++) {
      var type = map[i][0];
      var key = map[i][1];
      var test = map[i][2];
      if (!settings.types[type] && type !== 'jwt') continue;
      if (!test.test(t)) continue;
      var hit = tryOne(C[key].decode, t, type, settings);
      if (hit) {
        hit.chain = deepDecode(hit, settings);
        results.push(hit);
      }
    }

    // 压缩流：先 base64 解出字节再嗅探
    var b = null;
    try { b = C.base64.decode(t); } catch (e) { b = null; }
    if (b && b.bytes) {
      var kind = C.sniffCompression(b.bytes);
      if (kind) {
        results.push({
          type: 'gzip',
          label: 'Base64 + ' + kind,
          raw: t,
          text: '(点击"展开压缩流"解压)',
          bytes: b.bytes,
          meta: { compression: kind },
          score: 200,
          compressed: true,
          chain: []
        });
      }
    }

    results.sort(function (a, b2) { return b2.score - a.score; });
    return results;
  }

  /* ================================================================ *
   * hexdump
   * ================================================================ */

  function hexdump(bytes, maxBytes) {
    maxBytes = maxBytes || 512;
    var n = Math.min(bytes.length, maxBytes);
    var lines = [];
    for (var i = 0; i < n; i += 16) {
      var chunk = bytes.subarray(i, Math.min(i + 16, bytes.length));
      var hex = '';
      var ascii = '';
      for (var j = 0; j < 16; j++) {
        if (j < chunk.length) {
          var b = chunk[j];
          hex += ('0' + b.toString(16)).slice(-2) + (j === 7 ? '  ' : ' ');
          ascii += (b >= 32 && b < 127) ? String.fromCharCode(b) : '.';
        } else {
          hex += '   ' + (j === 7 ? '  ' : '');
        }
      }
      lines.push(('0000000' + i.toString(16)).slice(-8) + '  ' + hex + ' |' + ascii + '|');
    }
    if (bytes.length > maxBytes) lines.push('... 共 ' + bytes.length + ' 字节');
    return lines.join('\n');
  }

  NS.detector = {
    TYPE_LABEL: TYPE_LABEL,
    MIN_SCORE: MIN_SCORE,
    detectText: detectText,
    decodeAny: decodeAny,
    decodeCandidate: decodeCandidate,
    decodeWholeText: decodeWholeText,
    deepDecode: deepDecode,
    collectCandidates: collectCandidates,
    scoreDecoded: scoreDecoded,
    hexdump: hexdump
  };
})();
