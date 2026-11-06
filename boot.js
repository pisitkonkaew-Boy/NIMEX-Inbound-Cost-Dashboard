/* โหลดข้อมูลจาก Google Sheet (Apps Script) แล้วเริ่มแดชบอร์ด */
window.__STANDALONE = true;
const KEY_NAME = 'nim-inbound-key';
function closeCover() { const c = document.getElementById('cover'); if (c) c.remove(); }
(function () {
  let k = null; try { k = sessionStorage.getItem(KEY_NAME); } catch (e) {}
  if (location.hash === '#admin' || k) { closeCover(); return; }
  const c = document.getElementById('cover'); if (!c) return;
  c.querySelector('button').onclick = closeCover; c.querySelector('.fg').onclick = closeCover; c.querySelector('button').focus();
})();
function getKey() { try { return sessionStorage.getItem(KEY_NAME); } catch (e) { return null; } }
async function api(body) {
  const r = await fetch(window.NIM_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, key: getKey() }) });
  const j = await r.json(); if (!j.ok) throw new Error(j.error || 'failed'); return j;
}
const bootMsg = h => { const b = document.getElementById('boot'); b.innerHTML = h; b.hidden = false; };
function askKey(err) {
  bootMsg(`<h1>ผู้ดูแลระบบ</h1>${err ? `<p class="badt">${err}</p>` : ''}<label for="adm-key">รหัสผู้ดูแล</label><input id="adm-key" type="password" autocomplete="current-password"><button class="btn" id="adm-go">เข้าสู่ระบบ</button><button class="btn alt" id="adm-back">ดูแบบผู้ชมทั่วไป</button>`);
  const go = async () => {
    const v = document.getElementById('adm-key').value; if (!v) return;
    try { sessionStorage.setItem(KEY_NAME, v); } catch (e) {}
    try { await api({ a: 'auth' }); location.reload(); }
    catch (e) { try { sessionStorage.removeItem(KEY_NAME); } catch (x) {} askKey(e.message === 'admin_key_not_set' ? 'ยังไม่ได้ตั้ง ADMIN_KEY ใน Script Properties ของ Apps Script' : e.message === 'denied' ? 'รหัสไม่ถูกต้อง' : 'ติดต่อระบบข้อมูลไม่ได้ ตรวจว่า Deploy Code.gs เวอร์ชันใหม่แล้ว'); }
  };
  document.getElementById('adm-go').onclick = go;
  document.getElementById('adm-key').onkeydown = e => { if (e.key === 'Enter') go(); };
  document.getElementById('adm-back').onclick = () => { location.hash = ''; location.reload(); };
  document.getElementById('adm-key').focus();
}
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(src)); document.body.appendChild(s); }); }
const FIELDS = ['i', 'dc', 'dn', 'dt', 'pl', 'g', 'rc', 'rd', 'rty', 'bl', 'bx', 'rv', 'co', 'pt'];
/* รับได้ทั้งรูปแบบใหม่ (rows เป็นอาร์เรย์) และรูปแบบ Code.gs เดิม (rows เป็นอ็อบเจ็กต์) */
function normRows(j) {
  const cols = j.cols || FIELDS, num = { bl: 1, bx: 1, rv: 1, co: 1, pt: 1 };
  return (j.rows || []).map(r => {
    const o = {};
    if (Array.isArray(r)) cols.forEach((k, i) => { o[k] = r[i]; }); else Object.assign(o, r);
    FIELDS.forEach(k => { o[k] = num[k] ? (Number(o[k]) || 0) : String(o[k] == null ? '' : o[k]).trim(); });
    return o;
  }).filter(o => o.i);
}
async function start() {
  const wantAdmin = location.hash === '#admin', key = getKey();
  if (!window.NIM_API) { bootMsg('<h1>ยังไม่ได้ตั้งค่า</h1><p>ยังไม่ได้ใส่ที่อยู่ระบบข้อมูลใน config.js</p>'); return; }
  if (wantAdmin && !key) { askKey(); return; }
  let j;
  try { bootMsg('<p>กำลังโหลดข้อมูล…</p>'); j = await (await fetch(window.NIM_API)).json(); }
  catch (e) { bootMsg('<h1>โหลดข้อมูลไม่สำเร็จ</h1><p>ลองเปิดหน้านี้ใหม่อีกครั้ง</p>'); return; }
  window.DATA = { rows: j.ok === false ? [] : normRows(j), settings: Object.assign({ kpi: 10, warnBuffer: 1.5 }, j.settings || {}), updated: j.updated || null, apiV: j.v || 1, apiError: j.ok === false ? (j.message || j.error) : null };
  if (key) {
    try { await api({ a: 'auth' }); window.ADMIN = true; }
    catch (e) { try { sessionStorage.removeItem(KEY_NAME); } catch (x) {} if (wantAdmin) { askKey(e.message === 'denied' ? 'รหัสไม่ถูกต้อง' : 'ติดต่อระบบข้อมูลไม่ได้ ตรวจว่า Deploy Code.gs เวอร์ชันใหม่แล้ว'); return; } }
  }
  if (!DATA.rows.length && !window.ADMIN) { bootMsg(`<h1>ยังไม่มีข้อมูล</h1>${DATA.apiError ? `<p class="mut">ระบบข้อมูลแจ้ง: ${String(DATA.apiError).replace(/[<>&]/g, '')}</p>` : ''}`); return; }
  const v = window.NIM_V || 1;
  try {
    if (window.ADMIN) await Promise.all([
      loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js')
    ]).catch(() => {});
    await loadScript('nim-calc.js?v=' + v);
    document.getElementById('boot').hidden = true; document.getElementById('app').hidden = false;
    await loadScript('app.js?v=' + v);
    if (window.ADMIN) await loadScript('admin.js?v=' + v);
  } catch (e) { bootMsg('<h1>โหลดหน้าเว็บไม่สำเร็จ</h1><p>ลองเปิดหน้านี้ใหม่อีกครั้ง</p>'); }
}
start();
