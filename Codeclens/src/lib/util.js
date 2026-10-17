/* CodecLens - util.js
 * 通用工具函数 + 默认配置。
 * 挂载到 globalThis.CodecLens.util
 */
(function () {
  'use strict';

  var NS = (globalThis.CodecLens = globalThis.CodecLens || {});
  if (NS.util) return;

  /* ---------------------------------------------------------------- *
   * 默认配置
   * ---------------------------------------------------------------- */
  var DEFAULT_SETTINGS = {
    enabled: true,
    autoScan: true,
    mode: 'highlight',      // highlight | replace | off
    minLength: 12,
    maxDepth: 4,
    scanDynamic: true,
    scanShadow: true,
    showBadge: true,
    skipCodeBlocks: false,
    types: {
      base64: true,
      base64url: true,
      base58: true,
      base32: true,
      hex: true,
      ascii85: false,
      jwt: true,
      url: true,
      htmlEntity: true,
      unicodeEscape: true,
      rot13: false,
      dataUri: true
    },
    blacklist: []
  };

  /* ---------------------------------------------------------------- *
   * 编解码辅助
   * ---------------------------------------------------------------- */

  function bytesToUtf8(bytes, fatal) {
    var dec = new TextDecoder('utf-8', { fatal: !!fatal });
    return dec.decode(bytes);
  }

  function utf8ToBytes(str) {
    return new TextEncoder().encode(str);
  }

  function bytesToLatin1(bytes) {
    var out = '';
    var CHUNK = 0x8000;
    for (var i = 0; i < bytes.length; i += CHUNK) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return out;
  }

  /* 可打印字符比例：把 CJK / 常规标点视为可打印，控制字符视为不可打印。
   * 关键点：U+FFFD（UTF-8 解码失败产生的替换字符）必须算作不可打印，
   * 否则随机字节流会被误判为「可读文本」。 */
  function printableRatio(str) {
    if (!str) return 0;
    var ok = 0;
    var total = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      total++;
      if (c === 0xfffd) continue;
      if (c === 9 || c === 10 || c === 13) { ok++; continue; }
      if (c >= 32 && c !== 127 && !(c >= 0x80 && c <= 0x9f)) ok++;
    }
    return total ? ok / total : 0;
  }

  /* 文本质量画像：把解码结果拆成 ascii / cjk / latin / bad 四类。
   * 用来区分「真正的可读文本」与「随机字节流被 latin1 兜底后形成的乱码」。 */
  function textQuality(str) {
    var q = { n: 0, ascii: 0, cjk: 0, latin: 0, bad: 0, asciiRatio: 0, cjkRatio: 0, latinRatio: 0, badRatio: 0, readable: 0 };
    if (!str) return q;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      q.n++;
      if (c === 0xfffd) { q.bad++; continue; }                      // 解码失败
      if (c === 9 || c === 10 || c === 13) { q.ascii++; continue; } // 换行/制表
      if (c >= 32 && c <= 126) { q.ascii++; continue; }             // 可见 ASCII
      if (c >= 0x4e00 && c <= 0x9fff) { q.cjk++; continue; }        // 中日韩统一表意
      if (c >= 0x3000 && c <= 0x303f) { q.cjk++; continue; }        // CJK 标点
      if (c >= 0x3040 && c <= 0x30ff) { q.cjk++; continue; }        // 假名
      if (c >= 0xac00 && c <= 0xd7af) { q.cjk++; continue; }        // 谚文
      if (c >= 0xff01 && c <= 0xff5e) { q.cjk++; continue; }        // 全角 ASCII
      if (c === 0x2013 || c === 0x2014 || c === 0x2018 || c === 0x2019 ||
          c === 0x201c || c === 0x201d || c === 0x2026 || c === 0x2022 ||
          c === 0x00a0 || c === 0x00b7 || c === 0x00b0 || c === 0x00b1) { q.latin++; continue; }
      if (c >= 0x00c0 && c <= 0x024f) { q.latin++; continue; }      // 拉丁扩展（é ü ñ ß …）
      q.bad++;                                                       // 其余一律视为可疑
    }
    q.asciiRatio = q.ascii / q.n;
    q.cjkRatio = q.cjk / q.n;
    q.latinRatio = q.latin / q.n;
    q.badRatio = q.bad / q.n;
    q.readable = q.asciiRatio + q.cjkRatio + q.latinRatio * 0.4;
    return q;
  }

  function countControlChars(str) {
    var m = str.match(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g);
    return m ? m.length : 0;
  }

  /* 香农熵（比特/字符），用于判断随机性 */
  function entropy(str) {
    if (!str) return 0;
    var freq = Object.create(null);
    for (var i = 0; i < str.length; i++) {
      var c = str[i];
      freq[c] = (freq[c] || 0) + 1;
    }
    var e = 0;
    var n = str.length;
    for (var k in freq) {
      var p = freq[k] / n;
      e -= p * Math.log2(p);
    }
    return e;
  }

  /* 是否像自然语言 / 结构化文本 */
  function looksLikeText(str) {
    if (!str) return false;
    var letters = (str.match(/[A-Za-z\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
    var ratio = letters / str.length;
    if (ratio > 0.5) return true;
    if (/^[\s\S]*[{}\[\]"':,;][\s\S]*$/.test(str) && printableRatio(str) > 0.9) return true;
    return false;
  }

  /* ---------------------------------------------------------------- *
   * DOM / 字符串辅助
   * ---------------------------------------------------------------- */

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function truncate(str, max) {
    if (str.length <= max) return str;
    return str.slice(0, max) + '\u2026 (' + str.length + ' 字符)';
  }

  function debounce(fn, wait) {
    var t = null;
    return function () {
      var args = arguments;
      var self = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, args); }, wait);
    };
  }

  function throttle(fn, wait) {
    var last = 0;
    var timer = null;
    return function () {
      var args = arguments;
      var self = this;
      var now = Date.now();
      var remain = wait - (now - last);
      if (remain <= 0) {
        last = now;
        fn.apply(self, args);
      } else if (!timer) {
        timer = setTimeout(function () {
          timer = null;
          last = Date.now();
          fn.apply(self, args);
        }, remain);
      }
    };
  }

  /* 读取设置（带默认值合并） */
  function loadSettings() {
    return new Promise(function (resolve) {
      try {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) {
          resolve(clone(DEFAULT_SETTINGS));
          return;
        }
        chrome.storage.sync.get({ settings: null }, function (res) {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve(clone(DEFAULT_SETTINGS));
            return;
          }
          resolve(mergeSettings(res && res.settings));
        });
      } catch (e) {
        resolve(clone(DEFAULT_SETTINGS));
      }
    });
  }

  function mergeSettings(saved) {
    var out = clone(DEFAULT_SETTINGS);
    if (!saved || typeof saved !== 'object') return out;
    Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
      if (k === 'types') return;
      if (saved[k] !== undefined && saved[k] !== null) out[k] = saved[k];
    });
    if (saved.types && typeof saved.types === 'object') {
      Object.keys(DEFAULT_SETTINGS.types).forEach(function (k) {
        if (typeof saved.types[k] === 'boolean') out.types[k] = saved.types[k];
      });
    }
    if (!Array.isArray(out.blacklist)) out.blacklist = [];
    return out;
  }

  function saveSettings(settings) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.sync.set({ settings: settings }, function () { resolve(true); });
      } catch (e) {
        resolve(false);
      }
    });
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function hostMatchesBlacklist(host, blacklist) {
    if (!blacklist || !blacklist.length) return false;
    for (var i = 0; i < blacklist.length; i++) {
      var pat = String(blacklist[i] || '').trim().toLowerCase();
      if (!pat) continue;
      var h = String(host || '').toLowerCase();
      if (pat.indexOf('*') >= 0) {
        var re = new RegExp('^' + pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
        if (re.test(h)) return true;
      } else if (h === pat || h.endsWith('.' + pat)) {
        return true;
      }
    }
    return false;
  }

  NS.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  NS.util = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    bytesToUtf8: bytesToUtf8,
    utf8ToBytes: utf8ToBytes,
    bytesToLatin1: bytesToLatin1,
    printableRatio: printableRatio,
    textQuality: textQuality,
    countControlChars: countControlChars,
    entropy: entropy,
    looksLikeText: looksLikeText,
    escapeHtml: escapeHtml,
    truncate: truncate,
    debounce: debounce,
    throttle: throttle,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    mergeSettings: mergeSettings,
    clone: clone,
    hostMatchesBlacklist: hostMatchesBlacklist
  };
})();
