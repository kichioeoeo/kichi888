/**
 * 餃浸腦汁鍋貼店｜線上訂單 × Google 試算表
 * ------------------------------------------------------------
 * 使用方式（詳見 gas/README.md）：
 *   1. 在 Google 試算表開啟「擴充功能 → Apps Script」，貼上本檔案
 *   2. 修改下方 CONFIG（至少填 NOTIFY_EMAIL）
 *   3. 執行 setup()：建立「訂單／訂單明細／菜單」工作表並授權
 *   4. 執行 installTriggers()：啟用狀態通知信與每日營業摘要
 *   5. 部署 → 新增部署 → 網頁應用程式（執行身分：我／存取權：所有人）
 *   6. 把網頁應用程式網址填到 index.html 的 ORDER_API
 */

const CONFIG = {
  STORE_NAME: '餃浸腦汁鍋貼店',
  NOTIFY_EMAIL: '',             // 店家收新訂單通知的信箱（留空＝試算表擁有者）
  SEND_CUSTOMER_EMAIL: true,    // 顧客有填 Email 時寄送訂購確認信
  ORDER_PREFIX: 'JJ',           // 訂單編號開頭，例如 JJ261127-001
  FREE_SHIP: 800,               // 宅配滿額免運
  SHIP_FEE: 80,                 // 宅配運費
  MAX_QTY_PER_ITEM: 50,         // 單一品項數量上限
  TIMEZONE: 'Asia/Taipei'
};

const SHEETS = { ORDERS: '訂單', ITEMS: '訂單明細', MENU: '菜單' };
const ORDER_HEADERS = ['訂單編號', '建立時間', '狀態', '取餐方式', '門市', '配送地址', '預計時間', '姓名', '手機', 'Email',
  '付款方式', '品項摘要', '小計', '運費', '總計', '備註', '前端金額', '金額相符'];
const ITEM_HEADERS = ['訂單編號', '建立時間', '品項代碼', '品名', '單價', '數量', '小計'];
const MENU_HEADERS = ['品項代碼', '分類', '品名', '規格', '單價', '上架'];
const STATUSES = ['新訂單', '製作中', '可取餐', '已出貨', '已完成', '已取消'];
const TYPE_LABEL = { dine: '內用', take: '外帶', delivery: '宅配' };
const COL = Object.fromEntries(ORDER_HEADERS.map((h, i) => [h, i + 1]));

// 初始菜單（與網站一致；之後以試算表「菜單」工作表為準）
const DEFAULT_MENU = [
  ['p1', '招牌鍋貼', '招牌豬肉鍋貼', '10 入', 85], ['p2', '招牌鍋貼', '高麗菜鮮肉鍋貼', '10 入', 80],
  ['p3', '招牌鍋貼', '韭菜豬肉鍋貼', '10 入', 85], ['p4', '招牌鍋貼', '川味麻辣鍋貼', '10 入', 95],
  ['p5', '招牌鍋貼', '起司玉米鍋貼', '10 入', 95], ['p6', '招牌鍋貼', '鮮蝦鍋貼', '10 入', 120],
  ['p7', '精選水餃', '招牌鮮肉水餃', '12 入', 90], ['p8', '精選水餃', '韭黃鮮蝦水餃', '12 入', 130],
  ['p9', '精選水餃', '白菜豬肉水餃', '12 入', 85], ['p10', '精選水餃', '香菇素食水餃', '12 入', 85],
  ['p11', '湯品／飲料', '酸辣湯', '1 碗', 45], ['p12', '湯品／飲料', '玉米濃湯', '1 碗', 40],
  ['p13', '湯品／飲料', '蛋花湯', '1 碗', 35], ['p14', '湯品／飲料', '古早味紅茶', '600ml', 30],
  ['p15', '湯品／飲料', '冬瓜檸檬', '600ml', 35], ['p16', '經典小菜', '涼拌小黃瓜', '1 份', 40],
  ['p17', '經典小菜', '麻辣豆干', '1 份', 45], ['p18', '經典小菜', '滷蛋', '1 顆', 15],
  ['p19', '經典小菜', '韓式泡菜', '1 份', 45], ['p20', '經典小菜', '蒜炒高麗菜', '1 份', 55],
  ['g1', '冷凍禮盒', '招牌招財鍋貼禮盒', '50 入', 990], ['g2', '冷凍禮盒', '家庭歡聚組', '30 入＋湯 2 包', 680],
  ['g3', '冷凍禮盒', '節慶雙拼禮盒', '鍋貼 30＋水餃 30', 880]
];

