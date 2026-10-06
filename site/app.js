/* もじカウント - 文字数カウント＆文字変換ツール
 * すべてブラウザ内で完結。外部通信なし。
 */
(function () {
  'use strict';

  var input = document.getElementById('input');
  var toastEl = document.getElementById('toast');

  /* ---------- ユーティリティ ---------- */
  function $(id) { return document.getElementById(id); }
  function fmt(n) { return n.toLocaleString('ja-JP'); }

  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  /* ---------- 文字数カウント ---------- */
  // コードポイント単位で数える（絵文字などサロゲートペアを1文字として扱う）
  function countChars(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
        var d = s.charCodeAt(i + 1);
        if (d >= 0xDC00 && d <= 0xDFFF) i++; // サロゲートペアを1文字
      }
      n++;
    }
    return n;
  }

  // X（Twitter）の重み付き文字数。半角=1、全角（CJK等）=2。
  function isHeavyWeight(cp) {
    return (cp >= 0x1100 && cp <= 0x115F) ||   // ハングル字母
           (cp >= 0x2E80 && cp <= 0xA4CF) ||   // CJK部首・かな・漢字・記号
           (cp >= 0xAC00 && cp <= 0xD7A3) ||   // ハングル音節
           (cp >= 0xF900 && cp <= 0xFAFF) ||   // CJK互換漢字
           (cp >= 0xFE30 && cp <= 0xFE4F) ||   // CJK互換形
           (cp >= 0xFF00 && cp <= 0xFF60) ||   // 全角形
           (cp >= 0xFFE0 && cp <= 0xFFE6) ||
           (cp >= 0x1F000 && cp <= 0x1FAFF) || // 絵文字・記号
           (cp >= 0x20000 && cp <= 0x3FFFD);   // CJK拡張
  }
  function xCount(s) {
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var cp = s.codePointAt(i);
      if (cp > 0xFFFF) i++; // サロゲートペア分をスキップ
      w += isHeavyWeight(cp) ? 2 : 1;
    }
    return w;
  }

  function update() {
    var t = input.value;
    var total = countChars(t);
    var noNl = countChars(t.replace(/[\n\r]/g, ''));
    var noSp = countChars(t.replace(/\s/g, '')); // \s は全角スペース(U+3000)も含む
    var lines = t === '' ? 0 : t.split('\n').length;
    var paras = t.trim() === '' ? 0 : t.trim().split(/\n\s*\n/).length;
    var paper = total === 0 ? 0 : Math.ceil(total / 400);
    var xw = xCount(t);
    var bytes = new TextEncoder().encode(t).length;

    $('c-total').textContent = fmt(total);
    $('c-no-newline').textContent = fmt(noNl);
    $('c-no-space').textContent = fmt(noSp);
    $('c-lines').textContent = fmt(lines);
    $('c-paragraphs').textContent = fmt(paras);
    $('c-paper').textContent = fmt(paper);
    $('c-x').textContent = fmt(xw);
    $('c-bytes').textContent = fmt(bytes);

    var xLeft = 280 - xw;
    var leftEl = $('c-x-left');
    leftEl.textContent = fmt(Math.max(0, xLeft));
    $('c-x').classList.toggle('over', xLeft < 0);

    // innerHTML は fmt() が返す数値文字列のみを補間するため安全（ユーザー入力は含まれない）
    $('in-chars').innerHTML = '文字数 <b>' + fmt(total) + '</b>';
    $('in-x').innerHTML = 'X換算 <b>' + fmt(xw) + '</b>/280';
    $('in-paper').innerHTML = '原稿用紙 <b>' + fmt(paper) + '</b>枚';
    $('in-x').classList.toggle('over', xLeft < 0);
  }

  /* ---------- Undo スタック ---------- */
  var undoStack = [];
  var UNDO_MAX = 100;
  function pushUndo() {
    undoStack.push(input.value);
    if (undoStack.length > UNDO_MAX) undoStack.shift();
  }
  function undo() {
    if (undoStack.length === 0) { toast('これ以上戻せません'); return; }
    input.value = undoStack.pop();
    update();
  }

  /* ---------- 変換処理 ---------- */
  // 全角英数字・記号 → 半角（！-～ と全角スペース）
  function zen2han(s) {
    return s.replace(/[\uFF01-\uFF5E]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
    }).replace(/\u3000/g, ' ');
  }
  // 半角英数字・記号 → 全角（!-~ と半角スペース）
  function han2zen(s) {
    return s.replace(/[!-~]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) + 0xFEE0);
    }).replace(/ /g, '\u3000');
  }
  // ひらがな → カタカナ（ぁ-ゖ を +0x60。ゔ→ヴ 含む）
  function hira2kata(s) {
    return s.replace(/[\u3041-\u3096]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) + 0x60);
    });
  }
  // カタカナ → ひらがな（ァ-ヶ を -0x60。ヴ→ゔ 含む）
  function kata2hira(s) {
    return s.replace(/[\u30A1-\u30F6]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0x60);
    });
  }
  // 半角カナ → 全角カナ（濁点・半濁点の結合に対応）
  var HANKAKU_KANA = '｡｢｣､･ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';
  var ZENKAKU_KANA = '。「」、・ヲァィゥェォャュョッーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン';
  var KANA_PAIRS = {
    'ｳﾞ': 'ヴ', 'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ',
    'ｻﾞ': 'ザ', 'ｼﾞ': 'ジ', 'ｽﾞ': 'ズ', 'ｾﾞ': 'ゼ', 'ｿﾞ': 'ゾ',
    'ﾀﾞ': 'ダ', 'ﾁﾞ': 'ヂ', 'ﾂﾞ': 'ヅ', 'ﾃﾞ': 'デ', 'ﾄﾞ': 'ド',
    'ﾊﾞ': 'バ', 'ﾋﾞ': 'ビ', 'ﾌﾞ': 'ブ', 'ﾍﾞ': 'ベ', 'ﾎﾞ': 'ボ',
    'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ'
  };
  function hankakuKana(s) {
    // 先に濁点・半濁点のペアを合成
    var out = s.replace(/[ｳ-ﾎ][ﾞﾟ]/g, function (pair) {
      return KANA_PAIRS[pair] || pair;
    });
    // 残りを1文字ずつ変換
    return out.replace(/[｡-ﾝ]/g, function (c) {
      var i = HANKAKU_KANA.indexOf(c);
      if (i < 0) return c;
      if (c === 'ﾞ' || c === 'ﾟ') return ''; // 単独の濁点は削除
      var z = ZENKAKU_KANA[i];
      return z !== undefined ? z : c;
    });
  }

  /* ---------- ボタン処理 ---------- */
  var ACTIONS = {
    'zen2han': function (t) { return zen2han(t); },
    'han2zen': function (t) { return han2zen(t); },
    'hira2kata': function (t) { return hira2kata(t); },
    'kata2hira': function (t) { return kata2hira(t); },
    'hankaku-kana': function (t) { return hankakuKana(t); },
    'del-space': function (t) { return t.replace(/[ \t\u3000]/g, ''); },
    'del-newline': function (t) { return t.replace(/[\n\r]+/g, ''); },
    'del-blankline': function (t) { return t.replace(/[\n\r]+\s*[\n\r]+/g, '\n'); }
  };

  function doAction(act) {
    var t = input.value;
    if (act === 'copy') {
      if (t === '') { toast('テキストがありません'); return; }
      copyText(t);
      return;
    }
    if (act === 'undo') { undo(); return; }
    if (act === 'clear') {
      if (t === '') return;
      pushUndo();
      input.value = '';
      update();
      input.focus();
      toast('クリアしました（元に戻すで復元できます）');
      return;
    }
    var fn = ACTIONS[act];
    if (!fn) return;
    if (t === '') { toast('テキストを入力してください'); return; }
    var next = fn(t);
    if (next === t) { toast('変更はありません'); return; }
    pushUndo();
    input.value = next;
    update();
    toast('変換しました');
  }

  function copyText(t) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast('コピーしました'); }
      catch (e) { toast('コピーに失敗しました'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () {
        toast('コピーしました');
      }).catch(fallback);
    } else {
      fallback();
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (btn) doAction(btn.getAttribute('data-act'));
  });

  /* ---------- 入力イベント（IME対応） ---------- */
  input.addEventListener('input', update);
  input.addEventListener('compositionend', update);

  // 初期表示
  update();
})();
