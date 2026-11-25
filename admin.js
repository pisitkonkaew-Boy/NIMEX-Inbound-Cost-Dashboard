/* NIMEX Inbound Cost Dashboard — ส่วนผู้ดูแล: ตั้งค่า เติมไฟล์ ตรวจสอบข้อมูล แชร์และส่งออก
   โหลดเฉพาะเมื่อเข้าด้วย #admin และรหัสผ่านตรวจที่ Apps Script แล้ว */
'use strict';
(function () {
const { S, D, RAW, C, esc, fmtN, fmtP, mLabel, dLabel, dcName, render, openSheet, VIEW, header, pc, LIGHT, MET, GNAME, GCOL, GROUPS, TRIPS } = window.NX;
const $ = s => document.querySelector(s);
const FIELDS = ['i', 'dc', 'dn', 'dt', 'pl', 'g', 'rc', 'rd', 'rty', 'bl', 'bx', 'rv', 'co', 'pt', 'ty'];
const HEAD_TH = ['เลขที่ใบรายการ', 'DC', 'ชื่อ DC', 'วันที่ (พ.ศ.)', 'ทะเบียนรถ', 'กลุ่ม (AB/CC)', 'รหัสเส้นทาง', 'เส้นทาง', 'ประเภทอัตรา', 'บิล', 'กล่อง', 'รายได้', 'ค่าจ้าง (จริง)', 'จุดเข้ารับ', 'งาน (IN/DI)'];
let LOGO = 'logo.png';
fetch('logo.png').then(r => r.blob()).then(b => new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); })).then(u => { LOGO = u; }).catch(() => {});