/* ============================================================
 * 一次性設定
 * ============================================================ */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(CONFIG.TIMEZONE);

  const orders = ensureSheet_(ss, SHEETS.ORDERS, ORDER_HEADERS);
  const statusRange = orders.getRange(2, COL['狀態'], orders.getMaxRows() - 1, 1);
  statusRange.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build());
  const colors = { '新訂單': '#fde68a', '製作中': '#fed7aa', '可取餐': '#bbf7d0', '已出貨': '#bfdbfe', '已完成': '#e5e7eb', '已取消': '#fecaca' };
  orders.setConditionalFormatRules(Object.keys(colors).map(s =>
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s).setBackground(colors[s]).setRanges([statusRange]).build()));
  orders.getRange(2, COL['小計'], orders.getMaxRows() - 1, 3).setNumberFormat('"NT$ "#,##0');
  orders.getRange(2, COL['建立時間'], orders.getMaxRows() - 1, 1).setNumberFormat('yyyy/mm/dd hh:mm');

  const items = ensureSheet_(ss, SHEETS.ITEMS, ITEM_HEADERS);
  items.getRange(2, 2, items.getMaxRows() - 1, 1).setNumberFormat('yyyy/mm/dd hh:mm');

  const menu = ensureSheet_(ss, SHEETS.MENU, MENU_HEADERS);
  if (menu.getLastRow() < 2) {
    menu.getRange(2, 1, DEFAULT_MENU.length, 6).setValues(DEFAULT_MENU.map(r => r.concat([true])));
  }
  menu.getRange(2, 6, menu.getMaxRows() - 1, 1).insertCheckboxes();

  const blank = ss.getSheetByName('工作表1') || ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 3 && blank.getLastRow() === 0) ss.deleteSheet(blank);
  safeToast_('設定完成：已建立「訂單」「訂單明細」「菜單」工作表');
}

/** 安裝觸發器：狀態變更通知信、每日 21:30 營業摘要 */
function installTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(t => {
    if (['onStatusEdit', 'dailyReport'].includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onStatusEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('dailyReport').timeBased().atHour(21).nearMinute(30).everyDays(1).inTimezone(CONFIG.TIMEZONE).create();
  safeToast_('已啟用：狀態通知信、每日營業摘要');
}

/* ============================================================
 * 網頁 API
 * ============================================================ */
/** 健康檢查／取得上架菜單：GET ?action=menu */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'ping';
  if (action === 'menu') return json_({ ok: true, menu: Object.values(loadMenu_()).filter(m => m.active) });
  return json_({ ok: true, service: CONFIG.STORE_NAME, time: new Date().toISOString() });
}

/** 建立訂單：POST（Content-Type: text/plain，body 為 JSON） */
function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (data.website) return json_({ ok: true, orderNo: 'IGNORED' });        // 機器人陷阱欄位
    const order = validateOrder_(data);

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    let orderNo, now;
    try {
      now = new Date();
      orderNo = nextOrderNo_(now);
      writeOrder_(orderNo, now, order);
    } finally {
      lock.releaseLock();
    }

    notifyStore_(orderNo, now, order);
    if (CONFIG.SEND_CUSTOMER_EMAIL && order.email) notifyCustomer_(orderNo, order);

    return json_({ ok: true, orderNo, subtotal: order.subtotal, fee: order.fee, total: order.total,
      items: order.items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })) });
  } catch (err) {
    if (!err.userMessage) console.error(err);   // 只記錄非預期錯誤
    return json_({ ok: false, error: err.userMessage || '系統忙碌中，請稍後再試或直接來電訂購。' });
  }
}

/* ============================================================
 * 訂單驗證與金額計算（以試算表菜單為準）
 * ============================================================ */
