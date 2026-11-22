/* NIMEX Inbound Cost Dashboard — แชร์/ส่งออกเพิ่มเติม (เฉพาะผู้ดูแล)
   1) เกรด A–F ของ % ค่าจ้าง (เกณฑ์ตั้งค่าได้ในหน้าตั้งค่า)
   2) ดีสุด/แย่สุด ราย DC / เส้นทาง / ทะเบียนรถ แยกตามตัวชี้วัด
   3) อินโฟกราฟิก 16:9 (1920×1080 → PNG 3840×2160) เลือกกราฟ 4 ด้านได้
   ตัวเลขมาจาก nim-calc.js ผ่าน window.NX ไม่มีสูตรคำนวณใหม่ของตัวเองนอกจากหน่วยต่อเที่ยว/บิล/ชิ้น (ค่าจ้าง ÷ จำนวน) */
'use strict';
(function () {
const NX = window.NX, C = NX.C, S = NX.S, { esc, fmtN, fmtP } = NX, A = () => window.NXA;
const LS = 'nimShareCfg2';

/* ---------- เกรด ---------- */
const GR = ['A', 'B', 'C', 'D', 'E', 'F'], GRC = ['#1d57b8', '#2f8f8f', '#b8860b', '#d9822b', '#c4563a', '#b8334a'];
const bounds = () => ['gA', 'gB', 'gC', 'gD', 'gE'].map(k => +C.SETTINGS[k]);
function grade(p) { if (p === null || p === undefined || !Number.isFinite(+p)) return '–'; const b = bounds(); for (let i = 0; i < 5; i++) if (p <= b[i]) return GR[i]; return 'F'; }
const gradeCol = g => GRC[GR.indexOf(g)] || '#55657f';
const gradeNote = () => { const b = bounds(); return `เกรด A ≤${fmtN(b[0], 1)}% · B ≤${fmtN(b[1], 1)}% · C ≤${fmtN(b[2], 1)}% · D ≤${fmtN(b[3], 1)}% · E ≤${fmtN(b[4], 1)}% · F สูงกว่า`; };

/* ---------- ตัวชี้วัด (ต่ำ = ดี ยกเว้นที่ hi) ---------- */
const BWM = {
  pct: { t: '% ค่าจ้างต่อรายได้', f: a => a.pct, x: v => fmtP(v), ax: v => fmtN(v, 1) + '%', hi: false },
  cpt: { t: 'ค่าจ้างต่อเที่ยว', f: a => a.trips ? a.cost / a.trips : NaN, x: v => fmtN(v), ax: v => fmtN(v), hi: false },
  cpb: { t: 'ค่าจ้างต่อบิล', f: a => a.bills ? a.cost / a.bills : NaN, x: v => fmtN(v, 2), ax: v => fmtN(v, 1), hi: false },
  cpx: { t: 'ค่าจ้างต่อชิ้น', f: a => a.boxes ? a.cost / a.boxes : NaN, x: v => fmtN(v, 2), ax: v => fmtN(v, 1), hi: false },
  avgPoints: { t: 'จุดเฉลี่ยต่อเที่ยว', f: a => a.avgPoints, x: v => fmtN(v, 2), ax: v => fmtN(v, 1), hi: true },
  revenue: { t: 'รายได้ (บาท)', f: a => a.revenue, x: v => fmtN(v), ax: v => NX.fmtK(v), hi: true },
  cost: { t: 'ค่าจ้าง (บาท)', f: a => a.cost, x: v => fmtN(v), ax: v => NX.fmtK(v), hi: false },
  trips: { t: 'เที่ยว', f: a => a.trips, x: v => fmtN(v), ax: v => fmtN(v), hi: false }
};
const BW_KEYS = ['pct', 'cpt', 'cpb', 'cpx', 'avgPoints'];
const LEVELS = { dc: 'DC', route: 'เส้นทาง', veh: 'ทะเบียนรถ' };

/* ---------- ค่าที่ผู้ใช้เลือกไว้ (จำในเบราว์เซอร์เครื่องนี้) ---------- */
/* กราฟ 4 ด้านเริ่มต้นตามสกิล: (1) แท่งแนวนอนตามกลุ่ม AB/CC (แยกงาน) พร้อมจำนวนเที่ยว (2) แท่งคู่ราย DC เทียบ AB/CC
   (3) แท่งคู่ราย DC ของ 2 ตัวชี้วัดที่เกี่ยวข้องกัน (รายได้ เทียบ ค่าจ้าง) (4) โดนัทสัดส่วนเกรด + แย่สุด 3 อันดับ */
const DEF = { level: 'dc', n: 5, slots: ['grp:pct', 'dc:pct', 'pair:revcost', 'donut'] };
let CFG = Object.assign({}, DEF);
try { const j = JSON.parse(localStorage.getItem(LS) || 'null'); if (j) CFG = Object.assign({}, DEF, j); } catch (e) {}
const saveCfg = () => { try { localStorage.setItem(LS, JSON.stringify(CFG)); } catch (e) {} };
const CHART_OPTS = [
  ...['pct', 'cpt', 'cpb', 'cpx', 'avgPoints'].map(m => ['grp:' + m, 'แท่งแนวนอน ตามกลุ่ม AB/CC พร้อมจำนวนเที่ยว · ' + BWM[m].t]),
  ['pair:revcost', 'แท่งคู่ ราย DC · รายได้ เทียบ ค่าจ้าง'],
  ['pair:billbox', 'แท่งคู่ ราย DC · ค่าจ้างต่อบิล เทียบ ค่าจ้างต่อชิ้น'],
  ...['pct', 'cpt', 'cpb', 'cpx', 'revenue', 'cost', 'trips', 'avgPoints'].map(m => ['dc:' + m, 'แท่ง ราย DC แยก AB/CC · ' + BWM[m].t]),
  ...['pct', 'cpt', 'cpb', 'cpx', 'revenue', 'cost', 'trips', 'avgPoints'].map(m => ['trend:' + m, 'เส้นรายวัน · ' + BWM[m].t]),
  ['donut', 'โดนัทสัดส่วนเกรดเส้นทาง + เส้นทางแย่สุด 3 อันดับ']
];

/* ---------- ดีสุด/แย่สุด ---------- */
function entities(level) {
  if (level === 'dc') return NX.dcAgg(NX.filt({ dc: 'all' })).map(o => ({ name: o.name, loc: fmtN(o.cars) + ' คัน', agg: o.agg }));
  if (level === 'route') return NX.routeAgg(NX.filt()).filter(o => o.agg.trips >= 2).map(o => ({ name: o.name, loc: NX.dcName(o.dc) + ' · ' + o.g, agg: o.agg }));
  return NX.vehAgg(NX.filt()).filter(v => v.agg.trips >= 2).map(v => ({ name: v.pl, loc: NX.dcName(v.dc) + ' · ' + v.g, agg: v.agg }));
}
/* ดีสุด k + แย่สุด k ไม่ซ้ำกัน: k = min(N, ครึ่งหนึ่งของจำนวนที่มี) */
function bwRank(id) {
  const M = BWM[id], L = entities(CFG.level).map(o => ({ ...o, v: M.f(o.agg) })).filter(o => Number.isFinite(o.v)).sort((a, b) => M.hi ? b.v - a.v : a.v - b.v);
  const len = L.length, k = len < 2 ? 0 : Math.min(CFG.n, Math.floor(len / 2));
  const lab = (o, i) => ({ ...o, lab: i < k ? 'ดีสุด' : i >= len - k ? 'แย่สุด' : '' });
  const all = L.map(lab);
  const rows = k ? [...all.slice(0, k), ...all.slice(len - k).reverse()] : all.slice(0, 1).map(o => ({ ...o, lab: '' }));
  return { M, k, len, rows, all };
}
function bwPiece(key, w, h, miniTable) {
  const id = key.slice(3), R = bwRank(id), LV = LEVELS[CFG.level];
  const t = `ดีสุด/แย่สุด ${LV} · ${R.M.t}` + (R.k ? ` (${R.k} + ${R.k} จาก ${R.len})` : ` (มี ${R.len} รายการ)`);
  if (!R.rows.length) return { t, s: `<text x="${w / 2}" y="40" text-anchor="middle" font-size="16" fill="#55657f">ไม่มีข้อมูลในตัวกรองนี้</text>`, h: 70 };
  const tb = miniTable([
    { t: '', w: 1.1, c: 1, f: r => r.lab, col: r => r.lab === 'ดีสุด' ? '#1f8a4c' : '#b8334a' },
    { t: LV, w: 3.1, f: r => r.name }, { t: 'รายละเอียด', w: 2.8, f: r => r.loc },
    { t: 'เที่ยว', w: 1, r: 1, f: r => fmtN(r.agg.trips) }, { t: R.M.t.replace(' (บาท)', ''), w: 1.8, r: 1, f: r => R.M.x(r.v) }], R.rows, w, h);
  return { t, s: tb.s, h: tb.h };
}
function bwText(L) {
  const keys = BW_KEYS.filter(k => A().picked.has('bw:' + k));
  keys.forEach(id => {
    const R = bwRank(id); L.push(''); L.push(`🏅 ดีสุด/แย่สุด ${LEVELS[CFG.level]} · ${R.M.t}`);
    if (!R.k) { R.rows.forEach(o => L.push(`▪️ ${o.name}: ${R.M.x(o.v)} (${fmtN(o.agg.trips)} เที่ยว)`)); return; }
    R.rows.forEach(o => L.push(`${o.lab === 'ดีสุด' ? '✅' : '⚠️'} ${o.lab} ${o.name}${CFG.level === 'dc' ? '' : ' (' + o.loc + ')'}: ${R.M.x(o.v)} (${fmtN(o.agg.trips)} เที่ยว)`));
  });
}
function bwSheets(out) {
  BW_KEYS.filter(k => A().picked.has('bw:' + k)).forEach(id => {
    const R = bwRank(id), rnd = v => Math.round(v * 100) / 100;
    out.push(['ดีสุด-แย่สุด ' + ({ pct: '%ค่าจ้าง', cpt: 'ต่อเที่ยว', cpb: 'ต่อบิล', cpx: 'ต่อชิ้น', avgPoints: 'จุดเฉลี่ย' }[id]), [[LEVELS[CFG.level] + ' · ' + BWM[id].t + (R.M.hi ? ' (สูง = ดี)' : ' (ต่ำ = ดี)'), '', '', '', ''], ['อันดับ', 'สถานะ', LEVELS[CFG.level], 'รายละเอียด', 'เที่ยว', BWM[id].t], ...R.all.map((o, i) => [i + 1, o.lab, o.name, o.loc, o.agg.trips, rnd(o.v)])]]);
  });
}

/* ---------- ส่วนเพิ่มในหน้าต่างแชร์ ---------- */
function dialogExtra() {
  const picked = A().picked, opt = (v, t, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(t)}</option>`;
  return `<div class="checks" style="margin-top:6px"><b style="width:100%">ดีสุด/แย่สุด (ตัวชี้วัดละ 1 ช่อง)</b>${BW_KEYS.map(k => `<label><input type="checkbox" data-sec="bw:${k}"${picked.has('bw:' + k) ? ' checked' : ''}> ${esc(BWM[k].t)}</label>`).join('')}</div>
  <div class="fields"><label class="field">จัดอันดับระดับ<select data-nxs="level">${Object.keys(LEVELS).map(k => opt(k, LEVELS[k], CFG.level)).join('')}</select></label><label class="field">แสดงดีสุด/แย่สุดอย่างละ<input type="number" min="1" max="20" step="1" value="${CFG.n}" data-nxs="n"></label></div>
  <details style="margin:6px 0"><summary><b>อินโฟกราฟิก 16:9 — เลือกกราฟ 4 ด้าน</b></summary><div class="fields">${CFG.slots.map((s, i) => `<label class="field">กราฟช่อง ${i + 1}<select data-nxs="slot${i}">${CHART_OPTS.map(([v, t]) => opt(v, t, s)).join('')}</select></label>`).join('')}</div></details>
  <div class="btns"><button class="btn" data-act="doinfo169" style="background:linear-gradient(180deg,#f0d57a,#d4af37);color:#0a2a5e">อินโฟกราฟิก 16:9 กราฟ 4 ด้าน</button><button class="btn" data-act="doinfo169h" style="background:linear-gradient(180deg,#f0d57a,#d4af37);color:#0a2a5e">อินโฟกราฟิก 16:9 หน้าหลัก</button><button class="btn" data-act="doaction169" style="background:#0a2a5e;color:#fff">Action Plan 16:9</button></div>`;
}
document.addEventListener('change', e => {
  const t = e.target, k = t.dataset && t.dataset.nxs; if (!k) return;
  if (k === 'level') CFG.level = t.value; else if (k === 'n') { const v = Math.round(+t.value); CFG.n = v >= 1 && v <= 20 ? v : DEF.n; t.value = CFG.n; } else if (/^slot\d$/.test(k)) CFG.slots[+k.slice(4)] = t.value;
  saveCfg(); const x = document.getElementById('share-text'); if (x && A()) x.value = A().summaryText();
});

/* ---------- วาดกราฟสำหรับอินโฟกราฟิก 16:9 ---------- */
const INK = '#0b1f3f', MUT = '#55657f', LINE = '#dbe3f0', GCOLS = { T: '#0b1f3f', AB: '#b8860b', CC: '#1d57b8' };
const niceStep = r => { const p = Math.pow(10, Math.floor(Math.log10(r || 1))), f = r / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
/* แกน: ค่าอยู่ช่วงแคบ (ห่างกัน <25% ของค่าสูงสุด) และไม่มีเส้น KPI → ไม่เริ่มที่ 0 แล้วเขียนกำกับ */
function axisOf(vals, ref, M) {
  const v = vals.filter(Number.isFinite); if (!v.length) return null;
  let mx = Math.max(...v, ref || 0), mn = Math.min(...v), lo = 0, note = '';
  if (!ref && v.length > 1 && mn > 0 && (mx - mn) / mx < .25) { const st0 = niceStep((mx - mn) || mx * .1); lo = Math.max(0, Math.floor((mn - (mx - mn) * 1.5) / st0) * st0); if (lo > 0) note = 'แกนเริ่มที่ ' + M.ax(lo); }
  const step = niceStep((mx * 1.08 - lo) / 4) || 1, hi = lo + step * Math.ceil((mx * 1.08 - lo) / step);
  return { lo, hi, step, note, ticks: Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step) };
}
const empty = (w, h, m) => `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-size="18" fill="${MUT}">${esc(m)}</text>`;
function legend(items, x, y) { let s = '', cx = x; items.forEach(([c, t, dash]) => { s += dash ? `<line x1="${cx}" x2="${cx + 18}" y1="${y}" y2="${y}" stroke="${c}" stroke-width="2.5" stroke-dasharray="4 3"/>` : `<rect x="${cx}" y="${y - 7}" width="14" height="14" rx="3" fill="${c}"/>`; s += `<text x="${cx + 22}" y="${y + 5}" font-size="14" fill="${INK}">${esc(t)}</text>`; cx += 34 + t.length * 8; }); return s; }
function yAxis(ax, M, m, iw, ih) { return ax.ticks.map(t => { const y = m.t + ih * (1 - (t - ax.lo) / (ax.hi - ax.lo)); return `<line x1="${m.l}" x2="${m.l + iw}" y1="${y}" y2="${y}" stroke="${LINE}"/><text x="${m.l - 8}" y="${y + 4.5}" text-anchor="end" font-size="13" fill="${MUT}">${esc(M.ax(t))}</text>`; }).join(''); }

function dcBarsChart(mid, w, h) {
  const M = BWM[mid], rows = NX.filt({ dc: 'all' }), gs = S.group === 'all' ? ['AB', 'CC'] : [S.group];
  const data = NX.DCS.map(dc => ({ dc, short: NX.shortDc(dc), g: gs.map(g => { const a = C.aggregate(rows.filter(r => r.dc === dc && r.g === g)).total; return { g, n: a.trips, v: a.trips ? M.f(a) : NaN }; }) }));
  const vals = data.flatMap(d => d.g.map(x => x.v)), ref = mid === 'pct' ? C.SETTINGS.kpi : 0, ax = axisOf(vals, ref, M);
  if (!ax) return { svg: empty(w, h, 'ไม่มีข้อมูลในตัวกรองนี้'), note: '' };
  const m = { l: 62, r: 12, t: 34, b: 58 }, iw = w - m.l - m.r, ih = h - m.t - m.b, cw = iw / data.length, bw = Math.min(78, cw * .3), Y = v => m.t + ih * (1 - (Math.max(v, ax.lo) - ax.lo) / (ax.hi - ax.lo));
  let s = legend(gs.map(g => [GCOLS[g], g === 'AB' ? 'AB แห้ง' : 'CC เย็น']).concat(ref ? [['#b8334a', 'KPI ' + fmtN(ref, 2) + '%', 1]] : []), m.l, 12) + yAxis(ax, M, m, iw, ih);
  data.forEach((d, i) => {
    const cx = m.l + cw * (i + .5), n = d.g.length, x0 = cx - (n * bw + (n - 1) * 10) / 2;
    s += `<g${S.dc !== 'all' && S.dc !== d.dc ? ' opacity=".35"' : ''}>`;
    d.g.forEach((x, j) => { const bx = x0 + j * (bw + 10); if (Number.isFinite(x.v)) { const y = Y(x.v); s += `<rect x="${bx}" y="${y}" width="${bw}" height="${m.t + ih - y}" rx="5" fill="${GCOLS[x.g]}"/><text x="${bx + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="15" font-weight="600" fill="${INK}">${esc(M.x(x.v))}</text>`; } else { const t = NX.emptyNote(d.dc, x.g), sp = t.indexOf(' '), two = t !== 'ไม่มีงาน' && sp > 0; s += two ? `<text x="${bx + bw / 2}" y="${m.t + ih - 26}" text-anchor="middle" font-size="12.5" fill="${MUT}">${esc(t.slice(0, sp))}</text><text x="${bx + bw / 2}" y="${m.t + ih - 9}" text-anchor="middle" font-size="12.5" fill="${MUT}">${esc(t.slice(sp + 1))}</text>` : `<text x="${bx + bw / 2}" y="${m.t + ih - 8}" text-anchor="middle" font-size="12.5" fill="${MUT}">ไม่มีเที่ยว</text>`; } });
    s += `<text x="${cx}" y="${m.t + ih + 22}" text-anchor="middle" font-size="15" font-weight="600" fill="${INK}">${esc(d.short)}</text><text x="${cx}" y="${m.t + ih + 42}" text-anchor="middle" font-size="12.5" fill="${MUT}">${esc(d.g.map(x => x.g + ' ' + fmtN(x.n) + ' เที่ยว').join(' · '))}</text></g>`;
  });
  if (ref) s += `<line x1="${m.l}" x2="${m.l + iw}" y1="${Y(ref)}" y2="${Y(ref)}" stroke="#b8334a" stroke-width="2.2" stroke-dasharray="6 4"/>`;
  return { svg: s, note: ax.note };
}
function trendChart(mid, w, h) {
  const M = BWM[mid], da = C.dailyAgg(NX.filt()), dates = da.dates.filter(d => { const o = C.parseThaiDate(d); return o && o.getDay() !== 0; });
  if (dates.length < 2) return { svg: empty(w, h, 'ต้องมีข้อมูลอย่างน้อย 2 วันทำการ (เลือกช่วงเป็นเดือน/สัปดาห์)'), note: '' };
  const gs = S.group === 'all' ? ['T', 'AB', 'CC'] : [S.group], key = g => g === 'T' ? 'total' : g, val = (d, g) => { const a = da.byDate[d][key(g)]; return a.trips ? M.f(a) : NaN; };
  const ref = mid === 'pct' ? C.SETTINGS.kpi : 0, ax = axisOf(dates.flatMap(d => gs.map(g => val(d, g))), ref, M);
  if (!ax) return { svg: empty(w, h, 'ไม่มีข้อมูลในตัวกรองนี้'), note: '' };
  const m = { l: 62, r: 16, t: 34, b: 40 }, iw = w - m.l - m.r, ih = h - m.t - m.b, X = i => m.l + iw * i / (dates.length - 1), Y = v => m.t + ih * (1 - (Math.max(v, ax.lo) - ax.lo) / (ax.hi - ax.lo)), every = Math.ceil(dates.length / Math.max(2, Math.floor(iw / 62)));
  let s = legend(gs.map(g => [GCOLS[g], g === 'T' ? 'รวม' : g === 'AB' ? 'AB แห้ง' : 'CC เย็น']).concat(ref ? [['#b8334a', 'KPI ' + fmtN(ref, 2) + '%', 1]] : []), m.l, 12) + yAxis(ax, M, m, iw, ih);
  dates.forEach((d, i) => { if (i % every === 0 || i === dates.length - 1) s += `<text x="${X(i)}" y="${m.t + ih + 22}" text-anchor="middle" font-size="12.5" fill="${MUT}">${esc(d.slice(0, 5))}</text>`; });
  if (ref) s += `<line x1="${m.l}" x2="${m.l + iw}" y1="${Y(ref)}" y2="${Y(ref)}" stroke="#b8334a" stroke-width="2" stroke-dasharray="6 4"/>`;
  gs.forEach(g => {
    let seg = [], paths = [];
    dates.forEach((d, i) => { const v = val(d, g); if (Number.isFinite(v)) seg.push([X(i), Y(v), v]); else { if (seg.length) paths.push(seg); seg = []; } }); if (seg.length) paths.push(seg);
    const sw = g === 'T' ? 3.2 : 2.4; paths.forEach(p => { s += `<polyline points="${p.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')}" fill="none" stroke="${GCOLS[g]}" stroke-width="${sw}" stroke-linejoin="round"/>` + p.map(q => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${g === 'T' ? 3.6 : 3}" fill="${GCOLS[g]}"/>`).join(''); });
    const last = paths.length ? paths[paths.length - 1].slice(-1)[0] : null; if (last && g === 'T') s += `<text x="${last[0] - 4}" y="${last[1] - 10}" text-anchor="end" font-size="14" font-weight="600" fill="${INK}" stroke="#fff" stroke-width="4" paint-order="stroke">${esc(M.x(last[2]))}</text>`;
  });
  return { svg: s, note: (ax.note ? ax.note + ' · ' : '') + 'ไม่แสดงวันอาทิตย์' };
}
function donutChart(w, h) {
  const R = NX.routeAgg(NX.filt()).filter(o => Number.isFinite(o.agg.pct)), K = NX.kpiData();
  if (!R.length) return { svg: empty(w, h, 'ไม่มีข้อมูลในตัวกรองนี้'), note: '' };
  const cnt = GR.map(g => R.filter(o => grade(o.agg.pct) === g).length), tot = R.length, d = Math.min(h - 20, w * .42), cx = d / 2 + 6, cy = h / 2, r0 = d / 2, r1 = d / 2 * .62;
  let s = '', a = -Math.PI / 2;
  cnt.forEach((c, i) => { if (!c) return; const f = c / tot, col = GRC[i]; if (f > .9999) { s += `<circle cx="${cx}" cy="${cy}" r="${(r0 + r1) / 2}" fill="none" stroke="${col}" stroke-width="${r0 - r1}"/>`; return; } const a2 = a + f * Math.PI * 2, l = f > .5 ? 1 : 0, P = (rr, t) => `${(cx + rr * Math.cos(t)).toFixed(2)} ${(cy + rr * Math.sin(t)).toFixed(2)}`; s += `<path d="M${P(r0, a)}A${r0} ${r0} 0 ${l} 1 ${P(r0, a2)}L${P(r1, a2)}A${r1} ${r1} 0 ${l} 0 ${P(r1, a)}Z" fill="${col}" stroke="#fff" stroke-width="2"/>`; a = a2; });
  const tg = grade(K.A.total.pct);
  s += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="${Math.round(d * .27)}" font-weight="700" fill="${gradeCol(tg)}">${tg}</text><text x="${cx}" y="${cy + d * .17}" text-anchor="middle" font-size="14" fill="${MUT}">เกรดรวม ${esc(fmtP(K.A.total.pct))}</text>`;
  const lx = d + 34; let ly = 18;
  s += `<text x="${lx}" y="${ly}" font-size="15" font-weight="600" fill="${INK}">เส้นทางทั้งหมด ${fmtN(tot)} เส้นทาง แยกตามเกรด</text>`; ly += 22;
  const gcw = 82; GR.forEach((g, i) => { const x = lx + (i % 3) * gcw * 1.55, y = ly + Math.floor(i / 3) * 24; s += `<rect x="${x}" y="${y - 12}" width="16" height="16" rx="4" fill="${GRC[i]}"/><text x="${x + 22}" y="${y + 1}" font-size="14" fill="${INK}">${g}: ${fmtN(cnt[i])}</text>`; }); ly += 62;
  const W3 = R.filter(o => o.agg.trips >= 2).sort((x, y) => y.agg.pct - x.agg.pct).slice(0, 3);
  s += `<text x="${lx}" y="${ly}" font-size="15" font-weight="600" fill="#b8334a">เส้นทางที่ % ค่าจ้างสูงสุด 3 อันดับ (≥2 เที่ยว)</text>`; ly += 12;
  const rowH = Math.min(46, (h - ly - 6) / 3), tw = w - lx;
  W3.forEach((o, i) => { const y = ly + i * rowH, g = grade(o.agg.pct), nm = (o.name.length > 34 ? o.name.slice(0, 33) + '…' : o.name); s += `<circle cx="${lx + 12}" cy="${y + rowH / 2 - 3}" r="12" fill="#b8334a"/><text x="${lx + 12}" y="${y + rowH / 2 + 2}" text-anchor="middle" font-size="13" font-weight="600" fill="#fff">${i + 1}</text><text x="${lx + 32}" y="${y + rowH / 2 - 5}" font-size="14.5" font-weight="600" fill="${INK}">${esc(nm)}</text><text x="${lx + 32}" y="${y + rowH / 2 + 13}" font-size="12.5" fill="${MUT}">${esc(NX.dcName(o.dc) + ' · ' + fmtN(o.agg.trips) + ' เที่ยว')}</text><text x="${lx + tw - 50}" y="${y + rowH / 2 + 4}" text-anchor="end" font-size="16" font-weight="600" fill="#b8334a">${esc(fmtP(o.agg.pct))}</text><rect x="${lx + tw - 40}" y="${y + rowH / 2 - 14}" width="30" height="26" rx="6" fill="${gradeCol(g)}"/><text x="${lx + tw - 25}" y="${y + rowH / 2 + 5}" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">${g}</text>`; });
  if (!W3.length) s += `<text x="${lx}" y="${ly + 24}" font-size="14" fill="${MUT}">ไม่มีเส้นทางที่มี 2 เที่ยวขึ้นไป</text>`;
  return { svg: s, note: gradeNote() };
}
/* (1) แท่งแนวนอนตามกลุ่ม: กรองตาม DC ที่เลือก แสดงจำนวนเที่ยวกำกับทุกแท่ง */
function groupHBars(mid, w, h) {
  const M = BWM[mid], rows = NX.filt(), gs = S.group === 'all' ? ['AB', 'CC'] : [S.group], byTy = NX.HAS_DI && S.work === 'all', ref = mid === 'pct' ? C.SETTINGS.kpi : 0;
  const items = [{ l: 'รวม', g: 'T', a: C.aggregate(rows).total }];
  gs.forEach(g => { const rg = rows.filter(r => r.g === g); if (byTy) ['IN', 'DI'].forEach(t => items.push({ l: (g === 'AB' ? 'AB แห้ง' : 'CC เย็น') + ' · ' + NX.WORKS[t], g, a: C.aggregate(rg.filter(r => r.ty === t)).total })); else items.push({ l: g === 'AB' ? 'AB แห้ง' : 'CC เย็น', g, a: C.aggregate(rg).total }); });
  items.forEach(it => { it.v = it.a.trips ? M.f(it.a) : NaN; });
  const ax = axisOf(items.map(i => i.v), ref, M); if (!ax) return { svg: empty(w, h, 'ไม่มีข้อมูลในตัวกรองนี้'), note: '' };
  const m = { l: byTy ? 250 : 130, r: 230, t: 34, b: 28 }, iw = w - m.l - m.r, ih = h - m.t - m.b, rh = Math.min(64, ih / items.length), bh = Math.min(30, rh * .56), X = v => m.l + iw * (Math.max(v, ax.lo) - ax.lo) / (ax.hi - ax.lo), y0 = m.t + (ih - rh * items.length) / 2;
  let s = legend(gs.map(g => [GCOLS[g], g === 'AB' ? 'AB แห้ง' : 'CC เย็น']).concat([[GCOLS.T, 'รวม']]).concat(ref ? [['#b8334a', 'KPI ' + fmtN(ref, 2) + '%', 1]] : []), m.l, 12);
  ax.ticks.forEach(t => { s += `<line x1="${X(t)}" x2="${X(t)}" y1="${m.t}" y2="${m.t + ih}" stroke="${LINE}"/><text x="${X(t)}" y="${m.t + ih + 18}" text-anchor="middle" font-size="12.5" fill="${MUT}">${esc(M.ax(t))}</text>`; });
  items.forEach((it, i) => {
    const y = y0 + i * rh + (rh - bh) / 2, cy = y + bh / 2 + 5, over = ref && it.v > ref, gr = mid === 'pct' && it.a.trips ? grade(it.v) : '';
    s += `<text x="${m.l - 12}" y="${cy}" text-anchor="end" font-size="15" font-weight="${it.g === 'T' ? 700 : 600}" fill="${it.g === 'T' ? INK : GCOLS[it.g]}">${esc(it.l)}</text>`;
    if (!it.a.trips) { const note = it.g !== 'T' && S.dc !== 'all' ? NX.emptyNote(S.dc, it.g) : 'ไม่มีเที่ยว'; s += `<text x="${m.l + 8}" y="${cy}" font-size="13.5" fill="${MUT}">${esc(note === 'ไม่มีงาน' ? 'ไม่มีเที่ยว' : note)}</text>`; return; }
    s += `<rect x="${m.l}" y="${y}" width="${Math.max(3, X(it.v) - m.l)}" height="${bh}" rx="6" fill="${GCOLS[it.g]}"${over ? ' stroke="#b8334a" stroke-width="3"' : ''}/>`;
    s += `<text x="${w - m.r + 12}" y="${cy}" font-size="17" font-weight="700" fill="${over ? '#b8334a' : INK}">${esc(M.x(it.v))}</text><text x="${w - m.r + 104}" y="${cy}" font-size="13.5" fill="${MUT}">${fmtN(it.a.trips)} เที่ยว</text>`;
    if (gr) s += `<rect x="${w - 34}" y="${cy - 18}" width="28" height="24" rx="6" fill="${gradeCol(gr)}"/><text x="${w - 20}" y="${cy}" text-anchor="middle" font-size="15" font-weight="700" fill="#fff">${gr}</text>`;
  });
  if (ref) s += `<line x1="${X(ref)}" x2="${X(ref)}" y1="${m.t}" y2="${m.t + ih}" stroke="#b8334a" stroke-width="2.2" stroke-dasharray="6 4"/>`;
  return { svg: s, note: (ax.note ? ax.note + ' · ' : '') + (S.dc === 'all' ? 'ทุก DC' : NX.shortDc(S.dc)) };
}
/* (3) แท่งคู่ราย DC ของ 2 ตัวชี้วัดที่เกี่ยวข้องกัน: แสดงครบทุก DC เพื่อเทียบ (DC ที่เลือกเด่น) */
const PAIRS = { revcost: { t: 'ราย DC · รายได้ เทียบ ค่าจ้าง', a: 'revenue', b: 'cost', ca: '#1d57b8', cb: '#b8334a', ax: v => NX.fmtK(v), sub: a => '% ค่าจ้าง ' + fmtP(a.pct) }, billbox: { t: 'ราย DC · ค่าจ้างต่อบิล เทียบ ค่าจ้างต่อชิ้น', a: 'cpb', b: 'cpx', ca: '#2f8f8f', cb: '#6e93d6', ax: v => fmtN(v, 0), sub: a => 'ค่าจ้างต่อเที่ยว ' + fmtN(a.trips ? a.cost / a.trips : 0) } };
function pairChart(id, w, h) {
  const Pq = PAIRS[id], MA = BWM[Pq.a], MB = BWM[Pq.b], rows = NX.filt({ dc: 'all' });
  const data = NX.DCS.map(dc => { const a = C.aggregate(rows.filter(r => r.dc === dc)).total; return { dc, short: NX.shortDc(dc), a, va: a.trips ? MA.f(a) : NaN, vb: a.trips ? MB.f(a) : NaN }; });
  const ax = axisOf(data.flatMap(d => [d.va, d.vb]), 0, { ax: Pq.ax }); if (!ax) return { svg: empty(w, h, 'ไม่มีข้อมูลในตัวกรองนี้'), note: '' };
  const m = { l: 62, r: 12, t: 34, b: 58 }, iw = w - m.l - m.r, ih = h - m.t - m.b, cw = iw / data.length, bw = Math.min(84, cw * .3), Y = v => m.t + ih * (1 - (Math.max(v, ax.lo) - ax.lo) / (ax.hi - ax.lo));
  let s = legend([[Pq.ca, MA.t.replace(' (บาท)', '')], [Pq.cb, MB.t.replace(' (บาท)', '')]], m.l, 12) + yAxis(ax, { ax: Pq.ax }, m, iw, ih);
  data.forEach((d, i) => {
    const cx = m.l + cw * (i + .5); s += `<g${S.dc !== 'all' && S.dc !== d.dc ? ' opacity=".35"' : ''}>`;
    [[d.va, Pq.ca, MA], [d.vb, Pq.cb, MB]].forEach(([v, c, M], j) => { const bx = cx + (j ? 5 : -5 - bw); if (!Number.isFinite(v)) return; const y = Y(v); s += `<rect x="${bx}" y="${y}" width="${bw}" height="${m.t + ih - y}" rx="5" fill="${c}"/><text x="${bx + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="14.5" font-weight="600" fill="${INK}">${esc(Pq.a === 'revenue' ? NX.fmtK(v) : M.x(v))}</text>`; });
    s += `<text x="${cx}" y="${m.t + ih + 22}" text-anchor="middle" font-size="15" font-weight="600" fill="${INK}">${esc(d.short)}</text><text x="${cx}" y="${m.t + ih + 42}" text-anchor="middle" font-size="12.5" fill="${d.a.pct > C.SETTINGS.kpi && Pq.a === 'revenue' ? '#b8334a' : MUT}">${esc(Pq.sub(d.a) + ' · ' + fmtN(d.a.trips) + ' เที่ยว')}</text></g>`;
  });
  return { svg: s, note: ax.note };
}
function chartFor(spec, w, h) {
  const [k, m] = spec.split(':');
  if (k === 'grp') return { t: 'ตามกลุ่ม AB / CC · ' + BWM[m].t, ...groupHBars(m, w, h) };
  if (k === 'pair') return { t: PAIRS[m].t, ...pairChart(m, w, h) };
  if (k === 'dc') return { t: 'ราย DC แยก AB / CC · ' + BWM[m].t, ...dcBarsChart(m, w, h) };
  if (k === 'trend') return { t: 'รายวัน · ' + BWM[m].t, ...trendChart(m, w, h) };
  return { t: 'สัดส่วนเกรดเส้นทาง (% ค่าจ้าง)', ...donutChart(w, h) };
}

/* ---------- อินโฟกราฟิก 16:9 ---------- */
function info169() {
  const W = 1920, H = 1080, head = 120, foot = 44, m = 24, g = 16, K = NX.kpiData(), St = NX.statData(K), all = S.group === 'all';
  const DCOL = d => d ? (d.color === 'good' ? '#1f8a4c' : d.color === 'bad' ? '#b8334a' : '#55657f') : '#55657f';
  const dtext = (d, prev) => d ? ((d.dir > 0 ? '▲ ' : d.dir < 0 ? '▼ ' : '') + (d.text || 'เท่าเดิม') + (prev ? ' · ก่อนหน้า ' + prev : '')) : 'ไม่มีช่วงก่อนหน้า';
  const byId = id => K.list.find(k => k.id === id), U = id => St.units.find(u => u.id === id), tp = St.trip, smx = o => fmtN(o.s) + ' / ' + fmtN(o.m);
  const pct = byId('pct'), cards = [
    { l: '% ค่าจ้างต่อรายได้', v: pct.txt, sub: `KPI ≤ ${fmtN(C.SETTINGS.kpi, 2)}%` + (all ? ` · AB ${K.A.AB.trips ? fmtP(K.A.AB.pct) : '–'} · CC ${K.A.CC.trips ? fmtP(K.A.CC.pct) : '–'}` : ''), d: dtext(pct.d, pct.prev), dc: DCOL(pct.d), grade: grade(K.A.total.pct) },
    ...['revenue', 'cost'].map(id => { const k = byId(id); return { l: k.l, v: k.txt, sub: 'บาท' + (all ? ` · AB ${K.A.AB.trips ? fmtN(NX.MET[id].f(K.A.AB)) : '–'} · CC ${K.A.CC.trips ? fmtN(NX.MET[id].f(K.A.CC)) : '–'}` : ''), d: dtext(k.d, k.prev), dc: DCOL(k.d) }; }),
    { l: tp.l, v: smx(tp.T), sub: all ? `AB ${smx(tp.AB)} · CC ${smx(tp.CC)}` : 'นับใบงานต่อทะเบียนต่อวัน', d: tp.P ? 'ก่อนหน้า ' + smx(tp.P.T) : 'ไม่มีช่วงก่อนหน้า', dc: '#55657f' },
    ...['cpt', 'cpb'].map(id => { const u = U(id); return { l: u.l, v: u.x(u.T), sub: u.u + (all ? ` · AB ${u.x(u.AB)} · CC ${u.x(u.CC)}` : ''), d: u.dT ? u.dT.t + (Number.isFinite(u.pT) ? ' · ก่อนหน้า ' + u.x(u.pT) : '') : 'ไม่มีช่วงก่อนหน้า', dc: DCOL(u.dT) }; })
  ];
  const kh = 168, kw = (W - 2 * m - 5 * g) / 6, y0 = head + g;
  let body = '';
  cards.forEach((c, i) => {
    const x = m + i * (kw + g);
    body += `<g transform="translate(${x} ${y0})"><rect width="${kw}" height="${kh}" rx="16" fill="#0a2a5e"/><rect x="0" y="${kh - 6}" width="${kw}" height="6" rx="3" fill="${i === 0 ? ({ good: '#6e93d6', warn: '#d9822b', bad: '#b8334a' }[pct.cls] || '#d4af37') : '#d4af37'}"/><text x="${kw / 2}" y="30" text-anchor="middle" font-size="17" fill="#e6d79c">${esc(c.l)}</text><text x="${kw / 2}" y="82" text-anchor="middle" font-size="${c.v.length > 9 ? 34 : 44}" font-weight="700" fill="#fff">${esc(c.v)}</text><text x="${kw / 2}" y="108" text-anchor="middle" font-size="13" fill="#cfdcf2">${esc(c.sub.length > 46 ? c.sub.slice(0, 45) + '…' : c.sub)}</text><rect x="14" y="122" width="${kw - 28}" height="30" rx="8" fill="#fff"/><text x="${kw / 2}" y="143" text-anchor="middle" font-size="14" font-weight="600" fill="${c.dc}">${esc(c.d.length > 40 ? c.d.slice(0, 39) + '…' : c.d)}</text>`
      + (c.grade ? `<rect x="${kw - 58}" y="10" width="46" height="46" rx="10" fill="${gradeCol(c.grade)}"/><text x="${kw - 35}" y="44" text-anchor="middle" font-size="30" font-weight="700" fill="#fff">${c.grade}</text><text x="${kw - 35}" y="68" text-anchor="middle" font-size="11" fill="#cfdcf2">เกรด</text>` : '') + '</g>';
  });
  const cy0 = y0 + kh + g, ch = (H - foot - 12 - cy0 - g) / 2, cw = (W - 2 * m - g) / 2, notes = [];
  CFG.slots.forEach((spec, i) => {
    const x = m + (i % 2) * (cw + g), y = cy0 + Math.floor(i / 2) * (ch + g), top = 46, pad = 16, ih = ch - top - pad - 4, c = chartFor(spec, cw - 2 * pad, ih);
    body += `<g transform="translate(${x} ${y})"><rect width="${cw}" height="${ch}" rx="16" fill="#fff" stroke="#dbe3f0"/><rect x="${cw * .15}" y="-1.2" width="${cw * .7}" height="2.4" fill="#d4af37"/><text x="${cw / 2}" y="31" text-anchor="middle" font-size="19" font-weight="600" fill="#0a2a5e">${esc(c.t)}</text>${c.note && spec !== 'donut' ? `<text x="${cw - pad}" y="31" text-anchor="end" font-size="12.5" fill="#b8334a">${esc(c.note)}</text>` : ''}<g transform="translate(${pad} ${top})">${c.svg}</g></g>`;
    if (c.note && spec === 'donut') notes.push(c.note);
  });
  const A_ = A(), ftxt = `% ค่าจ้าง = ค่าจ้าง ÷ รายได้ × 100 · KPI ≤ ${fmtN(C.SETTINGS.kpi, 2)}% · ${gradeNote()} · ค่าจ้างที่เป็น 0 ใช้ค่าประมาณการ · วันอาทิตย์คิดใน KPI แต่ไม่แสดงในกราฟรายวัน`;
  const footSvg = `<rect y="${H - foot}" width="${W}" height="${foot}" fill="#0a2a5e"/><rect y="${H - foot}" width="${W}" height="3" fill="#d4af37"/><text x="${W / 2}" y="${H - foot / 2 + 5}" text-anchor="middle" font-size="14" fill="#dfe8f7">${esc(ftxt)}</text>`;
  return A_.wrap(W, H, A_.sheetHead(W, head, 'h169') + body + footSvg);
}
/* ---------- อินโฟกราฟิก 16:9 หน้าหลัก: KPI 8 การ์ด + กรอบล่าง 4 ช่อง + แยกตามงาน (หรือรายวัน/ราย DC เมื่อมีงานเดียว) ---------- */
function info169Home() {
  const PCOL = v => A().PCOL(v);
  const W = 1920, H = 1080, head = 120, foot = 44, m = 24, g = 14, K = NX.kpiData(), St = NX.statData(K), all = S.group === 'all', byWork = NX.HAS_DI && S.work === 'all', P = NX.LIGHT, A_ = A();
  const DCOL = d => d ? (d.color === 'good' ? '#1f8a4c' : d.color === 'bad' ? '#b8334a' : '#55657f') : '#55657f';
  const kw = (W - 2 * m - 7 * g) / 8, kh = 164, y0 = head + 16; let b = '';
  K.list.forEach((k, i) => {
    const x = m + i * (kw + g), bar = k.id === 'pct' ? ({ good: '#6e93d6', warn: '#d9822b', bad: '#b8334a' }[k.cls] || '#d4af37') : '#d4af37';
    const subs = byWork && k.sub2 ? k.sub2.split(' · ') : [k.id === 'pct' ? k.sub.split(' · ')[0] : (all ? k.sub : GROUPS_[S.group])].concat(k.id === 'pct' && all ? [k.sub.split(' · ').slice(1).join(' · ')] : []);
    const dt = k.dtxt ? k.dtxt + ' · ก่อนหน้า ' + k.prev : 'ไม่มีช่วงก่อนหน้า', fs = k.txt.length > 10 ? 27 : k.txt.length > 8 ? 31 : 36;
    b += `<g transform="translate(${x} ${y0})"><rect width="${kw}" height="${kh}" rx="14" fill="#0a2a5e"/><rect y="${kh - 5}" width="${kw}" height="5" rx="2.5" fill="${bar}"/><text x="${kw / 2}" y="26" text-anchor="middle" font-size="15" fill="#e6d79c">${esc(k.l)}</text><text x="${k.grade ? kw / 2 - 18 : kw / 2}" y="66" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#fff">${esc(k.txt)}</text><text x="${kw / 2}" y="85" text-anchor="middle" font-size="12" fill="#cfdcf2">${esc(k.id === 'pct' ? '' : k.unit)}</text>`
      + subs.slice(0, 2).map((t, j) => `<text x="${kw / 2}" y="${(k.id === 'pct' ? 88 : 102) + j * 15}" text-anchor="middle" font-size="11.5" fill="#f0d57a">${esc(t)}</text>`).join('')
      + `<rect x="10" y="${kh - 38}" width="${kw - 20}" height="26" rx="7" fill="#fff"/><text x="${kw / 2}" y="${kh - 20.5}" text-anchor="middle" font-size="${dt.length > 30 ? 11 : 12.5}" font-weight="600" fill="${DCOL(k.d)}">${esc(dt)}</text>`
      + (k.grade ? `<rect x="${kw - 58}" y="36" width="42" height="38" rx="9" fill="${gradeCol(k.grade)}"/><text x="${kw - 37}" y="64" text-anchor="middle" font-size="25" font-weight="700" fill="#fff">${k.grade}</text><text x="${kw - 37}" y="86" text-anchor="middle" font-size="11" fill="#cfdcf2">เกรด</text>` : '') + '</g>';
  });
  const y1 = y0 + kh + g, sw = (W - 2 * m - 3 * g) / 4, sh = 86, tp = St.trip, smx = o => fmtN(o.s) + ' / ' + fmtN(o.m);
  const boxes = [{ l: tp.l, v: smx(tp.T), u: '', d: tp.P ? 'ก่อนหน้า ' + smx(tp.P.T) : 'ไม่มีช่วงก่อนหน้า', dc: '#55657f', ab: all ? [`AB ${smx(tp.AB)}`, `CC ${smx(tp.CC)}`] : null },
    ...St.units.map(u => ({ l: u.l, v: u.x(u.T), u: u.u, d: (u.dT ? u.dT.t + ' · ' : '') + (Number.isFinite(u.pT) ? 'ก่อนหน้า ' + u.x(u.pT) : 'ไม่มีช่วงก่อนหน้า'), dc: DCOL(u.dT), ab: all ? ['AB', 'CC'].map(gg => `${gg} ${u.x(u[gg])}${u['d' + gg] ? ' ' + u['d' + gg].t : ''}`) : null, abc: all ? ['AB', 'CC'].map(gg => DCOL(u['d' + gg])) : null }))];
  boxes.forEach((o, i) => { const x = m + i * (sw + g); b += `<g transform="translate(${x} ${y1})"><rect width="${sw}" height="${sh}" rx="12" fill="#fff" stroke="#dbe3f0"/><text x="16" y="25" font-size="14" fill="#55657f">${esc(o.l)}</text><text x="16" y="55" font-size="24" font-weight="700" fill="${INK}">${esc(o.v)}${o.u ? `<tspan font-size="13" font-weight="400" fill="#55657f"> ${esc(o.u)}</tspan>` : ''}</text><text x="16" y="76" font-size="13" fill="${o.dc}">${esc(o.d)}</text>`
    + (o.ab ? o.ab.map((t, j) => `<text x="${sw - 14}" y="${44 + j * 22}" text-anchor="end" font-size="13.5" font-weight="600" fill="${o.abc ? o.abc[j] : '#55657f'}"><tspan fill="${j ? GCOLS.CC : GCOLS.AB}">${t.slice(0, 2)}</tspan>${esc(t.slice(2))}</text>`).join('') : '') + '</g>'; });
  const y2 = y1 + sh + g + 2, pw = (W - 2 * m - g) / 2, ph = H - foot - 12 - y2;
  const panel = (x, title, tag, kpiTxt, kpiCls, gr, inner) => `<g transform="translate(${x} ${y2})"><rect width="${pw}" height="${ph}" rx="16" fill="#fff" stroke="#dbe3f0"/><rect x="18" y="16" width="5" height="40" rx="2" fill="#0a2a5e"/><text x="34" y="36" font-size="21" font-weight="700" fill="${INK}">${esc(title)}</text><text x="34" y="56" font-size="12.5" fill="#55657f">${esc(tag)}</text>${kpiTxt ? `<text x="${pw - (gr ? 96 : 20)}" y="46" text-anchor="end" font-size="30" font-weight="700" fill="${kpiCls}">${esc(kpiTxt)}</text>` : ''}${gr ? `<rect x="${pw - 86}" y="24" width="66" height="28" rx="8" fill="${gradeCol(gr)}"/><text x="${pw - 53}" y="44" text-anchor="middle" font-size="15" font-weight="700" fill="#fff">เกรด ${gr}</text>` : ''}${inner}</g>`;
  const chartIn = (svgStr, top, bottom) => { const iw = pw - 36, e = A_.embed(svgStr, 18, top, iw); return e.s; };
  const legendRow = (y) => legend((all ? [['T', 'รวม'], ['AB', 'AB แห้ง'], ['CC', 'CC เย็น']] : [[S.group, S.group === 'AB' ? 'AB แห้ง' : 'CC เย็น']]).map(([gg, t]) => [GCOLS[gg], t]).concat([['#b8334a', 'KPI ' + fmtN(C.SETTINGS.kpi, 2) + '%', 1]]), pw / 2 - 150, y);
  if (byWork) {
    ['IN', 'DI'].forEach((t, i) => {
      const rows = K.rows.filter(r => r.ty === t), AA = C.aggregate(rows), T = AA.total, gr = T.trips ? grade(T.pct) : '';
      const tag = t === 'IN' ? 'ค่าจ้างจริง ÷ รายได้' : S.calc === 'prop' ? 'สัดส่วนจริง: ค่าจ้างคำนวณ ÷ รายได้ค่าขนส่งเข้ารับ' : 'ปกติ: ค่าจ้างจริง ÷ รายได้ค่าขนส่งเข้ารับ';
      let inner = '';
      if (!T.trips) inner = `<text x="${pw / 2}" y="${ph / 2}" text-anchor="middle" font-size="18" fill="#55657f">ไม่มีงานในเงื่อนไขนี้</text>`;
      else {
        const ms = [[fmtN(T.revenue), 'รายได้'], [fmtN(T.cost), 'ค่าจ้าง'], [fmtN(T.trips), 'เที่ยว'], [fmtN(T.points), 'จุด'], [fmtN(T.avgPoints, 2), 'จุด/เที่ยว'], [fmtN(T.cost / T.trips), 'ค่าจ้าง/เที่ยว']], mw = (pw - 36 - 5 * 10) / 6;
        ms.forEach(([v, l], j) => { const x = 18 + j * (mw + 10); inner += `<rect x="${x}" y="72" width="${mw}" height="58" rx="10" fill="#f2f5fb"/><text x="${x + mw / 2}" y="98" text-anchor="middle" font-size="18" font-weight="700" fill="${INK}">${esc(v)}</text><text x="${x + mw / 2}" y="119" text-anchor="middle" font-size="12" fill="#55657f">${l}</text>`; });
        let cy = 142;
        if (all) { inner += ['AB', 'CC'].map((gg, j) => { const a = AA[gg]; return `<text x="${18 + j * (pw - 36) / 2}" y="${cy + 14}" font-size="13.5" fill="${INK}"><tspan font-weight="700" fill="${GCOLS[gg]}">${gg}</tspan>  ${a.trips ? `รายได้ ${esc(fmtN(a.revenue))} · ค่าจ้าง ${esc(fmtN(a.cost))} · ` : 'ไม่มีงานในช่วงนี้'}${a.trips ? `<tspan font-weight="700" fill="${PCOL(a.pct)}">${esc(fmtP(a.pct))}</tspan>` : ''}</text>`; }).join(''); cy += 26; }
        inner += `<text x="${pw / 2}" y="${cy + 16}" text-anchor="middle" font-size="15" font-weight="600" fill="#0a2a5e">% ค่าจ้างต่อรายได้ รายวัน (ไม่แสดงวันอาทิตย์)</text>`;
        const chH = ph - (cy + 28) - 30, svgStr = NX.trendSvg(P, pw - 36, 'pct', NX.trendRows().filter(r => r.ty === t), Math.round(chH));
        inner += svgStr.startsWith('<svg') ? chartIn(svgStr, cy + 26) : `<text x="${pw / 2}" y="${cy + 80}" text-anchor="middle" font-size="15" fill="#55657f">ไม่มีข้อมูลรายวัน</text>`;
        inner += legendRow(ph - 16);
      }
      b += panel(m + i * (pw + g), NX.WORKS[t], tag, T.trips ? fmtP(T.pct) : '', PCOL(T.pct), gr, inner);
    });
    b += `<text x="${m}" y="${y2 - 4}" font-size="0">.</text>`;
  } else {
    const tc = NX.trendChart(P, pw - 36, ph - 110), dcb = NX.dcBars(P, pw - 36, ph - 84, false);
    b += panel(m, tc.T ? tc.T.title : '% ค่าจ้างรายวัน', 'ไม่แสดงวันอาทิตย์' + (tc.T && tc.T.note ? ' · ' + tc.T.note : ''), '', '', '', tc.svg ? chartIn(tc.svg, 76) + legendRow(ph - 16) : `<text x="${pw / 2}" y="${ph / 2}" text-anchor="middle" font-size="18" fill="#55657f">ไม่มีข้อมูลรายวัน</text>`);
    b += panel(m + pw + g, '% ค่าจ้าง ราย DC แยก AB / CC', K.pr ? 'ลูกศรเทียบ' + K.pr.l.replace(/\s*\(.*\)/, '') : 'ไม่มีช่วงก่อนหน้า', fmtP(K.A.total.pct), PCOL(K.A.total.pct), K.A.total.trips ? grade(K.A.total.pct) : '', chartIn(dcb, 70));
  }
  const ftxt = `% ค่าจ้าง = ค่าจ้าง ÷ รายได้ × 100 · KPI ≤ ${fmtN(C.SETTINGS.kpi, 2)}% · ${gradeNote()}` + (byWork ? ' · เข้ารับในสายคิดแบบ' + (NX.CALCS[S.calc] || '') : '') + ' · ผลต่าง: เขียว = ดีขึ้น แดง = แย่ลง' + (K.pr ? ' · เทียบ ' + K.pr.l : '');
  const footSvg = `<rect y="${H - foot}" width="${W}" height="${foot}" fill="#0a2a5e"/><rect y="${H - foot}" width="${W}" height="3" fill="#d4af37"/><text x="${W / 2}" y="${H - foot / 2 + 5}" text-anchor="middle" font-size="${ftxt.length > 190 ? 12.5 : 14}" fill="#dfe8f7">${esc(ftxt)}</text>`;
  return A_.wrap(W, H, A_.sheetHead(W, head, 'h169h') + b + footSvg);
}
const GROUPS_ = { all: 'รวม AB+CC', AB: 'AB แห้ง', CC: 'CC เย็น' };
async function exportInfo169Home() { return await A().toPng(info169Home(), 2); }
async function exportInfo169() { const c = info169(), b = await A().toPng(c, 2); return b; }

window.NXS = { info169Home, exportInfo169Home, grade, gradeCol, gradeNote, bwRank, bwPiece, bwText, bwSheets, dialogExtra, info169, exportInfo169, cfg: () => CFG, BW_KEYS, BWM, LEVELS };
})();