/* =================== ตั้งค่า =================== */
const SET = { plan: null, msg: '', busy: false, del: '', log: null };
const sameRow = (a, b) => FIELDS.every(k => String(a[k]) === String(b[k]));
async function readFiles(list) {
  SET.plan = null; SET.msg = 'กำลังอ่านไฟล์ ไฟล์ใหญ่อาจใช้เวลา 10–30 วินาที…'; renderSet();
  await new Promise(r => setTimeout(r, 60));
  let recs = [], bad = [], used = [];
  for (const f of list) {
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
      let n = 0;
      wb.SheetNames.forEach(s => { const got = C.processSheetRows(XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, defval: null, raw: true })); n += got.length; recs = C.mergeRecords(recs, got); });
      if (n) used.push(f.name); else bad.push(f.name);
    } catch (e) { bad.push(f.name); }
  }
  const have = new Map(RAW.map(r => [r.i, r])), add = [], upd = [], same = [];
  recs.forEach(r => { const o = have.get(r.i); if (!o) add.push(r); else if (sameRow(o, r)) same.push(r); else upd.push(r); });
  const merged = C.mergeRecords(RAW, recs), DM = C.applyCalc(C.buildDerived(merged), window.NX.S.calc), months = [...new Set(C.buildDerived(recs).map(r => r.mKey))].sort();
  const per = months.map(m => { const inFile = recs.filter(r => C.monthKeyOf(C.parseThaiDate(r.dt)) === m); const A = C.aggregate(C.getFiltered(DM, { month: m })).total; return { m, file: inFile.length, add: inFile.filter(r => !have.has(r.i)).length, upd: inFile.filter(r => have.has(r.i) && !sameRow(have.get(r.i), r)).length, A }; });
  SET.plan = { recs, add, upd, same, per, bad, used, total: merged.length, zeroCost: recs.filter(r => !(r.co > 0)).length, zeroRev: recs.filter(r => !(r.rv > 0)).length, nIN: recs.filter(r => r.ty !== 'DI').length, nDI: recs.filter(r => r.ty === 'DI').length, needDeploy: (window.DATA.apiV || 1) < 3 && recs.some(r => r.ty === 'DI') };
  SET.msg = ''; renderSet();
}
function planHtml() {
  const p = SET.plan; if (!p) return '';
  if (!p.recs.length) return `<p class="badt">ไม่พบรายการเข้ารับในไฟล์ ${p.bad.map(esc).join(', ')} (ต้องเป็นรายงาน NIMEX06006)</p>`;
  return `<div class="tw"><table class="t"><thead><tr><th>เดือน</th><th>ใบงานในไฟล์</th><th>ใหม่</th><th>แทนที่</th><th>เที่ยวหลังบันทึก</th><th>รายได้</th><th>ค่าจ้าง</th><th>% ค่าจ้าง</th></tr></thead><tbody>${p.per.map(x => `<tr><td>${esc(mLabel(x.m))}</td><td>${fmtN(x.file)}</td><td>${fmtN(x.add)}</td><td>${fmtN(x.upd)}</td><td>${fmtN(x.A.trips)}</td><td>${fmtN(x.A.revenue)}</td><td>${fmtN(x.A.cost)}</td><td class="p-${pc(x.A.pct)}">${fmtP(x.A.pct)}</td></tr>`).join('')}</tbody></table></div>
  <p class="note" style="text-align:left">เพิ่มใหม่ ${fmtN(p.add.length)} · แทนที่ด้วยค่าใหม่ ${fmtN(p.upd.length)} · เหมือนเดิม ${fmtN(p.same.length)} (ไม่ส่งซ้ำ) · หลังบันทึกมีทั้งหมด ${fmtN(p.total)} ใบงาน<br>ในไฟล์: ค่าจ้างเป็น 0 ${fmtN(p.zeroCost)} ใบงาน (จะใช้ค่าประมาณการ) · ไม่มีรายได้ ${fmtN(p.zeroRev)} ใบงาน${p.bad.length ? `<br><span class="badt">ไม่พบข้อมูลเข้ารับในไฟล์: ${p.bad.map(esc).join(', ')}</span>` : ''}</p>
  <p class="note" style="text-align:left">งาน: เข้ารับอย่างเดียว ${fmtN(p.nIN)} ใบ · เข้ารับในสาย ${fmtN(p.nDI)} ใบ (นับเฉพาะใบกระจายที่มีงานเข้ารับ)</p>
  ${p.needDeploy ? '<p class="badt">ไฟล์นี้มีงานเข้ารับในสาย แต่ระบบข้อมูลยังเป็น Code.gs รุ่นเก่า ให้วาง Code.gs.txt ใหม่และ Deploy เป็น New version ก่อนบันทึก</p>' : p.add.length + p.upd.length ? `<button class="btn" data-set="commit"${SET.busy ? ' disabled' : ''}>บันทึกลงระบบ ${fmtN(p.add.length + p.upd.length)} ใบงาน</button>` : '<p class="note">ไม่มีข้อมูลใหม่ที่ต้องบันทึก</p>'}`;
}
async function commit() {
  const p = SET.plan; if (!p || SET.busy || p.needDeploy) return; SET.busy = true;
  const rows = [...p.add, ...p.upd].map(r => FIELDS.map(k => r[k])), N = 4000;
  try {
    for (let i = 0; i < rows.length; i += N) { SET.msg = `กำลังบันทึก ${fmtN(Math.min(i + N, rows.length))} / ${fmtN(rows.length)} ใบงาน…`; renderSet(); await api({ a: 'upsert', rows: rows.slice(i, i + N) }); }
    SET.msg = 'บันทึกแล้ว กำลังโหลดข้อมูลใหม่…'; renderSet(); setTimeout(() => location.reload(), 700);
  } catch (e) { SET.busy = false; SET.msg = 'บันทึกไม่สำเร็จ: ' + (e.message === 'unknown' || e.message === 'denied' ? 'ตรวจว่าวาง Code.gs เวอร์ชันใหม่และ Deploy แล้ว' : e.message); renderSet(); }
}
function renderSet() { const b = $('#set-up'); if (b) b.innerHTML = `${SET.msg ? `<p class="msg" role="status">${esc(SET.msg)}</p>` : ''}${planHtml()}`; }
function monthsInfo() {
  const by = {}; D.forEach(r => { const o = by[r.mKey] || (by[r.mKey] = { m: r.mKey, rows: [], a: null, b: null }); o.rows.push(r); if (r.dateObj) { if (!o.a || r.dateObj < o.a) o.a = r.dateObj; if (!o.b || r.dateObj > o.b) o.b = r.dateObj; } });
  return Object.values(by).sort((x, y) => x.m < y.m ? 1 : -1).map(o => ({ ...o, A: C.aggregate(o.rows).total }));
}
function checks() {
  const plates = {}; D.forEach(r => { (plates[r.pl] = plates[r.pl] || new Set()).add(r.dc); });
  const multiDc = Object.keys(plates).filter(p => plates[p].size > 1);
  const L = [];
  D.forEach(r => { if (!(r.rv > 0)) L.push([r, 'ไม่มีรายได้']); else if (!(r.co > 0)) L.push([r, r.effCost > 0 ? 'ค่าจ้างเป็น 0 ใช้ค่าประมาณการ' : 'ค่าจ้างเป็น 0 และหาค่าประมาณการไม่ได้']); if (!r.dateObj) L.push([r, 'อ่านวันที่ไม่ได้']); });
  return { multiDc, L, noRev: D.filter(r => !(r.rv > 0)).length, est: D.filter(r => r.isEstimated).length, noCost: D.filter(r => !(r.co > 0) && !(r.effCost > 0)).length };
}
VIEW.settings = () => {
  const M = monthsInfo(), K = checks(), old = (window.DATA.apiV || 1) < 3;
  return `${header('ตั้งค่า', 'เห็นเฉพาะผู้ดูแลระบบ')}
  <section class="card"><h2>สถานะระบบข้อมูล</h2><div class="kv" style="justify-content:center"><span>ใบงานในระบบ</span><b>${fmtN(RAW.length)}</b><span>เดือน</span><b>${M.map(x => esc(mLabel(x.m))).join(', ') || '–'}</b><span>โหลดเมื่อ</span><b>${new Date().toLocaleString('th-TH')}</b></div>${old ? '<p class="badt" style="text-align:center">ระบบข้อมูลยังเป็น Code.gs รุ่นเก่า ให้วาง Code.gs.txt ใหม่และ Deploy เป็น New version</p>' : ''}<div class="btnrow" style="margin-top:8px"><button class="btn alt" data-set="reload">โหลดข้อมูลใหม่</button><button class="btn" data-act="export">แชร์และส่งออก</button></div></section>
  <section class="card"><h2>เติมไฟล์</h2><p class="note">เลือกรายงาน NIMEX06006 (.xlsx) ได้หลายไฟล์ ระบบอ่านในเบราว์เซอร์ แสดงผลให้ตรวจก่อนบันทึก เลขที่ใบรายการซ้ำจะยึดค่าใหม่</p><input type="file" id="up-file" multiple accept=".xlsx,.xls" aria-label="เลือกไฟล์รายงาน"><div id="set-up" class="plan" style="margin-top:8px">${SET.msg ? `<p class="msg">${esc(SET.msg)}</p>` : ''}${planHtml()}</div></section>
  <section class="card"><h2>เกณฑ์ KPI</h2><p class="note">% ค่าจ้าง = ค่าจ้าง ÷ รายได้ × 100 · มีผลกับทุกหน้าและผู้ชมทุกคน</p><div class="fields"><label class="field">KPI % ค่าจ้าง (ไม่เกิน)<input type="number" step="0.1" min="0" id="set-kpi" value="${C.SETTINGS.kpi}"></label><label class="field">เตือนล่วงหน้า (จุดก่อนถึง KPI)<input type="number" step="0.1" min="0" id="set-warn" value="${C.SETTINGS.warnBuffer}"></label></div><button class="btn" data-set="savekpi" style="width:100%">บันทึกเกณฑ์</button><p class="msg" id="kpi-msg" role="status"></p></section>
  <section class="card"><h2>เกรด % ค่าจ้าง (A–F)</h2><p class="note">เกรดตามค่า % ค่าจ้าง ใช้ในอินโฟกราฟิกและข้อความสรุป · ใส่ค่าสูงสุดของแต่ละเกรด เรียงจากน้อยไปมาก เกินเกรด E คือ F</p><div class="fields">${['gA', 'gB', 'gC', 'gD', 'gE'].map((k, i) => `<label class="field">เกรด ${'ABCDE'[i]} (ไม่เกิน %)<input type="number" step="0.1" min="0" id="set-${k}" value="${C.SETTINGS[k]}"></label>`).join('')}</div><button class="btn" data-set="savegrade" style="width:100%">บันทึกเกรด</button><p class="msg" id="grade-msg" role="status"></p></section>
  <section class="card"><h2>ข้อมูลรายเดือน</h2><p class="note">ลบทั้งเดือนเมื่อต้องการนำเข้าใหม่ทั้งหมด · ส่งออกข้อมูลดิบทั้งหมดเป็นไฟล์สำรอง</p><div class="tw"><table class="t"><thead><tr><th>เดือน</th><th>ใบงาน</th><th>ช่วงวันที่</th><th>รายได้</th><th>ค่าจ้าง</th><th>%</th><th>ลบ</th></tr></thead><tbody>${M.map(x => `<tr><td>${esc(mLabel(x.m))}</td><td>${fmtN(x.rows.length)}</td><td>${x.a ? esc(dLabel(dtOf(x.a)) + ' – ' + dLabel(dtOf(x.b))) : '–'}</td><td>${fmtN(x.A.revenue)}</td><td>${fmtN(x.A.cost)}</td><td class="p-${pc(x.A.pct)}">${fmtP(x.A.pct)}</td><td><button class="btn alt${SET.del === x.m ? ' dangerbtn' : ''}" style="min-height:32px;padding:4px 10px" data-set="del:${x.m}">${SET.del === x.m ? 'ยืนยันลบ' : 'ลบ'}</button></td></tr>`).join('')}</tbody></table></div><button class="btn alt" data-set="rawxlsx" style="width:100%;margin-top:8px">ส่งออกข้อมูลทั้งหมด (Excel)</button><p class="msg" id="del-msg" role="status"></p></section>
  <section class="card"><h2>ตรวจสอบข้อมูล</h2><p class="note">ไม่มีรายได้ ${fmtN(K.noRev)} ใบงาน · ค่าจ้างประมาณการ ${fmtN(K.est)} ใบงาน · หาค่าประมาณการไม่ได้ ${fmtN(K.noCost)} ใบงาน · ทะเบียนที่อยู่หลาย DC ${fmtN(K.multiDc.length)} คัน${K.multiDc.length ? ' (' + K.multiDc.slice(0, 8).map(esc).join(', ') + (K.multiDc.length > 8 ? ' …' : '') + ')' : ''}</p>
  ${window.NX.table('chk', [{ k: 'dt', t: 'วันที่', v: x => +x[0].dateObj || 0, txt: x => dLabel(x[0].dt) }, { k: 'i', t: 'ใบรายการ', v: x => x[0].i, dir: 'text' }, { k: 'dc', t: 'DC', v: x => x[0].dc, dir: 'text' }, { k: 'pl', t: 'ทะเบียน', v: x => x[0].pl, dir: 'text' }, { k: 'g', t: 'กลุ่ม', v: x => x[0].g, dir: 'text' }, { k: 'rv', t: 'รายได้', v: x => x[0].rv, txt: x => fmtN(x[0].rv) }, { k: 'co', t: 'ค่าจ้างเดิม', v: x => x[0].co, txt: x => fmtN(x[0].co) }, { k: 'eff', t: 'ค่าจ้างที่ใช้', v: x => x[0].effCost, txt: x => fmtN(x[0].effCost) }, { k: 'why', t: 'ประเด็น', v: x => x[1], dir: 'text' }], K.L, { act: x => 'day:' + encodeURIComponent(x[0].dt), sort: { k: 'dt', d: 1 }, search: 'ค้นหาใบรายการ ทะเบียน หรือประเด็น', limit: 30 })}</section>
  <section class="card"><h2>ประวัติการแก้ไข</h2>${SET.log ? (SET.log.length ? `<div class="tw"><table class="t"><thead><tr><th>เวลา</th><th>งาน</th><th>รายละเอียด</th></tr></thead><tbody>${SET.log.map(r => `<tr><td>${esc(r[0])}</td><td class="l">${esc(r[1])}</td><td class="l">${esc(r[2])}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">ยังไม่มีประวัติ</p>') : '<button class="btn alt" data-set="log" style="width:100%">ดูประวัติ 20 รายการล่าสุด</button>'}</section>
  <section class="card"><button class="btn alt" data-set="logout" style="width:100%">ออกจากระบบผู้ดูแล</button></section>`;
};
const dtOf = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + (d.getFullYear() + 543);
document.addEventListener('change', e => { const t = e.target; if (t.id === 'up-file' && t.files.length) readFiles([...t.files]); });
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-set]'); if (!b) return; const [a, v] = b.dataset.set.split(':');
  if (a === 'commit') commit();
  if (a === 'reload') location.reload();
  if (a === 'logout') { try { sessionStorage.removeItem(KEY_NAME); } catch (x) {} location.hash = ''; location.reload(); }
  if (a === 'savekpi') { const m = $('#kpi-msg'), k = +$('#set-kpi').value, w = +$('#set-warn').value; if (!(k > 0) || !(w >= 0)) { m.textContent = 'ใส่ตัวเลขให้ถูกต้อง'; return; } m.textContent = 'กำลังบันทึก…'; try { await api({ a: 'settings', settings: { kpi: k, warnBuffer: w, gA: C.SETTINGS.gA, gB: C.SETTINGS.gB, gC: C.SETTINGS.gC, gD: C.SETTINGS.gD, gE: C.SETTINGS.gE } }); m.textContent = 'บันทึกแล้ว กำลังโหลดใหม่…'; setTimeout(() => location.reload(), 500); } catch (x) { m.textContent = 'บันทึกไม่สำเร็จ: ' + x.message; } }
  if (a === 'savegrade') { const m = $('#grade-msg'), ks = ['gA', 'gB', 'gC', 'gD', 'gE'], v = ks.map(k => +$('#set-' + k).value); if (v.some(x => !(x > 0)) || v.some((x, i) => i && x <= v[i - 1])) { m.textContent = 'ใส่ตัวเลขมากกว่า 0 และเรียงจากน้อยไปมาก (A < B < C < D < E)'; return; } m.textContent = 'กำลังบันทึก…'; try { const o = { kpi: C.SETTINGS.kpi, warnBuffer: C.SETTINGS.warnBuffer }; ks.forEach((k, i) => o[k] = v[i]); const r = await api({ a: 'settings', settings: o }); if (!r.settings || +r.settings.gE !== v[4]) { m.textContent = 'ระบบข้อมูลยังเป็น Code.gs รุ่นเก่า ให้วาง Code.gs.txt ใหม่และ Deploy เป็น New version แล้วบันทึกอีกครั้ง'; return; } m.textContent = 'บันทึกแล้ว กำลังโหลดใหม่…'; setTimeout(() => location.reload(), 500); } catch (x) { m.textContent = 'บันทึกไม่สำเร็จ: ' + x.message; } }
  if (a === 'del') { if (SET.del !== v) { SET.del = v; render(true); return; } const [y, mo] = v.split('-'); $('#del-msg').textContent = 'กำลังลบ…'; try { const r = await api({ a: 'deleteMonth', month: mo + '/' + (+y + 543) }); $('#del-msg').textContent = `ลบแล้ว ${fmtN(r.removed)} ใบงาน กำลังโหลดใหม่…`; setTimeout(() => location.reload(), 600); } catch (x) { $('#del-msg').textContent = 'ลบไม่สำเร็จ: ' + x.message; } }
  if (a === 'rawxlsx') { const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet([HEAD_TH, ...RAW.map(r => FIELDS.map(k => r[k]))]); XLSX.utils.book_append_sheet(wb, ws, 'data'); await save('NIMEX-Inbound-Cost-AllData-' + new Date().toISOString().slice(0, 10) + '.xlsx', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })])); }
  if (a === 'log') { try { const r = await api({ a: 'stats' }); SET.log = r.log || []; } catch (x) { SET.log = []; } render(true); }
});