function validateOrder_(d) {
  const fail = msg => { const e = new Error(msg); e.userMessage = msg; throw e; };
  const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

  const type = str(d.type, 10);
  if (!TYPE_LABEL[type]) fail('取餐方式不正確');
  const name = str(d.name, 40);
  if (!name) fail('請填寫姓名');
  const phone = str(d.phone, 20).replace(/[\s-]/g, '');
  if (!/^09\d{8}$/.test(phone)) fail('手機號碼格式不正確');
  const email = str(d.email, 100);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Email 格式不正確');
  const addr = str(d.addr, 150);
  if (type === 'delivery' && addr.length < 6) fail('請填寫完整的配送地址');

  const menu = loadMenu_();
  if (!Array.isArray(d.items) || !d.items.length) fail('購物車是空的');
  const merged = {};
  d.items.forEach(it => {
    const id = str(it && it.id, 20), qty = Math.floor(Number(it && it.qty));
    if (!id || !(qty > 0)) return;
    merged[id] = (merged[id] || 0) + qty;
  });
  const items = Object.keys(merged).map(id => {
    const m = menu[id];
    if (!m) fail('找不到品項，請重新整理網頁後再下單');
    if (!m.active) fail(`「${m.name}」目前暫停供應，請從購物車移除後再送出`);
    const qty = Math.min(merged[id], CONFIG.MAX_QTY_PER_ITEM);
    return { id, name: m.name, price: m.price, qty, line: m.price * qty };
  });
  if (!items.length) fail('購物車是空的');

  const subtotal = items.reduce((s, i) => s + i.line, 0);
  const fee = type === 'delivery' && subtotal < CONFIG.FREE_SHIP ? CONFIG.SHIP_FEE : 0;
  const total = subtotal + fee;
  const clientTotal = Number(d.total) || 0;

  return {
    type, typeLabel: TYPE_LABEL[type], name, phone, email, addr: type === 'delivery' ? addr : '',
    store: type === 'delivery' ? '' : str(d.store, 30), time: str(d.time, 40), pay: str(d.pay, 20),
    note: str(d.note, 300), items, subtotal, fee, total, clientTotal, priceMatch: clientTotal === total
  };
}

function loadMenu_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.MENU);
  const rows = sh && sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues()
    : DEFAULT_MENU.map(r => r.concat([true]));
  const map = {};
  rows.forEach(([id, cat, name, unit, price, active]) => {
    if (!id) return;
    map[String(id).trim()] = { id: String(id).trim(), cat, name: String(name), unit, price: Number(price) || 0, active: active === true || active === 'TRUE' };
  });
  return map;
}

/* ============================================================
 * 寫入試算表
 * ============================================================ */
function nextOrderNo_(now) {
  const day = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyMMdd');
  const props = PropertiesService.getScriptProperties();
  const key = 'seq_' + day;
  const seq = Number(props.getProperty(key) || 0) + 1;
  props.setProperty(key, String(seq));
  return `${CONFIG.ORDER_PREFIX}${day}-${String(seq).padStart(3, '0')}`;
}

function writeOrder_(orderNo, now, o) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const orders = ss.getSheetByName(SHEETS.ORDERS) || ensureSheet_(ss, SHEETS.ORDERS, ORDER_HEADERS);
  const items = ss.getSheetByName(SHEETS.ITEMS) || ensureSheet_(ss, SHEETS.ITEMS, ITEM_HEADERS);
  const summary = o.items.map(i => `${i.name}×${i.qty}`).join('、');
  const row = {
    '訂單編號': orderNo, '建立時間': now, '狀態': '新訂單', '取餐方式': o.typeLabel, '門市': o.store, '配送地址': o.addr,
    '預計時間': o.time, '姓名': o.name, '手機': "'" + o.phone, 'Email': o.email, '付款方式': o.pay, '品項摘要': summary,
    '小計': o.subtotal, '運費': o.fee, '總計': o.total, '備註': o.note, '前端金額': o.clientTotal, '金額相符': o.priceMatch ? '✓' : '✗ 請確認'
  };
  orders.appendRow(ORDER_HEADERS.map(h => sanitize_(row[h])));
  items.getRange(items.getLastRow() + 1, 1, o.items.length, ITEM_HEADERS.length)
    .setValues(o.items.map(i => [orderNo, now, i.id, sanitize_(i.name), i.price, i.qty, i.line]));
}

/* ============================================================
 * Email 通知
 * ============================================================ */
function storeEmail_() {
  return CONFIG.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
}

function itemsTable_(o) {
  const rows = o.items.map(i => `<tr><td>${esc_(i.name)}</td><td align="right">${i.qty}</td><td align="right">NT$ ${i.line}</td></tr>`).join('');
  const fee = o.type === 'delivery' ? `<tr><td colspan="2">運費</td><td align="right">${o.fee ? 'NT$ ' + o.fee : '免運'}</td></tr>` : '';
  return `<table cellpadding="6" style="border-collapse:collapse;min-width:280px">${rows}${fee}
    <tr style="border-top:1px solid #ccc"><td colspan="2"><b>總計</b></td><td align="right"><b>NT$ ${o.total}</b></td></tr></table>`;
}

