/* NIMEX Inbound Cost Dashboard — Action Plan 16:9 (เฉพาะผู้ดูแล)
   1) ผล  2) ปัญหา (ตรวจจากข้อมูลด้วยกฎตายตัว เรียงตามเงินที่เกิน 5 อันดับ)  3) แนวทางแก้ไข  4) ไทม์ไลน์ 3 ระยะ
   ตัวเลขทั้งหมดมาจาก nim-calc.js ผ่าน window.NX ข้อความแนวทาง/ผู้รับผิดชอบแก้ได้ในหน้าตั้งค่า (จำในเบราว์เซอร์เครื่องนี้) */
'use strict';
(function () {
const NX = window.NX, C = NX.C, S = NX.S, { esc, fmtN, fmtP } = NX, A = () => window.NXA, SX = () => window.NXS;
const LS = 'nimActionTpl1';
const TYPES = {
  dcg: { n: 'DC × กลุ่ม เกิน KPI', sol: 'ทบทวนอัตราค่าจ้างเทียบรายได้ของกลุ่ม รวมรอบ หรือเพิ่มจุดต่อเที่ยว', owner: 'DC Leader + Fleet Planning', steps: ['ตรวจรอบ/อัตรา', 'ปรับรอบ/อัตรา', 'วัดผลซ้ำ'] },
  route: { n: 'เส้นทางเกิน KPI', sol: 'จัดเส้นทางใหม่ ยุบรวมเส้นทางที่จุดน้อย หรือเจรจาอัตราค่าจ้างเส้นทาง', owner: 'Fleet Planning', steps: ['คัดเส้นทาง', 'ปรับเส้นทาง/อัตรา', 'วัดผลซ้ำ'] },
  rev: { n: 'รายได้ต่ำผิดปกติ', sol: 'ตรวจการบันทึกรายได้ในรายงาน NIMEX06006 ถ้าข้อมูลถูกต้อง ให้ทบทวนอัตรา หรือยุบรวมเส้นทาง', owner: 'DC Leader', steps: ['ตรวจข้อมูล', 'แก้ไข/ทบทวน', 'ติดตาม'] },
  car: { n: 'รถค่าจ้างต่อเที่ยวสูงผิดปกติ', sol: 'ตรวจใบงานรายคันกับผู้รับเหมา เทียบค่าจ้างต่อเที่ยวกับมัธยฐานของ DC และกลุ่ม', owner: 'DC Leader', steps: ['ตรวจใบงาน', 'คุยผู้รับเหมา', 'ติดตาม'] },
  unit: { n: 'ต้นทุนต่อหน่วยแย่ลง', sol: 'หาสาเหตุที่ต้นทุนต่อหน่วยเพิ่ม (จุด บิล ชิ้น ต่อเที่ยวลดลง หรือค่าจ้างเพิ่ม) แล้วปรับการจัดรถ', owner: 'Fleet Planning', steps: ['วิเคราะห์สาเหตุ', 'ปรับการจัดรถ', 'วัดผลซ้ำ'] },
  data: { n: 'ข้อมูลไม่ครบ', sol: 'แก้ใบงานที่ค่าจ้างเป็น 0 หรือไม่มีรายได้ในระบบต้นทาง แล้วเติมไฟล์ใหม่', owner: 'DC Leader', steps: ['แก้ข้อมูล', 'เติมไฟล์ใหม่', 'ตรวจซ้ำ'] },
  ok: { n: 'ผ่านเกณฑ์', sol: 'รักษาระดับ ติดตามรายสัปดาห์ และแชร์วิธีจัดรถของ DC ที่ดีให้ DC อื่น', owner: 'DC Leader + Fleet Planning', steps: ['ติดตาม', 'แชร์แนวทาง', 'ทบทวนเดือน'] }
};
let TPL = {};
try { TPL = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { TPL = {}; }
Object.values(TPL).forEach(o => { if (o && typeof o.owner === 'string') o.owner = o.owner.replace(/หัวหน้า DC/g, 'DC Leader'); });   // ชื่อตำแหน่งใหม่
const tpl = t => ({ ...TYPES[t], ...(TPL[t] || {}) });
const saveTpl = () => { try { localStorage.setItem(LS, JSON.stringify(TPL)); } catch (e) {} };

/* ---------- ระยะเวลา (นับจากวันที่ส่งออก) ---------- */
const MTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const dd = d => d.getDate() + ' ' + MTH[d.getMonth()];
function phases(now = new Date()) {
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()), add = n => new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + n);
  let eom = new Date(t0.getFullYear(), t0.getMonth() + 1, 0); if ((eom - add(14)) / 864e5 < 3) eom = new Date(t0.getFullYear(), t0.getMonth() + 2, 0);
  return [{ k: 'u', n: 'เร่งด่วน', d: add(3), l: 'ภายใน 3 วัน', c: '#b8334a' }, { k: 's', n: 'ระยะสั้น', d: add(14), l: 'ภายใน 2 สัปดาห์', c: '#d9822b' }, { k: 'f', n: 'ติดตาม', d: eom, l: 'สิ้นเดือน', c: '#1d57b8' }];
}

/* ---------- ตรวจปัญหาจากข้อมูล ---------- */
function plan() {
  const K = NX.kpiData(), rows = K.rows, T = K.A.total, kpi = C.SETTINGS.kpi, St = NX.statData(K), ex = a => a.cost - a.revenue * kpi / 100;
  const pctItem = K.list.find(k => k.id === 'pct');
  const res = { pct: T.pct, grade: T.trips ? SX().grade(T.pct) : '–', gap: T.pct - kpi, excess: Math.max(0, ex(T)), trips: T.trips, revenue: T.revenue, cost: T.cost, d: pctItem.d, dtxt: pctItem.dtxt, prev: pctItem.prev, pr: K.pr, cls: pctItem.cls };
  const P = [];
  // 1) DC × กลุ่ม เกิน KPI
  const gs = S.group === 'all' ? ['AB', 'CC'] : [S.group], dcs = S.dc === 'all' ? NX.DCS : [S.dc];
  dcs.forEach(dc => gs.forEach(g => {
    const a = C.aggregate(rows.filter(r => r.dc === dc && r.g === g)).total; if (!a.trips || !(a.pct > kpi)) return;
    const mid = Math.max(kpi, Math.round((a.pct - (a.pct - kpi) / 2) * 10) / 10);
    P.push({ t: 'dcg', title: `${NX.shortDc(dc)} · ${g === 'AB' ? 'AB แห้ง' : 'CC เย็น'} % ค่าจ้างเกิน KPI`, ev: `${fmtP(a.pct)} (เกิน ${fmtN(a.pct - kpi, 2)} จุด) · ${fmtN(a.trips)} เที่ยว · ส่วนเกิน ฿${fmtN(ex(a))}`, money: ex(a), target: `2 สัปดาห์ ≤ ${fmtN(mid, 1)}% · สิ้นเดือน ≤ ${fmtN(kpi, 1)}%` });
  }));
  // 2) เส้นทางรายได้ต่ำผิดปกติ (% ค่าจ้าง > 100%) และ 3) เส้นทางเกิน KPI (≥ 2 เที่ยว)
  const R = NX.routeAgg(rows), bad = R.filter(r => r.agg.revenue > 0 && r.agg.pct > 100).sort((a, b) => ex(b.agg) - ex(a.agg));
  if (bad.length) P.push({ t: 'rev', title: `เส้นทางรายได้ต่ำผิดปกติ ${fmtN(bad.length)} เส้นทาง`, ev: bad.slice(0, 2).map(r => `${r.rc || r.name} รายได้ ${fmtN(r.agg.revenue)} ค่าจ้าง ${fmtN(r.agg.cost)} (${fmtN(r.agg.pct, 0)}%)`).join(' · '), money: bad.reduce((s, r) => s + ex(r.agg), 0), target: `ตรวจครบ ${fmtN(bad.length)} เส้นทางใน 3 วัน` });
  const over = R.filter(r => r.agg.trips >= 2 && r.agg.pct > kpi && !(r.agg.pct > 100)).sort((a, b) => ex(b.agg) - ex(a.agg));
  if (over.length) { const m = over.reduce((s, r) => s + ex(r.agg), 0); P.push({ t: 'route', title: `เส้นทางเกิน KPI ${fmtN(over.length)} เส้นทาง`, ev: 'สูงสุด: ' + over.slice(0, 2).map(r => `${r.rc || r.name} ${fmtP(r.agg.pct)} (${fmtN(r.agg.trips)} เที่ยว)`).join(' · ') + ` · ส่วนเกินรวม ฿${fmtN(m)}`, money: m, target: `ส่วนเกินลดลงครึ่งหนึ่ง (≤ ฿${fmtN(m / 2)}) ภายในสิ้นเดือน` }); }
  // 4) รถผิดปกติ
  const V = NX.vehAgg(rows).filter(v => v.anomaly).map(v => ({ ...v, over: v.agg.cost - v.agg.trips * v.medianCostPerTrip })).sort((a, b) => b.over - a.over);
  if (V.length) P.push({ t: 'car', title: `รถค่าจ้างต่อเที่ยวสูงผิดปกติ ${fmtN(V.length)} คัน`, ev: V.slice(0, 2).map(v => `${v.pl} (${NX.shortDc(v.dc)} ${v.g}) ${fmtN(v.costPerTrip)} บาท/เที่ยว เทียบมัธยฐาน ${fmtN(v.medianCostPerTrip)}`).join(' · '), money: V.reduce((s, v) => s + Math.max(0, v.over), 0), target: 'ค่าจ้างต่อเที่ยว ≤ 1.5 เท่าของมัธยฐาน DC+กลุ่ม' });
  // 5) ต้นทุนต่อหน่วยแย่ลง
  const cnt = { cpt: T.trips, cpb: T.bills, cpx: T.boxes }, worse = St.units.filter(u => u.dT && u.dT.color === 'bad' && Number.isFinite(u.pT));
  if (worse.length) P.push({ t: 'unit', title: 'ต้นทุนต่อหน่วยแย่ลง: ' + worse.map(u => u.l.replace('ค่าจ้าง', '')).join(' / '), ev: worse.map(u => `${u.l} ${u.x(u.T)} ${u.dT.t} (ก่อนหน้า ${u.x(u.pT)})`).join(' · '), money: Math.max(...worse.map(u => (u.T - u.pT) * cnt[u.id])), target: worse.map(u => `${u.l.replace('ค่าจ้าง', '')} ≤ ${u.x(u.pT)}`).join(' · ') + ' ภายในสิ้นเดือน' });
  // 6) ข้อมูลไม่ครบ
  const noRev = rows.filter(r => !(r.rv > 0)).length, est = rows.filter(r => r.isEstimated).length;
  if (noRev + est) P.push({ t: 'data', title: `ข้อมูลไม่ครบ ${fmtN(noRev + est)} ใบงาน`, ev: `ไม่มีรายได้ ${fmtN(noRev)} ใบ · ค่าจ้างเป็น 0 (ใช้ค่าประมาณการ) ${fmtN(est)} ใบ`, money: 0, target: 'เหลือ 0 ใบ ในการเติมไฟล์รอบถัดไป' });
  P.sort((a, b) => b.money - a.money);
  const top = P.slice(0, 5);
  if (!top.length) top.push({ t: 'ok', title: 'ผ่านเกณฑ์ทุกข้อในเงื่อนไขนี้', ev: `% ค่าจ้าง ${fmtP(T.pct)} ≤ KPI ${fmtN(kpi, 2)}%`, money: 0, target: `รักษา ≤ ${fmtN(kpi, 1)}%` });
  return { res, items: top, total: P.length, ph: phases() };
}

/* ---------- ตัดบรรทัดภาษาไทย ---------- */
const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
const vis = s => s.replace(/[ัิ-ฺ็-๎]/g, '').length;
function wrap(text, maxW, fs, maxLines) {
  const parts = seg ? [...seg.segment(text)].map(x => x.segment) : text.split(/(\s+)/), lines = []; let cur = '';
  parts.forEach(p => { if (vis(cur + p) * fs * .56 > maxW && cur.trim()) { lines.push(cur.trim()); cur = p.trimStart(); } else cur += p; });
  if (cur.trim()) lines.push(cur.trim());
  if (maxLines && lines.length > maxLines) { const l = lines.slice(0, maxLines); l[maxLines - 1] = l[maxLines - 1].replace(/.{1}$/, '') + '…'; return l; }
  return lines;
}
const tx = (lines, x, y, fs, lh, attrs) => lines.map((l, i) => `<text x="${x}" y="${y + i * lh}" font-size="${fs}" ${attrs}>${esc(l)}</text>`).join('');

/* ---------- ภาพ 16:9 ---------- */
function infoAction() {
  const W = 1920, H = 1080, head = 120, foot = 44, m = 24, A_ = A(), INK = '#0b1f3f', MUT = '#55657f', PL = plan(), r = PL.res, kpi = C.SETTINGS.kpi;
  const GC = g => SX().gradeCol(g), PC = v => A_.PCOL(v), DCOL = d => d ? (d.color === 'good' ? '#1f8a4c' : d.color === 'bad' ? '#b8334a' : MUT) : MUT;
  let b = '';
  /* 1) ผล */
  const y0 = head + 16, rh0 = 118;
  b += `<g transform="translate(${m} ${y0})"><rect width="${W - 2 * m}" height="${rh0}" rx="16" fill="#0a2a5e"/><rect y="${rh0 - 5}" width="${W - 2 * m}" height="5" rx="2.5" fill="#d4af37"/>
  <circle cx="44" cy="${rh0 / 2}" r="24" fill="#d4af37"/><text x="44" y="${rh0 / 2 + 9}" text-anchor="middle" font-size="26" font-weight="700" fill="#0a2a5e">1</text><text x="82" y="42" font-size="20" font-weight="600" fill="#e6d79c">ผล</text><text x="82" y="70" font-size="14" fill="#cfdcf2">${esc(NX.rangeLabel())}</text><text x="82" y="92" font-size="14" fill="#cfdcf2">${esc(NX.scopeText())}</text>`;
  const cells = [
    { l: '% ค่าจ้างต่อรายได้', v: fmtP(r.pct), s: `KPI ≤ ${fmtN(kpi, 2)}%`, c: r.cls === 'bad' ? '#ffb3bf' : r.cls === 'warn' ? '#f6c48f' : '#fff', g: r.grade },
    { l: 'ห่างจาก KPI', v: Number.isFinite(r.gap) ? (r.gap > 0 ? '+' : '') + fmtN(r.gap, 2) + ' จุด' : '–', s: r.gap > 0 ? 'เกินเกณฑ์' : 'อยู่ในเกณฑ์', c: r.gap > 0 ? '#ffb3bf' : '#9fe3c4' },
    { l: 'ส่วนเกิน KPI (บาท)', v: fmtN(r.excess), s: 'ค่าจ้าง − รายได้ × KPI', c: '#fff' },
    { l: 'เทียบช่วงก่อนหน้า', v: r.dtxt || 'ไม่มีช่วงก่อนหน้า', s: r.pr ? 'ก่อนหน้า ' + r.prev : '', c: r.d ? (r.d.color === 'good' ? '#9fe3c4' : r.d.color === 'bad' ? '#ffb3bf' : '#fff') : '#cfdcf2' },
    { l: 'รายได้ / ค่าจ้าง / เที่ยว', v: `${NX.fmtK(r.revenue)} / ${NX.fmtK(r.cost)}`, s: fmtN(r.trips) + ' เที่ยว', c: '#fff' }];
  const cx0 = 560, cw = (W - 2 * m - cx0 - 20) / cells.length;
  cells.forEach((c, i) => { const x = cx0 + i * cw; b += `<line x1="${x}" x2="${x}" y1="18" y2="${rh0 - 22}" stroke="rgba(255,255,255,.18)"/><text x="${x + cw / 2}" y="34" text-anchor="middle" font-size="14" fill="#e6d79c">${esc(c.l)}</text><text x="${x + cw / 2 - (c.g ? 26 : 0)}" y="72" text-anchor="middle" font-size="${c.v.length > 14 ? 22 : 31}" font-weight="700" fill="${c.c}">${esc(c.v)}</text><text x="${x + cw / 2}" y="96" text-anchor="middle" font-size="12.5" fill="#cfdcf2">${esc(c.s)}</text>` + (c.g && c.g !== '–' ? `<rect x="${x + cw / 2 + 52}" y="44" width="38" height="36" rx="8" fill="${GC(c.g)}"/><text x="${x + cw / 2 + 71}" y="70" text-anchor="middle" font-size="22" font-weight="700" fill="#fff">${c.g}</text>` : ''); });
  b += '</g>';
  /* หัวตาราง 2) ปัญหา 3) แนวทางแก้ไข 4) ไทม์ไลน์ */
  const y1 = y0 + rh0 + 14, th = 50, colX = [m, m + 64, m + 64 + 560, m + 64 + 560 + 520], colW = [64, 560, 520, W - m - (m + 64 + 560 + 520)], tl = colX[3], tw = colW[3];
  const ph = PL.ph, pw = (tw - 24) / 3;
  b += `<rect x="${m}" y="${y1}" width="${W - 2 * m}" height="${th}" rx="10" fill="#0a2a5e"/>`;
  [['2', 'ปัญหา (เรียงตามเงินที่เกิน)'], ['3', 'แนวทางแก้ไข']].forEach(([n, t], i) => { const x = colX[i + 1]; b += `<circle cx="${x + 18}" cy="${y1 + th / 2}" r="14" fill="#d4af37"/><text x="${x + 18}" y="${y1 + th / 2 + 6}" text-anchor="middle" font-size="16" font-weight="700" fill="#0a2a5e">${n}</text><text x="${x + 42}" y="${y1 + th / 2 + 6}" font-size="18" font-weight="600" fill="#fff">${t}</text>`; });
  b += `<circle cx="${tl + 18}" cy="${y1 + th / 2}" r="14" fill="#d4af37"/><text x="${tl + 18}" y="${y1 + th / 2 + 6}" text-anchor="middle" font-size="16" font-weight="700" fill="#0a2a5e">4</text>`;
  ph.forEach((p, i) => { const x = tl + 40 + i * (pw - 6); b += `<text x="${x + pw / 2 - 16}" y="${y1 + 22}" text-anchor="middle" font-size="15" font-weight="600" fill="#fff">${p.n}</text><text x="${x + pw / 2 - 16}" y="${y1 + 41}" text-anchor="middle" font-size="12.5" fill="#e6d79c">${p.l} · ${dd(p.d)}</text>`; });
  /* แถวปัญหา */
  const yr = y1 + th + 8, avail = H - foot - 12 - yr, n = PL.items.length, rh = Math.min(158, (avail - (n - 1) * 8) / n);
  PL.items.forEach((it, i) => {
    const T = tpl(it.t), y = yr + i * (rh + 8), sev = it.t === 'ok' ? '#1f8a4c' : i === 0 ? '#b8334a' : i < 3 ? '#d9822b' : '#6e93d6';
    b += `<g transform="translate(0 ${y})"><rect x="${m}" width="${W - 2 * m}" height="${rh}" rx="12" fill="#fff" stroke="#dbe3f0"/><rect x="${m}" width="6" height="${rh}" rx="3" fill="${sev}"/>`;
    b += `<circle cx="${m + 34}" cy="30" r="17" fill="${sev}"/><text x="${m + 34}" y="36" text-anchor="middle" font-size="17" font-weight="700" fill="#fff">${it.t === 'ok' ? '✓' : i + 1}</text>`;
    const x1 = colX[1] + 8, w1 = colW[1] - 24;
    b += `<text x="${x1}" y="24" font-size="12.5" fill="${MUT}">${esc(T.n)}${it.money > 0 ? ' · ผลกระทบประมาณ ฿' + fmtN(it.money) : ''}</text>` + tx(wrap(it.title, w1, 18, 1), x1, 50, 18, 22, `font-weight="700" fill="${INK}"`) + tx(wrap(it.ev, w1, 14, Math.max(1, Math.floor((rh - 66) / 19))), x1, 76, 14, 19, `fill="${MUT}"`);
    const x2 = colX[2] + 8, w2 = colW[2] - 24;
    b += `<line x1="${colX[2] - 6}" x2="${colX[2] - 6}" y1="14" y2="${rh - 14}" stroke="#dbe3f0"/>` + tx(wrap(T.sol, w2, 15.5, Math.max(2, Math.floor((rh - 50) / 21))), x2, 32, 15.5, 21, `fill="${INK}"`) + `<text x="${x2}" y="${rh - 16}" font-size="13" fill="#0a2a5e"><tspan font-weight="700">ผู้รับผิดชอบ</tspan> ${esc(T.owner)}</text>`;
    b += `<line x1="${tl - 6}" x2="${tl - 6}" y1="14" y2="${rh - 14}" stroke="#dbe3f0"/>`;
    ph.forEach((p, k) => { const x = tl + 40 + k * (pw - 6), lab = T.steps[k] || ''; if (!lab || lab === '—') return; b += `<rect x="${x}" y="22" width="${pw - 32}" height="34" rx="9" fill="${p.c}" opacity="${k === 0 ? 1 : k === 1 ? .9 : .85}"/><text x="${x + (pw - 32) / 2}" y="44" text-anchor="middle" font-size="14" font-weight="600" fill="#fff">${esc(lab)}</text>${k < 2 && T.steps[k + 1] && T.steps[k + 1] !== '—' ? `<path d="M${x + pw - 30} 39 l12 0 m-5 -5 l5 5 -5 5" stroke="#9aa8bf" stroke-width="2" fill="none"/>` : ''}`; });
    b += tx(wrap('เป้าหมาย: ' + it.target, tw - 60, 13.5, 2), tl + 40, 82, 13.5, 19, `fill="${INK}"`) + `<text x="${tl + 40}" y="${rh - 16}" font-size="12.5" fill="${MUT}">เริ่ม ${dd(new Date())} · ${ph.map(p => p.n + ' ' + dd(p.d)).join(' → ')}</text></g>`;
  });
  /* ถ้ามีที่ว่างเหลือ (ปัญหาน้อยข้อ) แสดงไทม์ไลน์รวมแยกตามระยะ */
  const yEnd = yr + n * (rh + 8), left = H - foot - 12 - yEnd;
  if (left >= 120 && PL.items[0].t !== 'ok') {
    const cw3 = (W - 2 * m - 2 * 14) / 3;
    b += `<text x="${m + 4}" y="${yEnd + 22}" font-size="18" font-weight="700" fill="#0a2a5e">ไทม์ไลน์รวม · ใครทำอะไร เมื่อไร</text>`;
    ph.forEach((p, k) => {
      const x = m + k * (cw3 + 14), y = yEnd + 34, hh = left - 34, acts = PL.items.map((it, i) => { const T = tpl(it.t), st = T.steps[k]; return st && st !== '—' ? `${i + 1}. ${st} — ${T.owner}` : ''; }).filter(Boolean);
      b += `<rect x="${x}" y="${y}" width="${cw3}" height="${hh}" rx="12" fill="#fff" stroke="#dbe3f0"/><rect x="${x}" y="${y}" width="${cw3}" height="40" rx="12" fill="${p.c}"/><rect x="${x}" y="${y + 28}" width="${cw3}" height="12" fill="${p.c}"/><text x="${x + 16}" y="${y + 26}" font-size="16" font-weight="700" fill="#fff">${p.n} · ${p.l}</text><text x="${x + cw3 - 16}" y="${y + 26}" text-anchor="end" font-size="15" font-weight="600" fill="#fff">ครบกำหนด ${dd(p.d)}</text>`;
      const lh = Math.min(30, (hh - 56) / Math.max(1, acts.length));
      acts.forEach((t, j) => { b += tx(wrap(t, cw3 - 36, 15, 1), x + 18, y + 66 + j * lh, 15, 20, `fill="${INK}"`); });
    });
  }
  const ftxt = `ปัญหาตรวจจากข้อมูลตามตัวกรอง: DC×กลุ่มเกิน KPI · เส้นทางเกิน KPI (≥2 เที่ยว) · รายได้ต่ำผิดปกติ (% ค่าจ้าง >100%) · รถค่าจ้าง/เที่ยว >1.5× มัธยฐาน · ต้นทุนต่อหน่วยแย่ลง · ข้อมูลไม่ครบ · พบ ${fmtN(PL.total)} ข้อ แสดง ${fmtN(Math.min(5, PL.total))} ข้อแรก · ผลกระทบของแต่ละข้ออาจซ้อนกัน`;
  const footSvg = `<rect y="${H - foot}" width="${W}" height="${foot}" fill="#0a2a5e"/><rect y="${H - foot}" width="${W}" height="3" fill="#d4af37"/><text x="${W / 2}" y="${H - foot / 2 + 5}" text-anchor="middle" font-size="13" fill="#dfe8f7">${esc(ftxt)}</text>`;
  const svg = A_.wrap(W, H, A_.sheetHead(W, head, 'hap') + b + footSvg);
  svg.svg = svg.svg.replace('ต้นทุนงานเข้ารับเทียบรายได้</text>', 'Action Plan · ผล → ปัญหา → แนวทางแก้ไข → ไทม์ไลน์</text>');
  return svg;
}
async function exportAction() { return await A().toPng(infoAction(), 2); }

/* ---------- หน้าตั้งค่า: แก้แนวทาง/ผู้รับผิดชอบ/ขั้นตอน ---------- */
const VIEW = NX.VIEW, baseSettings = VIEW.settings;
VIEW.settings = () => baseSettings() + `<section class="card"><h2>แม่แบบ Action Plan</h2><p class="note">ข้อความที่ใช้ในภาพ Action Plan 16:9 · จำไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น · ขั้นตอน 3 ระยะคั่นด้วย / (ใส่ — ถ้าไม่มี)</p>
  <div class="tw"><table class="t"><thead><tr><th>ประเภทปัญหา</th><th>แนวทางแก้ไข</th><th>ผู้รับผิดชอบ</th><th>ขั้นตอน เร่งด่วน / ระยะสั้น / ติดตาม</th></tr></thead><tbody>${Object.keys(TYPES).map(t => { const T = tpl(t); return `<tr><td class="l">${esc(T.n)}</td><td class="l"><textarea data-apt="${t}:sol" rows="2" style="width:100%;min-width:260px;font:inherit">${esc(T.sol)}</textarea></td><td class="l"><input data-apt="${t}:owner" value="${esc(T.owner)}" style="width:100%;min-width:170px;font:inherit"></td><td class="l"><input data-apt="${t}:steps" value="${esc(T.steps.join(' / '))}" style="width:100%;min-width:240px;font:inherit"></td></tr>`; }).join('')}</tbody></table></div>
  <div class="btnrow" style="margin-top:8px"><button class="btn alt" data-apt-reset="1">คืนค่าเริ่มต้น</button></div><p class="msg" id="apt-msg" role="status"></p></section>`;
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.apt; if (!k) return; const [t, f] = k.split(':'), v = e.target.value.trim();
  TPL[t] = TPL[t] || {}; if (f === 'steps') { const s = v.split('/').map(x => x.trim()).filter(Boolean); TPL[t].steps = [s[0] || '—', s[1] || '—', s[2] || '—']; } else TPL[t][f] = v || TYPES[t][f];
  saveTpl(); const m = document.getElementById('apt-msg'); if (m) m.textContent = 'บันทึกแล้ว (เครื่องนี้)';
});
document.addEventListener('click', e => { if (!e.target.closest('[data-apt-reset]')) return; TPL = {}; saveTpl(); NX.render(true); });

window.NXAP = { plan, infoAction, exportAction, tpl, TYPES, phases };
})();