/* =================== แชร์และส่งออก =================== */
const SECS = [['kpi', 'KPI 8 กรอบ'], ['dcg', 'ราย DC แยก AB / CC'], ['trend', '% ค่าจ้างรายวัน'], ['split', 'AB แห้ง เทียบ CC เย็น'], ['dc', 'ราย DC × กลุ่ม'], ['cmp', 'เทียบรายเดือนตาม DC'], ['routes', 'เส้นทางที่ต้องแก้ไข'], ['cars', 'รถผิดปกติ'], ['analysis', 'ผลการวิเคราะห์'], ['rows', 'ใบงานตามตัวกรอง (เฉพาะ Excel)']];
const picked = new Set(['kpi', 'trend', 'split', 'dc']); let touched = false;
const MD = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
const KE = { revenue: '💵', cost: '👷', pct: '🎯', points: '📍', trips: '🚚', bills: '🧾', boxes: '📦', avgPoints: '📊' };
const NX = window.NX;
const groupLine = () => GROUPS[S.group] + (S.trip !== 'all' ? ' · ' + TRIPS[S.trip] : '') + (NX.HAS_DI ? ' · ' + (S.work === 'all' ? 'รวม 2 งาน' : NX.WORKS[S.work]) + (S.work !== 'IN' ? ' (' + NX.CALCS[S.calc] + ')' : '') : '');
const overRoutes = rows => NX.routeAgg(rows).filter(r => r.agg.pct !== null && r.agg.pct > C.SETTINGS.kpi).sort((a, b) => b.excess - a.excess);
const badCars = rows => NX.vehAgg(rows).filter(v => v.anomaly).sort((a, b) => b.costPerTrip / b.medianCostPerTrip - a.costPerTrip / a.medianCostPerTrip);
function summaryText() {
  const K = NX.kpiData(), A = K.A, L = ['📊 NIMEX Inbound Cost Dashboard', `🗓️ ${NX.rangeLabel()}  |  🚚 ${groupLine()}${S.dc !== 'all' ? '  |  📍 ' + dcName(S.dc) : '  |  📍 ทุก DC'}`];
  const sec = t => { L.push(''); L.push(t); };
  if (picked.has('kpi')) {
    sec('🎯 ผลสำคัญ');
    K.list.forEach(k => { const st = k.id === 'pct' ? (k.cls === 'bad' ? ' 🔴 เกิน KPI' : k.cls === 'warn' ? ' 🟠 ใกล้ KPI' : ' 🔵 ผ่าน KPI') : ''; L.push(`${KE[k.id]} ${k.l}: ${k.txt}${k.unit && k.id !== 'pct' ? ' ' + k.unit : ''}${st}${k.id === 'pct' && window.NXS ? ' · เกรด ' + NXS.grade(k.v) : ''}`); if (K.pr && k.d && k.d.dir !== 0) L.push(`     ก่อนหน้า ${k.prev} ${k.d.color === 'good' ? '✅ ดีขึ้น' : '⚠️ แย่ลง'}`); });
    const St = NX.statData(K), tp = St.trip, smx = o => fmtN(o.s) + ' / ' + fmtN(o.m);
    L.push(`🔁 ${tp.l}: ${smx(tp.T)}` + (S.group === 'all' ? ` (AB ${smx(tp.AB)} · CC ${smx(tp.CC)})` : ''));
    St.units.forEach(U => { L.push(`💰 ${U.l}: ${U.x(U.T)} ${U.u}${U.dT && U.dT.dir ? (U.dT.color === 'good' ? ' ✅ ' : ' ⚠️ ') + U.dT.t : ''}`); if (S.group === 'all') L.push(`     AB ${U.x(U.AB)}${U.dAB && U.dAB.dir ? ' ' + U.dAB.t : ''} · CC ${U.x(U.CC)}${U.dCC && U.dCC.dir ? ' ' + U.dCC.t : ''}`); });
    if (K.pr) L.push(`↔️ เทียบกับ ${K.pr.l}`);
  }
  if (picked.has('split') && S.group === 'all') { sec('🧊 แยกกลุ่มสินค้า'); ['AB', 'CC'].forEach(g => L.push(`${g === 'AB' ? '📦' : '❄️'} ${GNAME[g]}: ค่าจ้าง ${fmtN(A[g].cost)} / รายได้ ${fmtN(A[g].revenue)} บาท = ${fmtP(A[g].pct)}`)); }
  if (picked.has('dcg')) { sec('🏢 % ค่าจ้าง ราย DC แยก AB / CC'); NX.dcGroupData().forEach(d => L.push(`📍 ${d.short}: ` + d.g.map(x => x.a.trips ? `${x.g} ${fmtP(x.a.pct)}${x.a.pct > C.SETTINGS.kpi ? ' ⚠️' : ' ✅'} (${fmtN(x.a.trips)} เที่ยว)` : `${x.g} ${NX.emptyNote(d.dc, x.g)}`).join(' · '))); }
  if (picked.has('dc')) { sec('🏢 ราย DC (% ค่าจ้างสูงสุดก่อน)'); NX.dcAgg(NX.filt({ dc: 'all' })).sort((a, b) => b.agg.pct - a.agg.pct).forEach((d, i) => L.push(`${MD[i] || '▪️'} ${d.name} (${fmtN(d.cars)} คัน): ${fmtP(d.agg.pct)}${d.agg.pct > C.SETTINGS.kpi ? ' ⚠️' : ' ✅'}`)); }
  if (picked.has('trend')) { const da = C.dailyAgg(K.rows); let pk = null; da.dates.forEach(dt => { const p = da.byDate[dt].total.pct; if (p !== null && (!pk || p > pk.p)) pk = { dt, p }; }); if (pk) { sec('📈 รายวัน'); L.push(`🔺 วันที่ % ค่าจ้างสูงสุด: ${dLabel(pk.dt)} ${fmtP(pk.p)}`); } }
  if (picked.has('cmp')) { const { M, ms, rows, total, pr } = NX.cmpRows(); if (ms.length > 1 && pr) { sec(`🔁 เทียบรายเดือน: ${M.t}`); L.push(`(${mLabel(ms[ms.length - 1])} เทียบ ${pr.l})`); [...rows, total].filter(r => Number.isFinite(r.chg)).forEach(r => { const g = M.hi ? r.chg >= 0 : r.chg <= 0; L.push(`${g ? '📈' : '📉'} ${r.name}: ${M.x(r.vals[ms.length - 1])} (${r.chg >= 0 ? '▲' : '▼'} ${M.isPct ? fmtN(Math.abs(r.chg), 2) + ' จุด' : M.x(Math.abs(r.chg))}) ${g ? '✅' : '⚠️'}`); }); } }
  if (picked.has('routes')) { const R = overRoutes(K.rows); sec(`🚨 เส้นทางที่ต้องแก้ไข ${fmtN(R.length)} เส้นทาง`); R.slice(0, 5).forEach((r, i) => L.push(`${MD[i]} ${r.name} (${dcName(r.dc)}): ${fmtP(r.agg.pct)} · ส่วนเกิน ${fmtN(r.excess)} บาท`)); }
  if (picked.has('cars')) { const V = badCars(K.rows); sec(`🚛 รถผิดปกติ ${fmtN(V.length)} คัน`); V.slice(0, 5).forEach((v, i) => L.push(`${MD[i]} ${v.pl} (${dcName(v.dc)} · ${v.g}): ${fmtN(v.costPerTrip)} บาท/เที่ยว · มัธยฐาน ${fmtN(v.medianCostPerTrip)}`)); }
  if (picked.has('analysis')) { const { m, R } = NX.analysisRows(); sec(`🔎 ผลการวิเคราะห์: แย่สุดตาม ${m.t}`); R.slice(0, 3).forEach((o, i) => L.push(`${MD[i]} ${o.name} (${o.loc}): ${m.x(m.f(o))}`)); }
  if (window.NXS) NXS.bwText(L);
  return L.join('\n');
}
window.openExport = () => {
  if (!touched) { picked.clear(); (S.mode === 'day' && S.per !== 'all' ? ['kpi', 'dcg', 'dc', 'trend'] : ['kpi', 'trend', 'split', 'dc']).forEach(k => picked.add(k)); }
  openSheet(`<h2>แชร์และส่งออก</h2><p class="say" style="margin:0">${esc(NX.rangeLabel())} · ${esc(NX.scopeText())} ใช้ผลตามตัวกรองที่เลือกอยู่</p>
  <div class="checks">${SECS.map(([k, t]) => `<label><input type="checkbox" data-sec="${k}"${picked.has(k) ? ' checked' : ''}> ${t}</label>`).join('')}</div>
  <div class="btns"><button class="btn" data-act="doxlsx">Excel</button><button class="btn" data-act="dopptx">PowerPoint</button><button class="btn" data-act="dopng">รูปภาพ PNG</button><button class="btn" data-act="doinfo" style="background:linear-gradient(180deg,#f0d57a,#d4af37);color:#0a2a5e">อินโฟกราฟิก 1 หน้า</button></div>
  ${window.NXS ? NXS.dialogExtra() : ''}
  <label for="share-text"><b>ข้อความสรุป</b></label><textarea id="share-text">${esc(summaryText())}</textarea><button class="btn alt" data-act="docopy">คัดลอกข้อความ</button><p class="msg" id="xmsg" role="status"></p>`);
};
document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.sec; if (!k) return; touched = true; e.target.checked ? picked.add(k) : picked.delete(k); const t = $('#share-text'); if (t) t.value = summaryText(); });
const say = m => { const x = $('#xmsg'); if (x) x.textContent = m; };
function stamp() {
  let per = 'All';
  if (S.per !== 'all') { if (S.mode === 'month') per = S.per; else if (S.mode === 'week') { const p = S.per.split('-'); per = 'Week-' + p[0] + '-' + p[1].padStart(2, '0') + '-' + p[2].padStart(2, '0'); } else { const [d, m, y] = S.per.split('/'); per = (+y - 543) + '-' + m + '-' + d; } }
  return `NIMEX-Inbound-Cost-${per}-${{ all: 'All', AB: 'AB', CC: 'CC' }[S.group]}${S.dc !== 'all' ? '-DC' + S.dc : ''}${S.trip !== 'all' ? '-' + S.trip : ''}`;
}
const blob64 = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
async function save(filename, data) {
  if (window.__testSave) return window.__testSave(filename, data);
  const f = new File([data], filename, { type: 'application/octet-stream' }), u = await blob64(f), a = document.createElement('a');
  a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); say('ดาวน์โหลดไฟล์แล้ว: ' + filename);
}