function notifyStore_(orderNo, now, o) {
  try {
    const where = o.type === 'delivery' ? `宅配：${esc_(o.addr)}` : `${o.typeLabel}：${esc_(o.store)}`;
    MailApp.sendEmail({
      to: storeEmail_(),
      subject: `【新訂單】${orderNo}｜${o.typeLabel}｜NT$ ${o.total}${o.priceMatch ? '' : '（金額與前端不符）'}`,
      htmlBody: `<h2>${CONFIG.STORE_NAME} 新訂單 ${orderNo}</h2>
        <p>${Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm')}｜${where}｜${esc_(o.time)}</p>
        <p>${esc_(o.name)}｜${esc_(o.phone)}${o.email ? '｜' + esc_(o.email) : ''}｜${esc_(o.pay)}</p>
        ${itemsTable_(o)}${o.note ? `<p>備註：${esc_(o.note)}</p>` : ''}
        <p><a href="${SpreadsheetApp.getActiveSpreadsheet().getUrl()}">開啟訂單試算表</a></p>`
    });
  } catch (err) { console.error('notifyStore_', err); }
}

function notifyCustomer_(orderNo, o) {
  try {
    MailApp.sendEmail({
      to: o.email, name: CONFIG.STORE_NAME,
      subject: `${CONFIG.STORE_NAME}｜訂單 ${orderNo} 已收到`,
      htmlBody: `<p>${esc_(o.name)} 您好，謝謝您的訂購！</p>
        <p>訂單編號：<b>${orderNo}</b><br>取餐方式：${o.typeLabel}${o.store ? '（' + esc_(o.store) + '）' : ''}<br>
        預計時間：${esc_(o.time)}<br>付款方式：${esc_(o.pay)}</p>${itemsTable_(o)}
        <p>餐點準備好時我們會再寄信通知您。</p><p>${CONFIG.STORE_NAME}</p>`
    });
  } catch (err) { console.error('notifyCustomer_', err); }
}

/** 可安裝的編輯觸發器：狀態改為「可取餐／已出貨」時通知顧客 */
function onStatusEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== SHEETS.ORDERS || e.range.getColumn() !== COL['狀態'] || e.range.getRow() < 2) return;
  const status = e.value;
  if (!['可取餐', '已出貨'].includes(status)) return;
  const row = sh.getRange(e.range.getRow(), 1, 1, ORDER_HEADERS.length).getValues()[0];
  const email = row[COL['Email'] - 1], orderNo = row[COL['訂單編號'] - 1], name = row[COL['姓名'] - 1];
  if (!email) return;
  const msg = status === '可取餐'
    ? `您的餐點已經準備好囉！請至${row[COL['門市'] - 1] || '門市'}取餐。`
    : '您的訂單已出貨，請留意物流通知。';
  MailApp.sendEmail({
    to: email, name: CONFIG.STORE_NAME, subject: `${CONFIG.STORE_NAME}｜訂單 ${orderNo}：${status}`,
    htmlBody: `<p>${esc_(name)} 您好，</p><p>${msg}</p><p>訂單編號：<b>${orderNo}</b></p><p>${CONFIG.STORE_NAME}</p>`
  });
}

/** 每日營業摘要（由 installTriggers 設定每天 21:30 執行，也可手動執行） */
function dailyReport() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ORDERS);
  if (!sh || sh.getLastRow() < 2) return;
  const today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy/MM/dd');
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, ORDER_HEADERS.length).getValues()
    .filter(r => r[COL['建立時間'] - 1] instanceof Date && Utilities.formatDate(r[COL['建立時間'] - 1], CONFIG.TIMEZONE, 'yyyy/MM/dd') === today)
    .filter(r => r[COL['狀態'] - 1] !== '已取消');
  const revenue = rows.reduce((s, r) => s + (Number(r[COL['總計'] - 1]) || 0), 0);
  const byType = {};
  rows.forEach(r => { const t = r[COL['取餐方式'] - 1]; byType[t] = (byType[t] || 0) + 1; });
  const pending = rows.filter(r => !['已完成', '已取消'].includes(r[COL['狀態'] - 1])).length;
  MailApp.sendEmail({
    to: storeEmail_(), subject: `【營業摘要】${today}｜${rows.length} 筆｜NT$ ${revenue}`,
    htmlBody: `<h2>${CONFIG.STORE_NAME} ${today} 營業摘要</h2>
      <p>訂單數：<b>${rows.length}</b>　營業額：<b>NT$ ${revenue}</b>　未完成：<b>${pending}</b></p>
      <p>${Object.keys(byType).map(k => `${k} ${byType[k]} 筆`).join('　') || '今日無訂單'}</p>`
  });
}

/* ============================================================
 * 小工具
 * ============================================================ */
function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#3d2616').setFontColor('#fffaf2');
  sh.setFrozenRows(1);
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** 避免試算表公式注入（開頭為 = + - @ 的文字） */
function sanitize_(v) {
  return typeof v === 'string' && /^[=+\-@]/.test(v) && v.charAt(0) !== "'" ? "'" + v : v;
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function safeToast_(msg) {
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, CONFIG.STORE_NAME, 5); } catch (e) { console.log(msg); }
}
