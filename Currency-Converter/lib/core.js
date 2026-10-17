/*!
 * CurrencyCore -- 货币识别与汇率换算核心（纯逻辑，无 DOM 依赖）
 * 可同时运行于 浏览器(globalThis.CurrencyCore) / Node(module.exports)
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') module.exports = factory();
  else root.CurrencyCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ======================================================================
   * 1. 货币元数据
   *    格式: 代码|中文名|符号(逗号分隔,长符号在前)|建议 locale
   * ==================================================================== */
  var RAW = [
    'USD|美元|US$,USD,$,美元,美金|en-US',
    'EUR|欧元|€,EUR,欧元|de-DE',
    'CNY|人民币|CN¥,¥,￥,CNY,RMB,人民币,元,圆|zh-CN',
    'JPY|日元|JP¥,¥,JPY,円,日元,日圆|ja-JP',
    'GBP|英镑|£,GBP,英镑|en-GB',
    'HKD|港元|HK$,HKD,港币,港元|zh-HK',
    'TWD|新台币|NT$,TWD,新台币,台币|zh-TW',
    'KRW|韩元|KRW,₩,韩元|ko-KR',
    'SGD|新加坡元|S$,SG$,SGD,新加坡元,新币|en-SG',
    'AUD|澳元|A$,AU$,AUD,澳元,澳币|en-AU',
    'CAD|加元|C$,CA$,CAD,加元,加币|en-CA',
    'NZD|新西兰元|NZ$,NZD,纽元|en-NZ',
    'CHF|瑞士法郎|CHF,法郎|de-CH',
    'SEK|瑞典克朗|SEK,kr|sv-SE',
    'NOK|挪威克朗|NOK,kr|nb-NO',
    'DKK|丹麦克朗|DKK,kr|da-DK',
    'ISK|冰岛克朗|ISK,kr|is-IS',
    'PLN|波兰兹罗提|PLN,zl,zł|pl-PL',
    'CZK|捷克克朗|CZK,Kč|cs-CZ',
    'HUF|匈牙利福林|HUF|hu-HU',
    'RON|罗马尼亚列伊|RON|ro-RO',
    'BGN|保加利亚列弗|BGN|bg-BG',
    'HRK|克罗地亚库纳|HRK|hr-HR',
    'RSD|塞尔维亚第纳尔|RSD|sr-RS',
    'TRY|土耳其里拉|₺,TRY,里拉|tr-TR',
    'UAH|乌克兰格里夫纳|UAH,₴,грн|uk-UA',
    'RUB|俄罗斯卢布|RUB,₽,руб.,руб,卢布|ru-RU',
    'ILS|以色列新谢克尔|ILS,₪|he-IL',
    'SAR|沙特里亚尔|SAR|ar-SA',
    'AED|阿联酋迪拉姆|AED|ar-AE',
    'QAR|卡塔尔里亚尔|QAR|ar-QA',
    'KWD|科威特第纳尔|KWD|ar-KW',
    'BHD|巴林第纳尔|BHD|ar-BH',
    'OMR|阿曼里亚尔|OMR|ar-OM',
    'JOD|约旦第纳尔|JOD|ar-JO',
    'EGP|埃及镑|EGP|ar-EG',
    'MAD|摩洛哥迪拉姆|MAD|ar-MA',
    'DZD|阿尔及利亚第纳尔|DZD|ar-DZ',
    'TND|突尼斯第纳尔|TND|ar-TN',
    'LBP|黎巴嫩镑|LBP|ar-LB',
    'THB|泰铢|THB,฿,泰铢|th-TH',
    'VND|越南盾|VND,₫,越南盾,盾|vi-VN',
    'IDR|印尼盾|IDR,Rp,印尼盾|id-ID',
    'MYR|马来西亚林吉特|MYR,RM|ms-MY',
    'PHP|菲律宾比索|PHP,₱,比索|en-PH',
    'INR|印度卢比|INR,₹,₨,Rs.,Rs,卢比|en-IN',
    'PKR|巴基斯坦卢比|PKR|en-PK',
    'LKR|斯里兰卡卢比|LKR|si-LK',
    'NPR|尼泊尔卢比|NPR|ne-NP',
    'BDT|孟加拉塔卡|BDT,৳|bn-BD',
    'KZT|哈萨克斯坦坚戈|KZT,₸|kk-KZ',
    'UZS|乌兹别克斯坦苏姆|UZS|uz-UZ',
    'AFN|阿富汗尼|AFN,؋|fa-AF',
    'IRR|伊朗里亚尔|IRR,﷼|fa-IR',
    'YER|也门里亚尔|YER|ar-YE',
    'AZN|阿塞拜疆马纳特|AZN,₼|az-AZ',
    'GEL|格鲁吉亚拉里|GEL,₾|ka-GE',
    'AMD|亚美尼亚德拉姆|AMD,֏|hy-AM',
    'MNT|蒙古图格里克|MNT,₮|mn-MN',
    'LAK|老挝基普|LAK,₭|lo-LA',
    'KHR|柬埔寨瑞尔|KHR,៛|km-KH',
    'MMK|缅甸元|MMK|my-MM',
    'BRL|巴西雷亚尔|R$,BRL|pt-BR',
    'MXN|墨西哥比索|MX$,MXN|es-MX',
    'ARS|阿根廷比索|ARS|es-AR',
    'CLP|智利比索|CLP|es-CL',
    'COP|哥伦比亚比索|COP|es-CO',
    'PEN|秘鲁索尔|PEN,S/.|es-PE',
    'UYU|乌拉圭比索|UYU|es-UY',
    'BOB|玻利维亚诺|BOB,Bs.|es-BO',
    'PYG|巴拉圭瓜拉尼|PYG,₲|es-PY',
    'CRC|哥斯达黎加科朗|CRC,₡|es-CR',
    'GTQ|危地马拉格查尔|GTQ|es-GT',
    'DOP|多米尼加比索|DOP,RD$|es-DO',
    'PAB|巴拿马巴波亚|PAB|es-PA',
    'JMD|牙买加元|JMD,J$|en-JM',
    'TTD|特立尼达和多巴哥元|TTD,TT$|en-TT',
    'BBD|巴巴多斯元|BBD|en-BB',
    'BZD|伯利兹元|BZD|en-BZ',
    'HNL|洪都拉斯伦皮拉|HNL|es-HN',
    'NIO|尼加拉瓜科多巴|NIO|es-NI',
    'ZAR|南非兰特|ZAR,兰特|en-ZA',
    'NGN|尼日利亚奈拉|NGN,₦|en-NG',
    'KES|肯尼亚先令|KES,KSh|en-KE',
    'GHS|加纳塞地|GHS,GH₵,₵|en-GH',
    'TZS|坦桑尼亚先令|TZS|sw-TZ',
    'UGX|乌干达先令|UGX|en-UG',
    'ETB|埃塞俄比亚比尔|ETB|am-ET',
    'ZMW|赞比亚克瓦查|ZMW|en-ZM',
    'MUR|毛里求斯卢比|MUR|en-MU',
    'BTC|比特币|BTC,₿|en-US',
    'ETH|以太坊|ETH|en-US',
    'USDT|泰达币|USDT|en-US'
  ];

  var CURRENCIES = {};      // code -> { code,name,symbols,locale }
  var ALL_SYMBOLS = [];     // [{ sym, codes:[...] }] 按长度倒序
  var ALL_CODES = [];       // 全部三位代码（不含 BTC 之类，但包含）
  var SYM_INDEX = {};       // sym -> [codes]

  (function build() {
    var i, j, parts, code, syms;
    for (i = 0; i < RAW.length; i++) {
      parts = RAW[i].split('|');
      code = parts[0];
      syms = parts[2].split(',');
      CURRENCIES[code] = {
        code: code,
        name: parts[1],
        symbols: syms.filter(function (s) { return !!s; }),
        locale: parts[3]
      };
      for (j = 0; j < CURRENCIES[code].symbols.length; j++) {
        var s = CURRENCIES[code].symbols[j];
        if (!SYM_INDEX[s]) SYM_INDEX[s] = [];
        if (SYM_INDEX[s].indexOf(code) < 0) SYM_INDEX[s].push(code);
      }
    }
    var keys = Object.keys(SYM_INDEX);
    for (i = 0; i < keys.length; i++) ALL_SYMBOLS.push({ sym: keys[i], codes: SYM_INDEX[keys[i]] });
    ALL_SYMBOLS.sort(function (a, b) { return b.sym.length - a.sym.length; });
    ALL_CODES = Object.keys(CURRENCIES).filter(function (c) { return /^[A-Z][A-Z][A-Z]$/.test(c); });
  })();

  /* 符号歧义消解：地区优先 -> 语言前缀 -> 默认 */
  var REGION_MAP = {
    '$': { CA: 'CAD', AU: 'AUD', NZ: 'NZD', HK: 'HKD', SG: 'SGD', TW: 'TWD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', JM: 'JMD', TT: 'TTD', BB: 'BBD', BZ: 'BZD', DO: 'DOP', LR: 'LRD', NA: 'NAD', ZW: 'ZWL', PR: 'USD', US: 'USD' },
    'C$': { CA: 'CAD', NI: 'NIO' },
    'S$': { SG: 'SGD', BR: 'BRL' },
    'A$': { AU: 'AUD', AR: 'ARS' },
    '\u00a5': { JP: 'JPY', CN: 'CNY', TW: 'TWD' },
    '\uffe5': { CN: 'CNY', JP: 'JPY' },
    '\u5143': { CN: 'CNY', TW: 'TWD' },
    '\u5706': { CN: 'CNY', TW: 'TWD' },
    '\u5186': { JP: 'JPY' },
    '\u20ac': { EU: 'EUR' },
    '\u00a3': { GB: 'GBP', EG: 'EGP', LB: 'LBP', SD: 'SDG', SY: 'SYP' },
    'kr': { SE: 'SEK', NO: 'NOK', DK: 'DKK', IS: 'ISK', FO: 'DKK' },
    'Rs': { IN: 'INR', PK: 'PKR', LK: 'LKR', NP: 'NPR', MU: 'MUR' },
    'Rs.': { IN: 'INR', PK: 'PKR', LK: 'LKR', NP: 'NPR', MU: 'MUR' },
    '\u20a8': { IN: 'INR', PK: 'PKR', LK: 'LKR', NP: 'NPR' },
    '\ufdfc': { IR: 'IRR', SA: 'SAR', QA: 'QAR', YE: 'YER', OM: 'OMR' },
    'K\u010d': { CZ: 'CZK' },
    'z\u0142': { PL: 'PLN' }
  };
  var LANG_MAP = {
    '\u00a5': { zh: 'CNY', ja: 'JPY', en: 'JPY', ko: 'JPY' },
    '\uffe5': { zh: 'CNY', ja: 'JPY', en: 'JPY', ko: 'JPY' },
    '\u5143': { zh: 'CNY' },
    '\u5706': { zh: 'CNY' },
    '\u5186': { ja: 'JPY' },
    'kr': { sv: 'SEK', nb: 'NOK', nn: 'NOK', no: 'NOK', da: 'DKK', is: 'ISK', fi: 'EUR' },
    'Rs': { hi: 'INR', ur: 'PKR', si: 'LKR', ne: 'NPR', en: 'INR' },
    'Rs.': { hi: 'INR', ur: 'PKR', si: 'LKR', ne: 'NPR', en: 'INR' },
    '\u20a8': { hi: 'INR', ur: 'PKR', si: 'LKR', ne: 'NPR' }
  };

  /* 仅在特定地区页面才启用的高危单字符符号，避免误伤正文 */
  var REGION_ONLY_SYMS = [
    { sym: 'R', codes: ['ZAR'], regions: { ZA: 'ZAR', NA: 'NAD' } },
    { sym: 'L', codes: ['HNL'], regions: { HN: 'HNL', AL: 'ALL' } },
    { sym: 'Q', codes: ['GTQ'], regions: { GT: 'GTQ' } },
    { sym: 'K', codes: ['MMK'], regions: { MM: 'MMK', ZM: 'ZMW', PG: 'PGK', KE: 'KES', MW: 'MWK' } },
    { sym: 'Br', codes: ['ETB'], regions: { ET: 'ETB' } },
    { sym: 'din', codes: ['RSD'], regions: { RS: 'RSD' } },
    { sym: 'kn', codes: ['HRK'], regions: { HR: 'HRK' } },
    { sym: 'Ft', codes: ['HUF'], regions: { HU: 'HUF' } },
    { sym: 'lei', codes: ['RON'], regions: { RO: 'RON' } }
  ];

  /* 三位代码里容易被正文误伤的单词，需紧贴数字才认 */
  var CODE_BLACKLIST = ['ALL', 'TOP', 'PEN', 'BOB', 'MAD', 'CUP', 'TRY', 'SOS', 'STD', 'BAM', 'MOP', 'COP', 'GEL', 'END'];

  var MAGNITUDE = {
    '\u4e07': 1e4, '\u5343': 1e3, '\u767e': 1e2,
    '\u4ebf': 1e8, '\u767e\u4e07': 1e6, '\u5343\u4e07': 1e7, '\u4e07\u4ebf': 1e12,
    'k': 1e3, 'K': 1e3, 'm': 1e6, 'M': 1e6, 'b': 1e9, 'B': 1e9, 'bn': 1e9, 'Bn': 1e9, 'BN': 1e9
  };

  /* ======================================================================
   * 2. 工具函数
   * ==================================================================== */
  function escapeRe(s) {
    // 转义所有 ASCII 非字母数字字符，避免用带 $ 的字符类
    return String(s).replace(/[\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]/g, function (c) { return '\\' + c; });
  }

  function regionFromHost(host) {
    if (!host) return '';
    var m = String(host).match(/\.([a-z]{2})$/i);
    if (!m) return '';
    return m[1].toUpperCase();
  }

  function regionFromLang(lang) {
    if (!lang) return '';
    var m = String(lang).match(/[-_]([A-Za-z]{2})\b/);
    return m ? m[1].toUpperCase() : '';
  }

  function langPrefix(lang) {
    return String(lang || '').toLowerCase().split(/[-_]/)[0];
  }

  var nfCache = {};
  function getNumberFormat(lang) {
    var key = lang || 'en-US';
    if (nfCache[key]) return nfCache[key];
    var out = { group: ',', decimal: '.', locale: key };
    try {
      var parts = new Intl.NumberFormat(key).formatToParts(1234567.89);
      var i, p;
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        if (p.type === 'group' && p.value) out.group = p.value;
        if (p.type === 'decimal' && p.value) out.decimal = p.value;
      }
      if (out.group === out.decimal) out = { group: ',', decimal: '.', locale: key };
    } catch (e) { /* 保持默认 */ }
    nfCache[key] = out;
    return out;
  }

  /* ======================================================================
   * 3. 金额解析
   *    规则：
   *     - 两种分隔符都有 -> 最后出现的那个是小数点
   *     - 只有一种且小数位!=3 -> 该符号是小数点
   *     - 只有一种且小数位==3 -> 看页面 locale：与页面小数分隔符一致才算小数
   * ==================================================================== */
  /* 这些货币实务上没有小数位：'Rp 6.175' / '6.000₫' / '1.500 Ft' 里的点号是千分位，
     不能因为页面 locale 的小数点是 '.' 就解析成 6.175 …… 否则印尼/越南/韩国页面会全部算成 0 */
  var NO_MINOR = { IDR: 1, VND: 1, KRW: 1, JPY: 1, HUF: 1, ISK: 1, CLP: 1, PYG: 1, COP: 1, UZS: 1,
    KZT: 1, KHR: 1, LAK: 1, MMK: 1, IRR: 1, LBP: 1, SYP: 1, GNF: 1, XAF: 1, XOF: 1, VUV: 1, RWF: 1,
    UGX: 1, TZS: 1, MGA: 1, BYN: 0, NGN: 0, RUB: 0, TRY: 0 };
  function noMinorUnit(code) { return !!(code && NO_MINOR[code]); }

  function parseAmount(raw, nf, code) {
    if (raw == null) return null;
    nf = nf || { group: ',', decimal: '.' };
    var s = String(raw).replace(/[\u00a0\u202f\u2009\u2007]/g, ' ').trim();
    var sign = 1;
    if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
    if (/^-/.test(s)) { sign = -1; s = s.slice(1); }
    var mag = 1;
    // 提取量级后缀
    var magMatch = s.match(/(\u4e07\u4ebf|\u5343\u4e07|\u767e\u4e07|\u4e07|\u5343|\u767e|\u4ebf|bn|Bn|BN|[kKmMbB])\s*$/);
    if (magMatch && MAGNITUDE[magMatch[1]] != null) {
      mag = MAGNITUDE[magMatch[1]];
      s = s.slice(0, s.length - magMatch[1].length);
    }
    s = s.replace(/[^\d.,]/g, '');
    if (!s) return null;
    var hasDot = s.indexOf('.') >= 0;
    var hasComma = s.indexOf(',') >= 0;
    var dec;
    function fracLen(sep) {
      var idx = s.lastIndexOf(sep);
      return s.length - idx - 1;
    }
    function countOf(sep) { return s.split(sep).length - 1; }
    if (hasDot && hasComma) {
      dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    } else if (hasComma) {
      if (countOf(',') > 1) dec = null;
      else if (fracLen(',') !== 3) dec = ',';
      else dec = (nf.decimal === ',' && !noMinorUnit(code) ? ',' : null);
    } else if (hasDot) {
      if (countOf('.') > 1) dec = null;
      else if (fracLen('.') !== 3) dec = '.';
      else dec = (nf.decimal === '.' && !noMinorUnit(code) ? '.' : null);
    } else {
      dec = null;
    }
    var groupChars = [];
    if (dec === '.') groupChars.push(',');
    else if (dec === ',') groupChars.push('.');
    else groupChars.push(',', '.');
    var out = s;
    var g;
    for (g = 0; g < groupChars.length; g++) {
      out = out.split(groupChars[g]).join('');
    }
    if (dec === ',') out = out.split(',').join('.');
    var v = parseFloat(out);
    if (!isFinite(v)) return null;
    return { value: sign * v * mag, raw: String(raw) };
  }

  /* ======================================================================
   * 4. 上下文 / 符号判定
   * ==================================================================== */
  function buildContext(opts) {
    opts = opts || {};
    var settings = opts.settings || {};
    var lang = opts.lang || 'en-US';
    var host = opts.host || '';
    var region = regionFromLang(lang) || regionFromHost(host) || '';
    var symbols = ALL_SYMBOLS.slice();
    var i, j;
    for (i = 0; i < REGION_ONLY_SYMS.length; i++) {
      var ro = REGION_ONLY_SYMS[i];
      if (ro.regions[region]) {
        symbols.push({ sym: ro.sym, codes: [ro.regions[region]] });
      }
    }
    symbols.sort(function (a, b) { return b.sym.length - a.sym.length; });
    var codes = ALL_CODES.filter(function (c) { return CODE_BLACKLIST.indexOf(c) < 0 || settings.allowRiskyCodes; });
    return {
      settings: settings,
      lang: lang,
      region: region,
      nf: getNumberFormat(lang),
      rates: opts.rates || null,
      host: host,
      symbols: symbols,
      codes: codes,
      override: settings.currencyOverride || {},
      convertBare: !!settings.convertBare,
      bareCurrency: settings.bareCurrency || 'USD',
      minAmount: Number(settings.minAmount) || 0,
      maxAmount: Number(settings.maxAmount) || 0
    };
  }

  function resolveSymbol(sym, ctx) {
    if (ctx.override && ctx.override[sym]) return ctx.override[sym];
    var upper = String(sym).toUpperCase();
    if (CURRENCIES[upper] && /^[A-Z]{3}$/.test(upper)) return upper;
    var rm = REGION_MAP[sym];
    if (rm && ctx.region && rm[ctx.region]) return rm[ctx.region];
    var lm = LANG_MAP[sym];
    if (lm && lm[langPrefix(ctx.lang)]) return lm[langPrefix(ctx.lang)];
    var codes = SYM_INDEX[sym];
    if (codes && codes.length) return codes[0];
    /* 区域专属符号（R / Ft / lei / kn / K …）只有地区匹配时才会被加进 ctx.symbols，
       这里必须回查 regions 映射，否则「识别到了却又解析成 null」等于漏检 */
    for (var i = 0; i < REGION_ONLY_SYMS.length; i++) {
      var ro = REGION_ONLY_SYMS[i];
      if (ro.sym === sym) {
        if (ctx.region && ro.regions[ctx.region]) return ro.regions[ctx.region];
        return (ro.codes && ro.codes.length) ? ro.codes[0] : null;
      }
    }
    return CURRENCIES[upper] ? upper : null;
  }

  /* ======================================================================
   * 5. 正则构建
   * ==================================================================== */
  var NUM_CORE = "\\d{1,3}(?:[ ,.\\u00a0\\u202f\\u2009'\\u2019]\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?";
  var MAG_CJK = "\\u4e07\\u4ebf|\\u5343\\u4e07|\\u767e\\u4e07|\\u4e07|\\u5343|\\u767e|\\u4ebf";
  var MAG_LAT = "bn|Bn|BN|[kKmMbB]";
  function magPart(name) {
    return "(?:(?:[ \\u00a0\\u202f]?(?<" + name + ">(?:" + MAG_CJK + "))|(?<" + name + "L>(?:" + MAG_LAT + ")))(?![A-Za-z0-9]))?";
  }
  var MAG_PRE = magPart("magPre");
  var MAG_POST = magPart("magPost");

  var reCache = {};
  function buildRegex(ctx) {
    var key = ctx.symbols.map(function (s) { return s.sym; }).join('\u0001') + '\u0002' + ctx.codes.join(',');
    if (reCache[key]) return reCache[key];
    var symAlt = ctx.symbols.map(function (s) { return escapeRe(s.sym); }).join('|');
    var codeAlt = ctx.codes.join('|');
    var CUR = '(?:' + symAlt + '|' + codeAlt + ')';
    var src =
      '(?<![A-Za-z0-9])' +
      '(?:' +
        '(?<pre>' + CUR + ')(?<sp>[ \\u00a0\\u202f]?)(?<numPre>' + NUM_CORE + ')' + MAG_PRE +
        '(?:[ \\u00a0\\u202f](?<preCode>' + codeAlt + '))?' +
      '|' +
        '(?<numPost>' + NUM_CORE + ')' + MAG_POST + '[ \\u00a0\\u202f]?(?<post>' + CUR + ')' +
      ')' +
      '(?![A-Za-z0-9])';
    if (ctx.convertBare) {
      src = src + '|(?<bare>\\d{1,3}(?:[ ,\\u00a0]\\d{3})+(?:\\.[0-9]{2})?)(?!\\d)';
    }
    var re;
    try { re = new RegExp(src, 'g'); } catch (e) {
      // lookbehind 不支持时的降级方案
      re = new RegExp('(?:' + src + ')', 'g');
    }
    reCache[key] = re;
    return re;
  }

  /* ======================================================================
   * 6. 核心：文本扫描
   * ==================================================================== */
  function convertValue(amount, from, to, rates) {
    if (!rates) return null;
    if (from === to) return amount;
    var rf = rates[from], rt = rates[to];
    if (!isFinite(rf) || !isFinite(rt) || rf <= 0 || rt <= 0) return null;
    return amount / rf * rt;
  }

  /* 展示用符号（与识别用的符号表分开，避免 "CN¥" 这种啰嗦写法） */
  var DISPLAY_SYM = { USD: '$', EUR: '\u20ac', CNY: '\u00a5', JPY: '\u00a5', GBP: '\u00a3', KRW: '\u20a9', INR: '\u20b9', RUB: '\u20bd', THB: '\u0e3f', VND: '\u20ab', ILS: '\u20aa', TRY: '\u20ba', UAH: '\u20b4', NGN: '\u20a6', PHP: '\u20b1', BRL: 'R$', TWD: 'NT$', HKD: 'HK$', SGD: 'S$', AUD: 'A$', CAD: 'C$', NZD: 'NZ$' };
  /* 符号写在数字后面的货币 */
  var SUFFIX_CODES = { SEK: 1, NOK: 1, DKK: 1, ISK: 1, PLN: 1, CZK: 1, HUF: 1, RON: 1, BGN: 1, HRK: 1, RSD: 1, TRY: 1, RUB: 1, UAH: 1, VND: 1, EUR: 0 };

  function displaySymbol(code, style) {
    if (style === 'code') return code;
    if (DISPLAY_SYM[code] !== undefined) return DISPLAY_SYM[code];
    var info = CURRENCIES[code];
    if (info && info.symbols.length) {
      var i;
      for (i = 0; i < info.symbols.length; i++) {
        if (!/^[A-Z]{3,}$/.test(info.symbols[i])) return info.symbols[i];
      }
      return info.symbols[0];
    }
    return code;
  }

  var fmtCache = {};
  function numFormatter(locale, dec, compact) {
    var key = (locale || '') + '|' + dec + '|' + (compact ? 1 : 0);
    if (fmtCache[key] !== undefined) return fmtCache[key];
    var o = { minimumFractionDigits: dec, maximumFractionDigits: dec };
    if (compact) { o.notation = 'compact'; o.maximumFractionDigits = Math.max(dec, 1); }
    var nf = null;
    try { nf = new Intl.NumberFormat(locale || undefined, o); } catch (e) { nf = null; }
    fmtCache[key] = nf;
    return nf;
  }

  function formatValue(v, code, opts) {
    opts = opts || {};
    var dec = opts.decimals;
    var d;
    if (dec === 'auto' || dec == null || dec === '') d = Math.abs(v) >= 1000 ? 0 : 2;
    else d = Math.max(0, Math.min(8, Number(dec) || 0));
    var nf = numFormatter(opts.locale, dec === 'auto' && opts.compact ? 2 : d, !!opts.compact);
    var num;
    if (nf) { try { num = nf.format(Math.abs(v)); } catch (e) { num = String(Math.abs(v)); } }
    else { num = Math.abs(v).toFixed(d); }
    var sign = v < 0 ? '-' : '';
    var sym = displaySymbol(code, opts.symbolStyle);
    var base = SUFFIX_CODES[code] ? num + ' ' + sym : sym + num;
    /* both：符号 + 代码，例如 '$724.00 USD' / '1 234,00 kr SEK' */
    if (opts.symbolStyle === 'both') return sign + base + ' ' + code;
    return sign + base;
  }

  /**
   * 扫描一段文本，返回所有需要替换的命中项
   * @returns {Array<{start,end,text,sym,from,amount,to,value,formatted}>}
   */
  function findMatches(text, ctx) {
    if (!text || text.length < 2) return [];
    if (!/\d/.test(text)) return [];
    var re = buildRegex(ctx);
    re.lastIndex = 0;
    var out = [];
    var m, guard = 0;
    while ((m = re.exec(text)) !== null) {
      if (guard++ > 2000) break;
      if (m.index === re.lastIndex) re.lastIndex++;
      var g = m.groups || (m.groups = {});
      var numRaw = g.numPre != null ? g.numPre : g.numPost;
      if (!numRaw) continue;
      var symRaw = g.pre != null ? g.pre : g.post;
      var bare = g.bare != null;
      var from;
      if (bare) from = ctx.bareCurrency;
      /* '$7.19 USD' 这类「符号 + 数字 + 代码」写法：代码更权威，优先采用，
         同时把尾部代码一起吃进 span，避免留下孤零零的 ' USD' */
      else if (g.preCode && CURRENCIES[g.preCode]) from = g.preCode;
      else from = resolveSymbol(symRaw, ctx);
      if (!from) continue;
      /* ¥ / ￥ 中日共用：靠排版特征区分。
         日式 '¥ 3,150'（符号后有空格 + 千分位 + 通常无小数）；中式 '¥199' / '¥199.00'（紧贴、无千分位）。
         不做这一步，日区商店页面（界面语言为中文时）的 '¥ 3,150' 会被当人民币而直接跳过。 */
      if ((symRaw === '\u00a5' || symRaw === '\uffe5') && (from === 'CNY' || from === 'JPY')) {
        var spAfter = !!(g.sp && g.sp.length);
        var grouped = /[,\u00a0\u202f ]\d{3}(?!\d)/.test(numRaw);
        var noDec = numRaw.indexOf('.') < 0 && numRaw.indexOf(',') < 0;
        if (spAfter && (grouped || noDec)) from = 'JPY';
      }
      var magRaw = g.magPre || g.magPreL || g.magPost || g.magPostL;
      var parsed = parseAmount(magRaw ? numRaw + magRaw : numRaw, ctx.nf, from);
      if (!parsed) continue;
      var amount = parsed.value;
      if (ctx.minAmount && Math.abs(amount) < ctx.minAmount) continue;
      if (ctx.maxAmount && Math.abs(amount) > ctx.maxAmount) continue;
      var to = ctx.settings.target || 'CNY';
      if (from === to && !ctx.settings.convertSameCurrency) continue;
      var value = convertValue(amount, from, to, ctx.rates);
      if (value == null || !isFinite(value)) continue;
      var formatted = formatValue(value, to, {
        decimals: ctx.settings.decimals,
        compact: ctx.settings.compact,
        locale: ctx.settings.displayLocale || undefined,
        currencyDisplay: ctx.settings.currencyDisplay || 'symbol'
      });
      out.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        sym: symRaw || from,
        from: from,
        amount: amount,
        to: to,
        value: value,
        formatted: formatted
      });
    }
    return out;
  }

  /** 纯文本替换，便于测试与命令行使用 */
  function transformText(text, ctx) {
    var hits = findMatches(text, ctx);
    if (!hits.length) return text;
    var out = '';
    var last = 0;
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      out += text.slice(last, h.start);
      out += ctx.settings.displayMode === 'append'
        ? (h.text + ' (' + h.formatted + ')')
        : h.formatted;
      last = h.end;
    }
    out += text.slice(last);
    return out;
  }

  return {
    CURRENCIES: CURRENCIES,
    ALL_SYMBOLS: ALL_SYMBOLS,
    ALL_CODES: ALL_CODES,
    escapeRe: escapeRe,
    getNumberFormat: getNumberFormat,
    parseAmount: parseAmount,
    buildContext: buildContext,
    buildRegex: buildRegex,
    resolveSymbol: resolveSymbol,
    convertValue: convertValue,
    formatValue: formatValue,
    findMatches: findMatches,
    transformText: transformText,
    regionFromHost: regionFromHost,
    regionFromLang: regionFromLang,
    MAGNITUDE: MAGNITUDE
  };
});