/* ---- SVG pieces: วาดด้วยสีโหมดสว่างเสมอ ใช้ร่วมกันทั้งอินโฟกราฟิก PNG และสไลด์ ---- */
const IC = { star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', line: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>', pie: '<path d="M12 3a9 9 0 109 9h-9z"/><path d="M15 3.5A9 9 0 0120.5 9H15z"/>', pin: '<path d="M12 22s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>', swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>', route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 000-7H9a3.5 3.5 0 010-7h6.5"/>', alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>', analysis: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>', money: '<circle cx="12" cy="12" r="9"/><path d="M15 8.5H10.5a2 2 0 000 4h3a2 2 0 010 4H9M12 6v12"/>', pct: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 5-6 8-6s7 1 8 6"/>', truck: '<path d="M2 6h12v10H2zM14 9h4l4 4v3h-8z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>', box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>', bill: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>', avg: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>' };
const svgI = (n, x, y, s, col, sw = 2) => `<g transform="translate(${x} ${y}) scale(${s / 24})" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</g>`;
const SECI = { dcg: 'avg', kpi: 'star', trend: 'line', split: 'pie', dc: 'pin', cmp: 'swap', routes: 'route', cars: 'alert', analysis: 'analysis' };
const KI = { revenue: 'money', cost: 'user', pct: 'pct', points: 'pin', trips: 'truck', bills: 'bill', boxes: 'box', avgPoints: 'avg' };
const BAR = { good: '#6e93d6', warn: '#d9822b', bad: '#b8334a', none: '#d4af37' };
const PCOL = p => { const c = pc(p); return c === 'bad' ? '#b8334a' : c === 'warn' ? '#b5651d' : '#0b1f3f'; };
function embed(svg, x, y, w) { const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/), sc = w / +m[1], inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(/ data-(tip|act)="[^"]*"/g, ''); return { s: `<g transform="translate(${x} ${y}) scale(${sc})">${inner}</g>`, h: +m[2] * sc }; }
function miniTable(cols, data, W, h) {
  const rh = h ? Math.min(54, Math.max(24, h / (data.length + 1))) : 30, fs = rh >= 38 ? 16 : rh >= 32 ? 15 : 13.5, base = Math.round(rh / 2 + fs * .36), tw = cols.reduce((s, c) => s + c.w, 0); let x = 0; const xs = cols.map(c => { const a = x; x += c.w / tw * W; return a; });
  let s = `<rect width="${W}" height="${rh}" rx="6" fill="#0a2a5e"/>`;
  cols.forEach((c, i) => { const cw = c.w / tw * W, tx = c.r ? xs[i] + cw - 10 : c.c ? xs[i] + cw / 2 : xs[i] + 10; s += `<text x="${tx}" y="${base}" text-anchor="${c.r ? 'end' : c.c ? 'middle' : 'start'}" font-size="${fs}" font-weight="600" fill="#fff">${esc(c.t)}</text>`; });
  data.forEach((r, j) => { const y = (j + 1) * rh; if (j % 2) s += `<rect y="${y}" width="${W}" height="${rh}" fill="#f2f5fb"/>`; if (r.__hl) s += `<rect y="${y}" width="${W}" height="${rh}" fill="#fbf6e6"/>`; if (r.__sum) s += `<rect y="${y}" width="${W}" height="${rh}" fill="#e6ecf7"/>`;
    cols.forEach((c, i) => { const cw = c.w / tw * W, tx = c.r ? xs[i] + cw - 10 : c.c ? xs[i] + cw / 2 : xs[i] + 10, col = c.col ? c.col(r) : '#0b1f3f';
      if (c.rank) { const R = Math.min(11, rh / 2 - 3); s += `<circle cx="${tx}" cy="${y + rh / 2}" r="${R}" fill="${j < 3 ? '#b8334a' : '#6e93d6'}"/><text x="${tx}" y="${y + rh / 2 + 4.5}" text-anchor="middle" font-size="13" font-weight="600" fill="#fff">${j + 1}</text>`; return; }
      let t = String(c.f(r)); const maxCh = Math.floor(cw / (fs * .6)); if (t.length > maxCh && !c.r) t = t.slice(0, Math.max(3, maxCh - 1)) + '…';
      s += `<text x="${tx}" y="${y + base}" text-anchor="${c.r ? 'end' : c.c ? 'middle' : 'start'}" font-size="${fs}" font-weight="${i < 1 || r.__hl || r.__sum ? 600 : 400}" fill="${col}">${esc(t)}</text>`; }); });
  return { s, h: h ? Math.max(h, (data.length + 1) * rh) : (data.length + 1) * rh };
}
function kpiPiece(w, h) {
  const K = NX.kpiData(), St = NX.statData(K), all = S.group === 'all', gap = 12, sh = all ? 150 : 96, natCh = 132, cw = (w - 3 * gap) / 4, ch = h ? Math.max(natCh, (h - sh - 2 * gap) / 2) : natCh; let s = '';
  K.list.forEach((t, i) => { const x = i % 4 * (cw + gap), y = Math.floor(i / 4) * (ch + gap), bar = BAR[t.cls] || BAR.none, arrow = t.d ? (t.d.color === 'good' ? '#9fe3c4' : t.d.color === 'bad' ? '#ffb3bf' : '#cfdcf2') : '#cfdcf2';
    s += `<g transform="translate(${x} ${y})"><rect width="${cw}" height="${ch}" rx="14" fill="#0a2a5e"/><path d="M0 ${ch - 5}h${cw}v-.01c0 3-2 5-5 5H5c-3 0-5-2-5-5z" fill="${bar}"/><circle cx="24" cy="24" r="15" fill="#d4af37"/>${svgI(KI[t.id], 14, 14, 20, '#0a2a5e', 2.2)}<text x="${cw / 2}" y="${ch * .24}" text-anchor="middle" font-size="15" fill="#e6d79c">${esc(t.l)}</text><text x="${cw / 2}" y="${ch * .5 + 6}" text-anchor="middle" font-size="31" font-weight="600" fill="#fff">${esc(t.txt)}</text><text x="${cw / 2}" y="${ch * .5 + 30}" text-anchor="middle" font-size="12.5" fill="#cfdcf2">${esc(t.id === 'pct' ? 'KPI ≤ ' + fmtN(C.SETTINGS.kpi, 2) + '%' : t.unit)}${S.group === 'all' && t.id !== 'pct' ? '' : ''}</text>${t.dtxt ? `<text x="${cw / 2}" y="${ch - 16}" text-anchor="middle" font-size="13" fill="${arrow}">${esc(t.dtxt)} · ก่อนหน้า ${esc(t.prev)}</text>` : ''}${t.id === 'pct' ? `<rect x="${cw - 38}" y="9" width="28" height="28" rx="7" fill="${bar}"/><text x="${cw - 24}" y="29" text-anchor="middle" font-size="16" font-weight="600" fill="#fff">${t.cls === 'good' ? '✓' : t.cls === 'warn' ? '!' : '✕'}</text>` : ''}</g>`; });
  const y = 2 * ch + 2 * gap, DC = d => d ? (d.color === 'good' ? '#1f8a4c' : d.color === 'bad' ? '#b8334a' : '#55657f') : '#55657f', smx = o => fmtN(o.s) + ' / ' + fmtN(o.m), tp = St.trip;
  const boxes = [{ icon: 'truck', l: tp.l, v: smx(tp.T), u: '', dt: tp.P ? 'ก่อนหน้า ' + smx(tp.P.T) : 'นับใบงานต่อทะเบียนต่อวัน', dc: '#55657f', g: g => [smx(tp[g]), tp.P ? 'ก่อนหน้า ' + smx(tp.P[g]) : '', '#55657f'] },
    ...St.units.map(U => ({ icon: U.icon, l: U.l, v: U.x(U.T), u: U.u, dt: (U.dT ? U.dT.t + ' · ' : '') + (Number.isFinite(U.pT) ? 'ก่อนหน้า ' + U.x(U.pT) : 'ไม่มีช่วงก่อนหน้า'), dc: DC(U.dT), g: g => [U.x(U[g]), U['d' + g] ? U['d' + g].t : '', DC(U['d' + g])] }))];
  boxes.forEach((b, i) => { const x = i * (cw + gap); let t = `<g transform="translate(${x} ${y})"><rect width="${cw}" height="${sh}" rx="12" fill="#f2f5fb" stroke="#dbe3f0"/><circle cx="30" cy="34" r="19" fill="#0a2a5e"/>${svgI(b.icon, 19, 23, 22, '#d4af37')}<text x="60" y="24" font-size="13.5" fill="#55657f">${esc(b.l)}</text><text x="60" y="49" font-size="20" font-weight="600" fill="#0b1f3f">${esc(b.v)}${b.u ? `<tspan font-size="12.5" font-weight="400" fill="#55657f"> ${esc(b.u)}</tspan>` : ''}</text><text x="60" y="70" font-size="12.5" fill="${b.dc}">${esc(b.dt)}</text>`;
    if (all) { t += `<line x1="12" x2="${cw - 12}" y1="84" y2="84" stroke="#dbe3f0"/>`; ['AB', 'CC'].forEach((g, j) => { const [v, d, c] = b.g(g), yy = 108 + j * 26; t += `<text x="14" y="${yy}" font-size="13.5" font-weight="600" fill="${g === 'AB' ? '#b8860b' : '#1d57b8'}">${g}</text><text x="46" y="${yy}" font-size="15" font-weight="600" fill="#0b1f3f">${esc(v)}</text><text x="${cw - 12}" y="${yy}" text-anchor="end" font-size="12" fill="${c}">${esc(d)}</text>`; }); }
    s += t + '</g>'; });
  return { t: 'ผลสำคัญ' + (K.pr ? ' · ลูกศรเทียบ ' + K.pr.l : ''), s, h: y + sh };
}
function infoPiece(k, w, o = {}) {
  const P = LIGHT, K = NX.kpiData(), h = o.h, n = o.n || 6;
  if (k === 'kpi') return kpiPiece(w, h);
  if (k === 'trend') { const H = h ? Math.round(h) : Math.round(Math.max(220, w * .26)), tc = NX.trendChart(P, w, H - 30); if (!tc.svg) return { t: '% ค่าจ้างรายวัน', s: '', h: 20 };
    const e = embed(tc.svg, 0, 0, w), ser = tc.T.series; let lg = '', lw = ser.map(se => 34 + se.name.length * 8.5), tot = lw.reduce((a, b) => a + b, 0), lx = w / 2 - tot / 2;
    ser.forEach((se, i) => { lg += se.dash ? `<line x1="${lx}" x2="${lx + 16}" y1="${e.h + 16}" y2="${e.h + 16}" stroke="${se.color}" stroke-width="2.5" stroke-dasharray="4 3"/>` : `<rect x="${lx}" y="${e.h + 9}" width="14" height="14" rx="3" fill="${se.color}"/>`; lg += `<text x="${lx + 21}" y="${e.h + 21}" font-size="14" fill="#0b1f3f">${esc(se.name)}</text>`; lx += lw[i]; });
    return { t: tc.T.title + ' (ไม่แสดงวันอาทิตย์)', s: e.s + lg, h: e.h + 30 }; }
  if (k === 'dcg') { const H = Math.round(h || Math.max(340, w * .32)), e = embed(NX.dcBars(P, w, H, false), 0, 0, w), pr = K.pr; return { t: '% ค่าจ้างต่อรายได้ ราย DC แยก AB / CC' + (pr ? ' · ลูกศรเทียบ' + pr.l.replace(/\s*\(.*\)/, '') : ''), s: e.s, h: e.h }; }
  if (k === 'split') {
    const H = Math.max(200, h || 260), PA = K.PA, gs = ['AB', 'CC'].filter(g => S.group === 'all' || S.group === g), parts = NX.splitParts(K.A, P), kpi = C.SETTINGS.kpi;
    const narrow = w < 720, defs = [['เที่ยว', 'trips', v => fmtN(v), false, 0], ['จุดเฉลี่ย/เที่ยว', 'avgPoints', v => fmtN(v, 2), true, 0], ['รายได้', 'revenue', v => fmtN(v), true, 0], ['ค่าจ้าง', 'cost', v => fmtN(v), false, 0], ['% ค่าจ้าง', 'pct', fmtP, false, 1]];
    const band = narrow ? Math.min(H * .4, 190) : 0, Dm = narrow ? band : Math.min(H * .8, w * .34, 280), e = embed(NX.donut({ parts, center: fmtP(K.A.total.pct), sub: 'ค่าจ้าง ÷ รายได้', P }), 0, 0, Dm);
    let s = narrow ? e.s : `<g transform="translate(0 ${(H - Dm) / 2})">${e.s}</g>`;
    const x0 = narrow ? 0 : Dm + 26, rw = w - x0, ty = narrow ? band + 14 : 0, barsH = narrow ? 0 : (H >= 230 ? gs.length * 34 + 16 : 0), th = H - ty - barsH;
    const rh = th / (defs.length + 1), fs = rh >= 40 ? 16 : rh >= 32 ? 14.5 : 13, lc = rw * .28, cw = (rw - lc) / gs.length, bl = rh / 2 + fs * .36;
    s += `<g transform="translate(0 ${ty})"><rect x="${x0}" width="${rw}" height="${rh}" rx="6" fill="#0a2a5e"/><text x="${x0 + 10}" y="${bl}" font-size="${fs}" font-weight="600" fill="#fff">ตัวชี้วัด</text>` + gs.map((g, i) => `<text x="${x0 + lc + cw * i + cw / 2}" y="${bl}" text-anchor="middle" font-size="${fs}" font-weight="600" fill="#fff">${GNAME[g]}</text>`).join('');
    defs.forEach(([l, key, f, hi, isP], j) => { const y = (j + 1) * rh; if (j % 2) s += `<rect x="${x0}" y="${y}" width="${rw}" height="${rh}" fill="#f2f5fb"/>`; s += `<text x="${x0 + 10}" y="${y + bl}" font-size="${fs}" font-weight="600" fill="#0b1f3f">${l}</text>`;
      gs.forEach((g, i) => { const v = K.A[g][key], d = PA && PA[g].trips ? C.diff(v, PA[g][key], hi, !!isP) : null, cx = x0 + lc + cw * i + cw * .52, col = isP ? PCOL(v) : '#0b1f3f';
        s += `<text x="${cx}" y="${y + bl}" text-anchor="end" font-size="${fs}" font-weight="${isP ? 600 : 400}" fill="${col}">${esc(f(v))}</text>`;
        if (d && d.text) s += `<text x="${cx + 7}" y="${y + bl}" font-size="${fs - 3}" fill="${d.color === 'good' ? '#1f8a4c' : d.color === 'bad' ? '#b8334a' : '#55657f'}">${d.dir > 0 ? '▲' : d.dir < 0 ? '▼' : ''} ${esc(d.text)}</text>`; }); });
    s += '</g>';
    const bx0 = narrow ? Dm + 22 : x0, bw0 = w - bx0, by = narrow ? band / 2 - gs.length * 17 + 4 : th + 14;
    if (narrow || barsH) { const lw2 = 116, tw = bw0 - lw2 - 8, mxp = Math.max(kpi * 1.6, ...gs.map(g => K.A[g].pct || 0)) * 1.1, sx = v => bx0 + lw2 + tw * Math.min(v, mxp) / mxp;
      gs.forEach((g, i) => { const y = by + i * 34, v = K.A[g].pct || 0; s += `<text x="${bx0 + lw2 - 10}" y="${y + 15}" text-anchor="end" font-size="14" font-weight="600" fill="${GCOL(P, g)}">${g} ${fmtP(K.A[g].pct)}</text><rect x="${bx0 + lw2}" y="${y + 3}" width="${tw}" height="16" rx="8" fill="#e6ecf7"/><rect x="${bx0 + lw2}" y="${y + 3}" width="${Math.max(4, sx(v) - bx0 - lw2)}" height="16" rx="8" fill="${GCOL(P, g)}"/>`; });
      s += `<line x1="${sx(kpi)}" x2="${sx(kpi)}" y1="${by - 4}" y2="${by + gs.length * 34 - 6}" stroke="#b8334a" stroke-width="2.5" stroke-dasharray="4 3"/><text x="${sx(kpi) + 5}" y="${by + gs.length * 34 + 6}" font-size="12" fill="#b8334a">KPI ${fmtN(kpi, 2)}%</text>`; }
    return { t: 'AB แห้ง เทียบ CC เย็น' + (PA ? ' · ลูกศรเทียบช่วงก่อนหน้า' : ''), s, h: H }; }
  if (k === 'dc') { const rs = NX.filt({ dc: 'all' }), rows = []; NX.DCS.forEach(dc => { const x = rs.filter(r => r.dc === dc); if (!x.length) return; const A = C.aggregate(x); rows.push({ __hl: 1, name: NX.shortDc(dc), g: 'รวม', a: A.total }); ['AB', 'CC'].forEach(g => { if (A[g].trips) rows.push({ name: '', g, a: A[g] }); }); });
    const T = C.aggregate(rs).total; rows.push({ __sum: 1, name: 'รวมทุก DC', g: '', a: T });
    const t = miniTable([{ t: 'DC', w: 2.8, f: r => r.name }, { t: 'กลุ่ม', w: .9, c: 1, f: r => r.g, col: r => r.g === 'AB' ? '#b8860b' : r.g === 'CC' ? '#1d57b8' : '#0b1f3f' }, { t: 'เที่ยว', w: 1, r: 1, f: r => fmtN(r.a.trips) }, { t: 'รายได้', w: 1.7, r: 1, f: r => fmtN(r.a.revenue) }, { t: 'ค่าจ้าง', w: 1.5, r: 1, f: r => fmtN(r.a.cost) }, { t: '%', w: 1.2, r: 1, f: r => fmtP(r.a.pct), col: r => PCOL(r.a.pct) }], rows, w, h); return { t: 'ราย DC × กลุ่ม', s: t.s, h: t.h }; }
  if (k === 'cmp') { const { M, ms, rows, total } = NX.cmpRows(), N = ms.length, sel = ms.slice(-3), off = N - sel.length, gd = r => M.hi ? r.chg >= 0 : r.chg <= 0;
    const cols = [{ t: 'DC', w: 3.4, f: r => r.name }, ...sel.map((m, i) => ({ t: mLabel(m), w: 1.8, r: 1, f: r => M.x(r.vals[off + i]), col: r => M.isPct ? PCOL(r.vals[off + i]) : '#0b1f3f' }))]; if (N > 1) cols.push({ t: 'เปลี่ยน', w: 1.9, r: 1, f: r => Number.isFinite(r.chg) ? (r.chg >= 0 ? '▲ ' : '▼ ') + (M.isPct ? fmtN(Math.abs(r.chg), 2) + ' จุด' : M.x(Math.abs(r.chg))) : '–', col: r => Number.isFinite(r.chg) ? (gd(r) ? '#1d57b8' : '#b8334a') : '#55657f' });
    const t = miniTable(cols, [...rows, { ...total, __sum: 1 }], w, h); return { t: 'เทียบรายเดือนตาม DC: ' + M.t, s: t.s, h: t.h }; }
  if (k === 'routes') { const R = overRoutes(K.rows), t = miniTable([{ t: '#', w: .7, c: 1, rank: 1, f: () => '' }, { t: 'เส้นทาง', w: 4.2, f: r => r.name }, { t: 'DC', w: 1, f: r => r.dc }, { t: 'เที่ยว', w: 1, r: 1, f: r => fmtN(r.agg.trips) }, { t: '%', w: 1.3, r: 1, f: r => fmtP(r.agg.pct), col: r => PCOL(r.agg.pct) }, { t: 'ส่วนเกิน', w: 1.5, r: 1, f: r => fmtN(r.excess) }], R.slice(0, n), w, h); return { t: `เส้นทางที่ต้องแก้ไข ${fmtN(R.length)} เส้นทาง (ส่วนเกินมากสุด)`, s: t.s, h: t.h }; }
  if (k === 'cars') { const V = badCars(K.rows), t = miniTable([{ t: '#', w: .7, c: 1, rank: 1, f: () => '' }, { t: 'ทะเบียน', w: 1.8, f: v => v.pl }, { t: 'DC', w: 2.9, f: v => dcName(v.dc) }, { t: 'กลุ่ม', w: .9, c: 1, f: v => v.g }, { t: 'บาท/เที่ยว', w: 1.5, r: 1, f: v => fmtN(v.costPerTrip), col: () => '#b8334a' }, { t: 'มัธยฐาน', w: 1.4, r: 1, f: v => fmtN(v.medianCostPerTrip) }], V.slice(0, n), w, h); return { t: `รถผิดปกติ ${fmtN(V.length)} คัน (ค่าจ้าง/เที่ยว เกิน 1.5 เท่า)`, s: t.s, h: t.h }; }
  if (k === 'analysis') { const { m, R } = NX.analysisRows(), nm = NX.ADIM.find(a => a[0] === S.adim)[1], t = miniTable([{ t: '#', w: .7, c: 1, rank: 1, f: () => '' }, { t: nm, w: 3, f: x => x.name }, { t: 'DC / รายละเอียด', w: 3.4, f: x => x.loc }, { t: m.t.replace(' (บาท)', ''), w: 2.2, r: 1, f: x => m.x(m.f(x)) }], R.slice(0, n), w, h); return { t: `ผลการวิเคราะห์: ${Math.min(n, R.length)} อันดับแย่สุด`, s: t.s, h: t.h }; }
  if (k.indexOf('bw:') === 0 && window.NXS) return NXS.bwPiece(k, w, h, miniTable);
  return { t: '', s: '', h: 10 };
}
const CARD = { top: 52, pad: 18 };
function card(p, k, x, y, w, h) { return `<g transform="translate(${x} ${y})"><rect width="${w}" height="${h}" rx="16" fill="#fff" stroke="#dbe3f0"/><rect x="${w * .15}" y="-1.2" width="${w * .7}" height="2.4" fill="#d4af37"/><circle cx="${w / 2}" cy="0" r="19" fill="#0a2a5e" stroke="#d4af37" stroke-width="2"/>${svgI(SECI[k] || 'star', w / 2 - 11, -11, 22, '#f0d57a')}<text x="${w / 2}" y="${CARD.top - 12}" text-anchor="middle" font-size="18" font-weight="600" fill="#0a2a5e">${esc(p.t)}</text><g transform="translate(${CARD.pad} ${CARD.top})">${p.s}</g></g>`; }
const scopeLines = () => [NX.rangeLabel(), groupLine(), S.dc !== 'all' ? dcName(S.dc) : 'ทุก DC'].filter(Boolean);
function sheetHead(W, H0, id) {
  const pw = H0 > 120 ? Math.min(248, W * .19) : (W >= 1900 ? 300 : 150), ph = H0 - 46, ly = (H0 - 5 - ph) / 2, m = 24, L = scopeLines(), big = H0 > 120, dots = [.3, .42, .58, .7].map((f, i) => `<circle cx="${W * f}" cy="${H0 - 20 - (i % 2) * 14}" r="4" fill="#d4af37"/>`).join('');
  return `<defs><linearGradient id="${id}" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#071f4a"/><stop offset=".5" stop-color="#143f8c"/><stop offset="1" stop-color="#071f4a"/></linearGradient></defs><rect width="${W}" height="${H0}" fill="url(#${id})"/><path d="M${W * .24} ${H0 - 20}C${W * .3} ${H0 - 46} ${W * .36} ${H0 - 6} ${W * .42} ${H0 - 34}S${W * .54} ${H0 - 8} ${W * .58} ${H0 - 20}S${W * .68} ${H0 - 44} ${W * .76} ${H0 - 20}" fill="none" stroke="#6e93d6" stroke-width="2" stroke-dasharray="6 7" opacity=".55"/>${big ? dots : ''}<rect y="${H0 - 5}" width="${W}" height="5" fill="#d4af37"/>
  <rect x="${m}" y="${ly}" width="${pw}" height="${ph}" rx="14" fill="#fff"/><image x="${m + 10}" y="${ly + 8}" width="${pw - 20}" height="${ph - 16}" href="${LOGO}" preserveAspectRatio="xMidYMid meet"/>
  <text x="${W / 2}" y="${big ? 72 : 44}" text-anchor="middle" font-size="${Math.min(big ? 40 : 32, (W - 2 * (pw + m) - 36) / 15.5)}" font-weight="600" fill="#fff">NIMEX Inbound Cost Dashboard</text><text x="${W / 2}" y="${big ? 106 : 72}" text-anchor="middle" font-size="${big ? 22 : 17}" fill="#e6d79c">ต้นทุนงานเข้ารับเทียบรายได้</text>
  <rect x="${W - m - pw}" y="${ly}" width="${pw}" height="${ph}" rx="14" fill="rgba(255,255,255,.1)" stroke="#d4af37"/>${L.map((t, i) => `<text x="${W - m - pw / 2}" y="${ly + ph / 2 + (i - (L.length - 1) / 2) * (big ? 30 : 21) + (big ? 8 : 5)}" text-anchor="middle" font-size="${Math.min(i ? (big ? 16 : 12.5) : (big ? 22 : 15), (pw - 16) / Math.max(1, t.length) * 1.75)}" font-weight="${i ? 400 : 600}" fill="#fff">${esc(t)}</text>`).join('')}`;
}
const sheetFoot = (W, H, h) => `<rect y="${H - h}" width="${W}" height="${h}" fill="#0a2a5e"/><rect y="${H - h}" width="${W}" height="3" fill="#d4af37"/><text x="${W / 2}" y="${H - h / 2 + 6}" text-anchor="middle" font-size="14" fill="#dfe8f7">% ค่าจ้าง = ค่าจ้าง ÷ รายได้ × 100 · KPI ≤ ${fmtN(C.SETTINGS.kpi, 2)}% · ค่าจ้างที่เป็น 0 ใช้ค่าประมาณการ · วันอาทิตย์คิดใน KPI แต่ไม่แสดงในกราฟรายวัน</text>`;
const fontCss = () => document.getElementById('fontcss').textContent;
const wrap = (W, H, inner) => ({ svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>${fontCss()}text{font-family:Prompt,sans-serif}</style><rect width="${W}" height="${H}" fill="#eef2f9"/>${inner}</svg>`, W, H });
function infoMeasure(keys, W) {
  const m = 26, g = m, head = 176, foot = 46, ch = CARD.top + CARD.pad, inner = W - 2 * m, hw = (inner - g) / 2, fullK = keys.filter(k => k === 'kpi' || k === 'dcg' || (k === 'trend' && !(S.mode === 'day' && S.per !== 'all'))), halfK = keys.filter(k => !fullK.includes(k)); if (halfK.length === 1) { fullK.push(halfK[0]); halfK.length = 0; }
  const F = fullK.map(k => ({ k, nh: infoPiece(k, inner - 2 * CARD.pad).h })), Cc = [[], []], cH = [0, 0];
  halfK.forEach(k => { const nh = infoPiece(k, hw - 2 * CARD.pad).h, c = cH[0] <= cH[1] ? 0 : 1; Cc[c].push({ k, nh }); cH[c] += nh + ch + (Cc[c].length > 1 ? g : 0); });
  const colH = Math.max(...cH), blocks = F.length + (colH ? 1 : 0), used = head + foot + g * (blocks + 1) + F.reduce((s, f) => s + f.nh + ch, 0) + colH;
  return { W, m, g, head, foot, ch, inner, hw, F, C: Cc, cH, colH, blocks, used };
}
function infographic(keys) {
  const ratio = 1754 / 1240; let lo = 1080, hi = 2000, best = infoMeasure(keys, lo);
  if (best.used > lo * ratio) { for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2, T = infoMeasure(keys, mid); if (T.used <= mid * ratio) { hi = mid; best = T; } else lo = mid; } if (best.used > best.W * ratio) best = infoMeasure(keys, hi); }
  const T = best, { W, m, g, head, foot, ch, inner, hw, F, colH } = T, H = Math.round(W * ratio), spare = Math.max(0, H - T.used), base = F.reduce((s, f) => s + f.nh, 0) + colH || 1, f = 1 + spare / base;
  let y = head + g, b = ''; F.forEach(x => { const h = x.nh * f, p = infoPiece(x.k, inner - 2 * CARD.pad, { h }); b += card(p, x.k, m, y, inner, h + ch); y += h + ch + g; });
  const colFinal = colH * f; T.C.forEach((c, ci) => { if (!c.length) return; const gaps = (c.length - 1) * g, chr = c.length * ch, sum = c.reduce((s, x) => s + x.nh, 0), sc = (colFinal - gaps - chr) / sum; let yy = y; c.forEach(x => { const h = x.nh * sc, p = infoPiece(x.k, hw - 2 * CARD.pad, { h }); b += card(p, x.k, m + ci * (hw + g), yy, hw, h + ch); yy += h + ch + g; }); });
  return wrap(W, H, sheetHead(W, head, 'hg') + b + sheetFoot(W, H, foot));
}
function slideSheet(k) { const W = 1600, H = 900, head = 104, foot = 40, m = 26, cw = W - 2 * m, top = head + m, cardH = H - head - foot - 2 * m, h = cardH - CARD.top - CARD.pad, p = infoPiece(k, cw - 2 * CARD.pad, { h, n: 10 }); return wrap(W, H, sheetHead(W, head, 'sg') + card(p, k, m, top, cw, cardH) + sheetFoot(W, H, foot)); }
function compose(keys) { const W = 1240, m = 26, head = 176, foot = 46, ch = CARD.top + CARD.pad, inner = W - 2 * m - 2 * CARD.pad; let y = head + m, b = ''; keys.forEach(k => { const p = infoPiece(k, inner, { n: 10 }); b += card(p, k, m, y, W - 2 * m, p.h + ch); y += p.h + ch + m; }); const H = y + foot; return wrap(W, H, sheetHead(W, head, 'cg') + b + sheetFoot(W, H, foot)); }
function toPng(c, scale) { return new Promise((res, rej) => { const area = c.W * c.H * scale * scale; if (area > 16e6) scale = Math.sqrt(16e6 / (c.W * c.H)); const u = URL.createObjectURL(new Blob([c.svg], { type: 'image/svg+xml' })), im = new Image(); im.onload = () => setTimeout(() => { const cv = document.createElement('canvas'); cv.width = Math.round(c.W * scale); cv.height = Math.round(c.H * scale); const x = cv.getContext('2d'); x.drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u); cv.toBlob(b => b ? res(b) : rej(new Error('png')), 'image/png'); }, 150); im.onerror = rej; im.src = u; }); }
function sheetsData() {
  const out = [], K = NX.kpiData(), rnd = (v, d = 2) => Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : '';
  const aggHead = ['เที่ยว', 'จุด', 'จุด/เที่ยว', 'บิล', 'กล่อง', 'รายได้', 'ค่าจ้าง', '% ค่าจ้าง'], aggVals = a => [a.trips, a.points, rnd(a.avgPoints), a.bills, a.boxes, rnd(a.revenue, 0), rnd(a.cost, 0), rnd(a.pct)];
  out.push(['ตัวกรอง', [['ช่วงเวลา', NX.rangeLabel()], ['ขอบเขต', NX.scopeText()], ['KPI % ค่าจ้าง', C.SETTINGS.kpi], ['สร้างเมื่อ', new Date().toLocaleString('th-TH')]]]);
  if (picked.has('kpi')) out.push(['KPI', [['ตัวชี้วัด', 'รวม', 'AB แห้ง', 'CC เย็น', 'ช่วงก่อนหน้า', 'เปลี่ยน'], ...K.list.map(k => { const M = MET[k.id]; return [k.l, rnd(M.f(K.A.total)), rnd(M.f(K.A.AB)), rnd(M.f(K.A.CC)), K.PA ? rnd(M.f(K.PA.total)) : '', k.dtxt]; }), ...(() => { const St = NX.statData(K), tp = St.trip; return [['เที่ยวเดี่ยว', tp.T.s, tp.AB.s, tp.CC.s, tp.P ? tp.P.T.s : '', ''], ['หลายเที่ยว', tp.T.m, tp.AB.m, tp.CC.m, tp.P ? tp.P.T.m : '', ''], ...St.units.map(U => [U.l + ' (' + U.u + ')', rnd(U.T), rnd(U.AB), rnd(U.CC), Number.isFinite(U.pT) ? rnd(U.pT) : '', U.dT ? U.dT.t : ''])]; })(), ...(K.pr ? [[], ['ช่วงก่อนหน้า', K.pr.l]] : [])]]);
  if (picked.has('trend')) { const da = C.dailyAgg(K.rows); out.push(['รายวัน', [['วันที่', ...aggHead, 'AB % ค่าจ้าง', 'CC % ค่าจ้าง'], ...da.dates.map(dt => { const o = da.byDate[dt]; return [dt, ...aggVals(o.total), rnd(o.AB.pct), rnd(o.CC.pct)]; })]]); }
  if (picked.has('split')) out.push(['AB-CC', [['กลุ่ม', ...aggHead], ...['total', 'AB', 'CC'].map(g => [{ total: 'รวม', AB: 'AB แห้ง', CC: 'CC เย็น' }[g], ...aggVals(K.A[g])])]]);
  if (picked.has('dc')) out.push(['ราย DC', [['DC', 'กลุ่ม', 'คัน', 'เส้นทาง', ...aggHead], ...NX.dcAgg(NX.filt({ dc: 'all' })).flatMap(d => [[d.name, 'รวม', d.cars, d.routes, ...aggVals(d.agg)], ...['AB', 'CC'].filter(g => d[g].trips).map(g => [d.name, g, new Set(d.rows.filter(r => r.g === g).map(r => r.pl)).size, new Set(d.rows.filter(r => r.g === g).map(r => r.dc + '|' + (r.rc || r.rd))).size, ...aggVals(d[g])])])]]);
  if (picked.has('dcg')) out.push(['DC แยก AB-CC', [['DC', 'กลุ่ม', 'เที่ยว', 'รายได้', 'ค่าจ้าง', '% ค่าจ้าง', '% ช่วงก่อนหน้า', 'เปลี่ยน (จุด)', 'หมายเหตุ'], ...NX.dcGroupData().flatMap(d => d.g.map(x => [d.name, x.g, x.a.trips, rnd(x.a.revenue, 0), rnd(x.a.cost, 0), rnd(x.a.pct), x.b ? rnd(x.b.pct) : '', x.b && Number.isFinite(x.a.pct) && Number.isFinite(x.b.pct) ? rnd(x.a.pct - x.b.pct) : '', x.a.trips ? '' : NX.emptyNote(d.dc, x.g)]))]]);
  if (picked.has('cmp')) { const { M, ms, rows, total } = NX.cmpRows(); out.push(['เทียบรายเดือน', [['DC (' + M.t + ')', 'คัน', ...ms.map(mLabel), 'เปลี่ยน'], ...[...rows, total].map(r => [r.name, r.cars, ...r.vals.map(v => rnd(v)), rnd(r.chg)])]]); }
  if (picked.has('routes')) out.push(['เส้นทาง', [['DC', 'รหัสเส้นทาง', 'เส้นทาง', 'กลุ่ม', 'คัน', ...aggHead, 'ส่วนเกิน KPI'], ...NX.routeAgg(K.rows).sort((a, b) => b.excess - a.excess).map(r => [r.dc, r.rc, r.rd, r.g, r.cars, ...aggVals(r.agg), rnd(r.excess, 0)])]]);
  if (picked.has('cars')) out.push(['รายทะเบียน', [['ทะเบียน', 'DC', 'กลุ่ม', 'เส้นทางหลัก', ...aggHead, 'ค่าจ้าง/เที่ยว', 'มัธยฐาน DC+กลุ่ม', 'สถานะ'], ...NX.vehAgg(K.rows).map(v => [v.pl, v.dc, v.g, v.routeTop, ...aggVals(v.agg), rnd(v.costPerTrip, 0), rnd(v.medianCostPerTrip, 0), v.anomaly ? 'ผิดปกติ' : 'ปกติ'])]]);
  if (picked.has('analysis')) { const { m, R } = NX.analysisRows(); out.push(['ผลการวิเคราะห์', [['อันดับ', 'รายการ', 'DC / รายละเอียด', 'เที่ยว', 'รายได้', 'ค่าจ้าง', m.t], ...R.map((o, i) => [i + 1, o.name, o.loc, o.agg.trips, rnd(o.agg.revenue, 0), rnd(o.agg.cost, 0), rnd(m.f(o))])]]); }
  if (picked.has('rows')) out.push(['ใบงาน', [['เลขที่ใบรายการ', 'วันที่', 'DC', 'ชื่อ DC', 'ทะเบียน', 'กลุ่ม', 'รหัสเส้นทาง', 'เส้นทาง', 'ประเภทอัตรา', 'บิล', 'กล่อง', 'จุด', 'รายได้', 'ค่าจ้างเดิม', 'ค่าจ้างที่ใช้', 'ประมาณการ', 'หลายเที่ยว', '% ค่าจ้าง'], ...K.rows.map(r => [r.i, r.dt, r.dc, r.dn, r.pl, r.g, r.rc, r.rd, r.rty, r.bl, r.bx, r.pt, r.rv, r.co, rnd(r.effCost), r.isEstimated ? 'ใช่' : '', r.isMulti ? 'ใช่' : '', rnd(r.pct)])]]);
  if (window.NXS) NXS.bwSheets(out);
  return out;
}
window.doExport = async a => {
  const bwk = window.NXS ? NXS.BW_KEYS.map(k => 'bw:' + k) : [], keys = [...SECS.map(s => s[0]), ...bwk].filter(k => picked.has(k) && k !== 'rows');
  if (a === 'docopy') { const t = $('#share-text'); try { await navigator.clipboard.writeText(t.value); say('คัดลอกแล้ว นำไปวางใน LINE หรือแอปอื่นได้เลย'); } catch (e) { t.select(); say('เลือกข้อความแล้ว กดคัดลอกจากเมนูของเครื่อง'); } return; }
  if (a === 'doaction169') { document.querySelectorAll('#sheet .btn').forEach(b => b.disabled = true); say('กำลังสร้าง Action Plan 16:9…'); try { await document.fonts.ready; await save(stamp() + '-ActionPlan-16x9.png', await NXAP.exportAction()); } catch (e) { say('สร้าง Action Plan ไม่สำเร็จ'); console.error(e); } document.querySelectorAll('#sheet .btn').forEach(b => b.disabled = false); return; }
  if (a === 'dowd169') { document.querySelectorAll('#sheet .btn').forEach(b => b.disabled = true); say('กำลังสร้างอินโฟแยกวันทำการ 16:9…'); try { await document.fonts.ready; await save(stamp() + '-Weekday-Plan-16x9.png', await NXWD.exportWeekday()); } catch (e) { say('สร้างอินโฟแยกวันทำการไม่สำเร็จ'); console.error(e); } document.querySelectorAll('#sheet .btn').forEach(b => b.disabled = false); return; }
  if (a === 'doinfo169h') { document.querySelectorAll('#sheet .btn').forEach(b => b.disabled = true); say('กำลังสร้างอินโฟกราฟิก 16:9 หน้าหลัก…'); try { await document.fonts.ready; await save(stamp() + '-Home-16x9.png', await NXS.exportInfo169Home()); } catch (e) { say('สร้างอินโฟกราฟิกไม่สำเร็จ'); console.error(e); } document.querySelectorAll('#sheet .btn').forEach(b => b.disabled = false); return; }
  if (a === 'doinfo169') { document.querySelectorAll('#sheet .btn').forEach(b => b.disabled = true); say('กำลังสร้างอินโฟกราฟิก 16:9…'); try { await document.fonts.ready; await save(stamp() + '-Infographic-16x9.png', await NXS.exportInfo169()); } catch (e) { say('สร้างอินโฟกราฟิกไม่สำเร็จ'); console.error(e); } document.querySelectorAll('#sheet .btn').forEach(b => b.disabled = false); return; }
  if (!picked.size || (a !== 'doxlsx' && !keys.length)) { say('เลือกอย่างน้อย 1 ส่วนก่อน'); return; }
  document.querySelectorAll('#sheet .btn').forEach(b => b.disabled = true); say('กำลังสร้างไฟล์…');
  try {
    await document.fonts.ready;
    if (a === 'doxlsx') { if (!window.XLSX) throw new Error('lib'); const wb = XLSX.utils.book_new(); sheetsData().forEach(([n, d]) => { const ws = XLSX.utils.aoa_to_sheet(d); ws['!cols'] = (d[0] || []).map((_, i) => ({ wch: i ? 14 : 26 })); XLSX.utils.book_append_sheet(wb, ws, n.slice(0, 31)); }); await save(stamp() + '.xlsx', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })])); }
    if (a === 'dopng') { const b = await toPng(compose(keys), 2.5); await save(stamp() + '.png', b); }
    if (a === 'doinfo') { const c = infographic(keys), b = await toPng(c, 2480 / c.W); await save(stamp() + '-Infographic.png', b); }
    if (a === 'dopptx') {
      if (!window.PptxGenJS) throw new Error('lib');
      const p = new PptxGenJS(); p.layout = 'LAYOUT_WIDE'; const t = p.addSlide(); t.background = { color: '0A2A5E' };
      t.addShape(p.ShapeType.roundRect, { x: 5.17, y: .9, w: 3, h: 2.1, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, rectRadius: .12 });
      t.addImage({ data: LOGO, x: 5.37, y: 1.05, w: 2.6, h: 1.8, sizing: { type: 'contain', w: 2.6, h: 1.8 } });
      t.addText('NIMEX Inbound Cost Dashboard', { x: 0, y: 3.4, w: 13.33, h: .9, align: 'center', color: 'FFFFFF', fontFace: 'Tahoma', fontSize: 36, bold: true });
      t.addShape(p.ShapeType.rect, { x: 4.67, y: 4.4, w: 4, h: .04, fill: { color: 'D4AF37' }, line: { color: 'D4AF37' } });
      t.addText(`ต้นทุนงานเข้ารับเทียบรายได้ · ${NX.rangeLabel()}`, { x: 0, y: 4.6, w: 13.33, h: .7, align: 'center', color: 'E6D79C', fontFace: 'Tahoma', fontSize: 20 });
      t.addText(NX.scopeText(), { x: 0, y: 5.25, w: 13.33, h: .6, align: 'center', color: 'CFDCF2', fontFace: 'Tahoma', fontSize: 16 });
      for (const k of keys) { const u = await blob64(await toPng(slideSheet(k), 1.5)); p.addSlide().addImage({ data: u, x: 0, y: 0, w: 13.33, h: 7.5 }); }
      const buf = await p.write({ outputType: 'arraybuffer' }); await save(stamp() + '.pptx', new Blob([buf]));
    }
  } catch (e) { say(e && e.message === 'lib' ? 'โหลดตัวช่วยส่งออกไม่สำเร็จ ลองเปิดหน้าใหม่อีกครั้ง' : 'สร้างไฟล์ไม่สำเร็จ ลองเลือกส่วนน้อยลง'); console.error(e); }
  document.querySelectorAll('#sheet .btn').forEach(b => b.disabled = false);
};
window.NXA = { infographic, slideSheet, compose, sheetsData, summaryText, picked, toPng, stamp, card, sheetHead, sheetFoot, wrap, infoPiece, kpiPiece, miniTable, svgI, embed, CARD, PCOL };
render(true);
})();
