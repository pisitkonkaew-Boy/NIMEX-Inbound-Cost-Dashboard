/* NIMEX Inbound Cost Dashboard — ชั้นหน้าจอ
   ตัวเลขทุกตัวมาจาก nim-calc.js (window.NIMCalc) ซึ่งไม่ได้แก้ไข ไฟล์นี้จัดหน้าตา ตัวกรอง และการกดไล่ลึกเท่านั้น */
'use strict';
const C = window.NIMCalc;
C.SETTINGS.kpi = +DATA.settings.kpi; C.SETTINGS.warnBuffer = +DATA.settings.warnBuffer;
const RAW = DATA.rows;
const D = C.buildDerived(RAW);

/* ---------- format ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = (v, d = 0) => Number.isFinite(+v) ? (+v).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–';
const fmtP = p => (p === null || p === undefined || !Number.isFinite(p)) ? '–' : p.toFixed(2) + '%';
const fmtK = v => Math.abs(v) >= 1e6 ? fmtN(v / 1e6, 1) + 'M' : Math.abs(v) >= 1e3 ? fmtN(v / 1e3, 0) + 'K' : fmtN(v, 0);
const MTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const mLabel = k => { if (!k || k === 'unk') return 'ไม่ทราบเดือน'; const [y, m] = k.split('-'); return MTH[+m - 1] + ' ' + (+y + 543); };
const dShort = d => d.getDate() + ' ' + MTH[d.getMonth()];
const dLabel = dt => { const d = C.parseThaiDate(dt); return d ? DOW[d.getDay()] + ' ' + dShort(d) + ' ' + String(d.getFullYear() + 543).slice(2) : dt; };
const dtOf = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + (d.getFullYear() + 543);
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const wkDate = k => { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const wLabel = k => { const a = wkDate(k), b = addDays(a, 6); return a.getMonth() === b.getMonth() ? `${a.getDate()}–${dShort(b)} ${String(b.getFullYear() + 543).slice(2)}` : `${dShort(a)} – ${dShort(b)} ${String(b.getFullYear() + 543).slice(2)}`; };
const GROUPS = { all: 'รวม AB+CC', AB: 'AB แห้ง', CC: 'CC เย็น' };
const TRIPS = { all: 'ทุกกลุ่มเข้ารับ', single: 'รับรอบเดียว', multi: 'รับมากกว่า 1 รอบ' };
const pc = p => C.pctClass(p) || 'none';
const routeKey = r => r.dc + '|' + (r.rc || r.rd || 'ไม่ระบุ');
const enc = encodeURIComponent, dec = decodeURIComponent;

/* ---------- reference lists ---------- */
const DCN = {}; D.forEach(r => { if (!DCN[r.dc]) DCN[r.dc] = r.dn; });
const DCS = C.DC_FILTER.filter(c => DCN[c]);
const dcName = c => c + ' ' + (DCN[c] || '');
const byDate = (a, b) => C.parseThaiDate(a) - C.parseThaiDate(b);
const MONTHS = [...new Set(D.map(r => r.mKey))].filter(k => k !== 'unk').sort();
const DAYS = [...new Set(D.map(r => r.dt))].filter(dt => C.parseThaiDate(dt)).sort(byDate);
const WEEKS = [...new Set(D.filter(r => r.dateObj).map(r => C.weekKeyOf(r.dateObj)))].sort((a, b) => wkDate(a) - wkDate(b));
const LAST = DAYS.length ? C.parseThaiDate(DAYS[DAYS.length - 1]) : null;
const FIRST = DAYS.length ? C.parseThaiDate(DAYS[0]) : null;

const S = { page: 'home', group: 'all', mode: 'month', per: MONTHS[MONTHS.length - 1] || 'all', dc: 'all', trip: 'all', route: '', plate: '', q: {}, sort: {}, cmp: 'pct', adim: 'route', am: 'pct', dm: 'pct', vf: 'all', showRoutes: false, open: {}, allAct: false };

/* ---------- filters (ใช้ getFiltered / rowsForPeriod ของ nim-calc) ---------- */
function filt(o = {}) {
  const s = { ...S, ...o }, F = { dc: s.dc, group: s.group, trip: s.trip };
  if (s.mode === 'month' && s.per !== 'all') F.month = s.per;
  if (s.mode === 'day' && s.per !== 'all') F.date = s.per;
  let r = C.getFiltered(D, F);
  if (s.mode === 'week' && s.per !== 'all') r = C.rowsForPeriod(r, 'week', s.per);
  if (s.route) r = r.filter(x => routeKey(x) === s.route);
  if (s.plate) r = r.filter(x => x.pl === s.plate);
  return r;
}
const between = (a, b, o = {}) => filt({ ...o, mode: 'month', per: 'all' }).filter(r => r.dateObj && r.dateObj >= a && r.dateObj <= b);
const workDays = (a, b) => { let n = 0; for (let d = a; d <= b; d = addDays(d, 1)) if (d.getDay() !== 0) n++; return n; };

/* ช่วงปัจจุบันและช่วงก่อนหน้า (เทียบจำนวนวันทำการ จ.–ส. เท่ากัน) */
function curRange(s = S) {
  if (s.per === 'all' || !LAST) return null;
  if (s.mode === 'day') { const d = C.parseThaiDate(s.per); return { a: d, b: d }; }
  if (s.mode === 'week') { const a = wkDate(s.per), e = addDays(a, 6); return { a, b: LAST < e ? LAST : e, full: LAST >= e, end: e }; }
  const [y, m] = s.per.split('-').map(Number), a = new Date(y, m - 1, 1), e = new Date(y, m, 0);
  let lastWork = e; while (lastWork.getDay() === 0) lastWork = addDays(lastWork, -1);
  return { a, b: LAST < e ? LAST : e, full: LAST >= lastWork, end: e };
}
function prevRange(s = S) {
  const c = curRange(s); if (!c) return null;
  if (s.mode === 'day') { const p = addDays(c.a, -7); return { a: p, b: p, l: 'วันเดียวกันของสัปดาห์ก่อน (' + dLabel(dtOf(p)) + ')' }; }
  if (s.mode === 'week') { const a = addDays(c.a, -7), b = addDays(c.b, -7); return { a, b, l: c.full ? 'สัปดาห์ก่อน (' + wLabel(C.weekKeyOf(a)) + ')' : `สัปดาห์ก่อนช่วงเดียวกัน (${dShort(a)}–${dShort(b)})` }; }
  const a = new Date(c.a.getFullYear(), c.a.getMonth() - 1, 1), e = new Date(c.a.getFullYear(), c.a.getMonth(), 0), pm = a.getFullYear() + '-' + String(a.getMonth() + 1).padStart(2, '0');
  if (c.full) return { a, b: e, l: mLabel(pm) + ' ทั้งเดือน' };
  const k = workDays(c.a, c.b); let b = a, n = a.getDay() !== 0 ? 1 : 0;
  while (n < k && b < e) { b = addDays(b, 1); if (b.getDay() !== 0) n++; }
  return { a, b, l: b >= e ? mLabel(pm) + ' ทั้งเดือน' : `${mLabel(pm)} ${k} วันทำการแรก (1–${b.getDate()})` };
}
function rangeLabel(s = S) {
  if (s.per === 'all') return s.mode === 'month' ? 'ทุกเดือน' : 'ทั้งหมด';
  if (s.mode === 'day') return dLabel(s.per);
  if (s.mode === 'week') return 'สัปดาห์ ' + wLabel(s.per);
  const c = curRange(s); return mLabel(s.per) + (c && !c.full ? ` (ถึง ${c.b.getDate()})` : '');
}
const scopeText = () => [S.dc === 'all' ? 'ทุก DC' : dcName(S.dc), GROUPS[S.group], TRIPS[S.trip]].join(' · ');

/* ---------- palette + charts (SVG ล้วน ใช้ทั้งหน้าจอและไฟล์ส่งออก) ---------- */
function pal() { const s = getComputedStyle(document.documentElement), g = k => s.getPropertyValue(k).trim(); return { ink: g('--ink'), muted: g('--muted'), line: g('--line'), panel: g('--panel'), s: [g('--s1'), g('--s2'), g('--s3'), g('--s4'), g('--s5')], bad: g('--bad'), warn: g('--warn'), good: g('--good'), gold: g('--gold-l') }; }
const LIGHT = { ink: '#0b1f3f', muted: '#55657f', line: '#dbe3f0', panel: '#ffffff', s: ['#1d57b8', '#b8860b', '#6e93d6', '#b8334a', '#2f8f8f'], bad: '#b8334a', warn: '#d9822b', good: '#1d57b8', gold: '#d4af37' };
const GCOL = (P, g) => g === 'AB' ? P.s[1] : g === 'CC' ? P.s[0] : P.ink;
const FONT = 'font-family="Prompt,sans-serif"';
function niceMax(v) { if (v <= 0) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))), n = v / e; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * e; }
function lineChart({ labels, series, fmt, tfmt, W = 720, H = 280, P, acts, tips, refLine, refLabel, mark = -1 }) {
  const m = { l: 56, r: 14, t: 14, b: 34 }, iw = W - m.l - m.r, ih = H - m.t - m.b, all = series.flatMap(s => s.vals).filter(Number.isFinite);
  const mx = niceMax(Math.max(...all, refLine || 0, 0) * 1.04), mn = Math.min(0, ...all), y = v => m.t + ih * (1 - (v - mn) / (mx - mn || 1)), x = i => m.l + (labels.length > 1 ? iw * i / (labels.length - 1) : iw / 2);
  tfmt = tfmt || fmt;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" ${FONT}>`;
  for (let k = 0; k <= 4; k++) { const v = mn + (mx - mn) * k / 4; s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="${P.line}"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="12" fill="${P.muted}">${esc(fmt(v))}</text>`; }
  const stepL = Math.max(1, Math.ceil(labels.length / (W < 500 ? 6 : W < 900 ? 10 : 16)));
  labels.forEach((l, i) => { if (i % stepL === 0 || i === labels.length - 1 && labels.length - 1 - i < stepL && (labels.length - 1) % stepL > stepL / 2) s += `<text x="${x(i)}" y="${H - 12}" text-anchor="middle" font-size="12" fill="${P.muted}">${esc(l)}</text>`; });
  if (mark >= 0 && mark < labels.length) s += `<line x1="${x(mark)}" x2="${x(mark)}" y1="${m.t}" y2="${m.t + ih}" stroke="${P.gold}" stroke-width="2" stroke-dasharray="3 3"/>`;
  if (refLine != null) s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(refLine)}" y2="${y(refLine)}" stroke="${P.bad}" stroke-width="1.5" stroke-dasharray="6 5"/><text x="${W - m.r}" y="${y(refLine) - 6}" text-anchor="end" font-size="12" fill="${P.bad}">${esc(refLabel || '')}</text>`;
  series.forEach((se, si) => {
    let d = '', p = false; se.vals.forEach((v, i) => { if (!Number.isFinite(v)) { p = false; return; } d += (p ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); p = true; });
    if (si === 0 && series.length === 1 && d) s += `<path d="${d}L${x(labels.length - 1)} ${y(mn)}L${x(0)} ${y(mn)}Z" fill="${se.color}" opacity=".1"/>`;
    s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se.w || 2.2}" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (labels.length <= 40) se.vals.forEach((v, i) => { if (Number.isFinite(v)) s += `<circle cx="${x(i)}" cy="${y(v)}" r="${i === mark ? 4.5 : 2.6}" fill="${se.color}" stroke="${P.panel}" stroke-width="1.2"/>`; });
  });
  const bw = iw / Math.max(1, labels.length - 1);
  labels.forEach((l, i) => { const tip = (tips ? tips[i] : l) + '\n' + series.map(se => se.name + ': ' + tfmt(se.vals[i])).join('\n'); s += `<rect x="${x(i) - bw / 2}" y="${m.t}" width="${bw}" height="${ih}" fill="transparent" data-tip="${esc(tip)}"${acts && acts[i] ? ` data-act="${esc(acts[i])}" style="cursor:pointer"` : ''}/>`; });
  return s + '</svg>';
}
function hbars({ items, W = 560, P, fmt, labelW = 150, rh = 30 }) {
  const H = items.length * rh + 8, vals = items.map(i => i.v).filter(Number.isFinite), mx = Math.max(0, ...vals), mn = Math.min(0, ...vals), ri = W - labelW - 90, sc = v => (v - mn) / ((mx - mn) || 1) * ri, z = labelW + sc(0);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" ${FONT}><line x1="${z}" x2="${z}" y1="2" y2="${H - 4}" stroke="${P.line}"/>`;
  items.forEach((it, i) => { const yy = i * rh + (rh - 18) / 2, v = Number.isFinite(it.v) ? it.v : 0, x0 = Math.min(z, labelW + sc(v)), w = Math.max(2, Math.abs(sc(v) - sc(0)));
    s += `<g${it.act ? ` data-act="${esc(it.act)}" style="cursor:pointer"` : ''} data-tip="${esc(it.tip || (it.l + ': ' + fmt(it.v)))}"><rect x="0" y="${i * rh}" width="${W}" height="${rh}" fill="transparent"/><text x="${labelW - 8}" y="${yy + 13}" text-anchor="end" font-size="13" fill="${P.ink}">${esc(it.l)}</text><rect x="${x0}" y="${yy}" width="${w}" height="18" rx="4" fill="${it.c || P.s[0]}"/><text x="${x0 + w + 6}" y="${yy + 13}" font-size="13" fill="${P.ink}">${esc(fmt(it.v))}</text></g>`; });
  return s + '</svg>';
}
function donut({ parts, center, sub, W = 240, P }) {
  const R = W / 2 - 6, r = R * .64, cx = W / 2, cy = W / 2, tot = parts.reduce((s, p) => s + Math.max(0, p.v), 0) || 1; let a = -Math.PI / 2, s = `<svg viewBox="0 0 ${W} ${W}" role="img" ${FONT}>`;
  parts.forEach(p => { const f = Math.max(0, p.v) / tot; if (!f) return;
    if (f > .9999) { s += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${p.c}" stroke-width="${R - r}" data-tip="${esc(p.tip || p.l)}"/>`; return; }
    const a2 = a + f * Math.PI * 2 - .02, l = (a2 - a) > Math.PI ? 1 : 0, pt = (rr, t) => `${(cx + rr * Math.cos(t)).toFixed(2)} ${(cy + rr * Math.sin(t)).toFixed(2)}`;
    s += `<path d="M${pt(R, a)}A${R} ${R} 0 ${l} 1 ${pt(R, a2)}L${pt(r, a2)}A${r} ${r} 0 ${l} 0 ${pt(r, a)}Z" fill="${p.c}" data-tip="${esc(p.tip || p.l)}"/>`; a = a2 + .02; });
  return s + `<text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="27" font-weight="600" fill="${P.ink}">${esc(center)}</text><text x="${cx}" y="${cy + 28}" text-anchor="middle" font-size="13" fill="${P.muted}">${esc(sub)}</text></svg>`;
}
const LEG = items => `<div class="legend">${items.map(([c, t]) => `<span><i style="background:${c}"></i>${esc(t)}</span>`).join('')}</div>`;
const groupsShown = () => S.group === 'all' ? ['T', 'AB', 'CC'] : [S.group];
const GNAME = { T: 'รวม', AB: 'AB แห้ง', CC: 'CC เย็น' };

/* ---------- metrics ---------- */
const MET = {
  pct: { t: '% ค่าจ้างต่อรายได้', f: a => a.pct, x: fmtP, ax: v => fmtN(v, 0) + '%', hi: false, isPct: true },
  revenue: { t: 'รายได้ (บาท)', f: a => a.revenue, x: v => fmtN(v), ax: fmtK, hi: true },
  cost: { t: 'ค่าจ้าง (บาท)', f: a => a.cost, x: v => fmtN(v), ax: fmtK, hi: false },
  trips: { t: 'เที่ยว', f: a => a.trips, x: v => fmtN(v), ax: v => fmtN(v), hi: false },
  points: { t: 'จุดเข้ารับ', f: a => a.points, x: v => fmtN(v), ax: v => fmtN(v), hi: true },
  bills: { t: 'บิล', f: a => a.bills, x: v => fmtN(v), ax: fmtK, hi: true },
  boxes: { t: 'กล่อง', f: a => a.boxes, x: v => fmtN(v), ax: fmtK, hi: true },
  avgPoints: { t: 'จุดเฉลี่ยต่อเที่ยว', f: a => a.avgPoints, x: v => fmtN(v, 2), ax: v => fmtN(v, 1), hi: true }
};
const excessOf = a => a.cost - a.revenue * C.SETTINGS.kpi / 100;
function kpiData() {
  const rows = filt(), A = C.aggregate(rows), pr = prevRange(), PA = pr ? C.aggregate(between(pr.a, pr.b)) : null, q = PA && PA.total.trips > 0;
  const keys = ['revenue', 'cost', 'pct', 'points', 'trips', 'bills', 'boxes', 'avgPoints'];
  const lab = { revenue: 'รายได้', cost: 'ค่าจ้าง', pct: '% ค่าจ้างต่อรายได้', points: 'จุดเข้ารับ', trips: 'เที่ยว', bills: 'บิล', boxes: 'กล่อง', avgPoints: 'จุดเฉลี่ยต่อเที่ยว' };
  const unit = { revenue: 'บาท', cost: 'บาท', pct: '', points: 'จุด', trips: 'เที่ยว', bills: 'บิล', boxes: 'กล่อง', avgPoints: 'จุด/เที่ยว' };
  const list = keys.map(k => {
    const M = MET[k], v = M.f(A.total), d = q ? C.diff(v, M.f(PA.total), M.hi, !!M.isPct) : null;
    const sub = k === 'pct' ? `KPI ≤ ${fmtN(C.SETTINGS.kpi, 2)}%` + (S.group === 'all' ? ` · AB ${fmtP(A.AB.pct)} · CC ${fmtP(A.CC.pct)}` : '') : S.group === 'all' ? `AB ${M.x(M.f(A.AB))} · CC ${M.x(M.f(A.CC))}` : GROUPS[S.group];
    const cls = k === 'pct' ? pc(v) : 'none';
    return { id: k, l: lab[k], v, txt: M.x(v), unit: unit[k], sub, cls, d, prev: q ? M.x(M.f(PA.total)) : '', dtxt: d && d.text ? (d.dir > 0 ? '▲ ' : d.dir < 0 ? '▼ ' : '') + d.text : d && d.dir === 0 ? 'เท่าเดิม' : '' };
  });
  return { rows, A, PA: q ? PA : null, pr: q ? pr : null, list };
}
function extraStats(rows, A) {
  const single = rows.filter(r => !r.isMulti).length, multi = rows.length - single, est = rows.filter(r => r.isEstimated);
  const R = C.buildRouteAgg(rows).filter(r => r.agg.pct !== null && r.agg.pct > C.SETTINGS.kpi), ex = R.reduce((s, r) => s + excessOf(r.agg), 0);
  const V = C.buildVehicleRows(rows), an = V.filter(v => v.anomaly).length;
  return { single, multi, est: est.length, estCost: est.reduce((s, r) => s + r.effCost, 0), over: R.length, excess: ex, anomaly: an, cars: V.length };
}

/* ---------- table helper: ตรึงหัว/คอลัมน์แรก, กดหัวเรียง, ค้นหา, แถวเลือกมีแถบทอง ---------- */
const DEF = {};
function sortRows(d, c, dir) { return d.slice().sort((a, b) => { const va = c.v(a), vb = c.v(b); let r; if (c.dir === 'text') r = String(va ?? '').localeCompare(String(vb ?? ''), 'th'); else { const na = Number.isFinite(va) ? va : -Infinity, nb = Number.isFinite(vb) ? vb : -Infinity; r = nb - na; } return r * dir; }); }
function table(id, cols, data, o = {}) {
  DEF[id] = o.sort || null; const so = S.sort[id] || o.sort || null; let d = data; const q = (S.q[id] || '').trim().toLowerCase();
  if (q) d = d.filter(r => cols.some(c => String(c.txt ? c.txt(r) : c.v(r)).toLowerCase().includes(q)) || (o.qx && o.qx(r).toLowerCase().includes(q)));
  if (so) { const c = cols.find(x => x.k === so.k); if (c) d = sortRows(d, c, so.d); }
  const head = cols.map(c => `<th aria-sort="${so && so.k === c.k ? (so.d > 0 ? 'descending' : 'ascending') : 'none'}"><button data-act="sort:${id}:${c.k}">${esc(c.t)}${so && so.k === c.k ? (so.d > 0 ? ' ▼' : ' ▲') : ''}</button></th>`).join('');
  const lim = o.limit && !S.open['all-' + id] ? o.limit : 0, shown = lim ? d.slice(0, lim) : d;
  const body = shown.map((r, i) => `<tr${o.sel && o.sel(r) ? ' class="sel"' : ''}${o.act ? ` data-act="${esc(o.act(r))}"` : ''}>${cols.map(c => { const v = c.v(r); const cl = [c.dir === 'text' ? 'l' : '', c.cls ? c.cls(r) : ''].filter(Boolean).join(' '); return `<td${cl ? ` class="${cl}"` : ''}${c.dir === 'text' ? ` title="${esc(c.txt ? c.txt(r) : v)}"` : ''}>${c.html ? c.html(r, i) : esc(c.txt ? c.txt(r) : v)}</td>`; }).join('')}</tr>`).join('');
  const tot = o.sum ? `<tr class="sum">${cols.map((c, i) => `<td${o.sum.cls && o.sum.cls[c.k] ? ` class="${o.sum.cls[c.k]}"` : ''}>${i ? esc(o.sum[c.k] ?? '') : esc(o.sumLabel || 'รวม')}</td>`).join('')}</tr>` : '';
  const search = o.search ? `<div class="tools"><input type="search" id="q-${id}" placeholder="${esc(o.search)}" aria-label="${esc(o.search)}" value="${esc(S.q[id] || '')}" data-q="${id}">${o.tools || ''}</div>` : (o.tools ? `<div class="tools">${o.tools}</div>` : '');
  const more = lim && d.length > lim ? `<div class="pager"><button class="btn alt" data-act="more:${id}">แสดงทั้งหมด ${fmtN(d.length)} รายการ</button></div>` : (o.limit && S.open['all-' + id] && d.length > o.limit ? `<div class="pager"><button class="btn alt" data-act="more:${id}">แสดงเฉพาะ ${o.limit} อันดับแรก</button></div>` : '');
  return `${search}<div class="tw"><table class="t" id="tb-${id}"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${cols.length}">ไม่มีข้อมูลในเงื่อนไขนี้</td></tr>`}${tot}</tbody></table></div>${more}`;
}
const gtag = g => `<span class="gtag ${g}">${g}</span>`;
const pctCol = (k = 'pct', f = x => x.agg.pct) => ({ k, t: '% ค่าจ้าง', v: f, txt: x => fmtP(f(x)), cls: x => 'p-' + pc(f(x)) });
const aggCols = (f = x => x.agg) => [
  { k: 'trips', t: 'เที่ยว', v: x => f(x).trips, txt: x => fmtN(f(x).trips) },
  { k: 'points', t: 'จุด', v: x => f(x).points, txt: x => fmtN(f(x).points) },
  { k: 'avgPoints', t: 'จุด/เที่ยว', v: x => f(x).avgPoints, txt: x => fmtN(f(x).avgPoints, 2) },
  { k: 'bills', t: 'บิล', v: x => f(x).bills, txt: x => fmtN(f(x).bills) },
  { k: 'boxes', t: 'กล่อง', v: x => f(x).boxes, txt: x => fmtN(f(x).boxes) },
  { k: 'revenue', t: 'รายได้', v: x => f(x).revenue, txt: x => fmtN(f(x).revenue) },
  { k: 'cost', t: 'ค่าจ้าง', v: x => f(x).cost, txt: x => fmtN(f(x).cost) },
  pctCol('pct', x => f(x).pct)];
const sumOf = a => ({ trips: fmtN(a.trips), points: fmtN(a.points), avgPoints: fmtN(a.avgPoints, 2), bills: fmtN(a.bills), boxes: fmtN(a.boxes), revenue: fmtN(a.revenue), cost: fmtN(a.cost), pct: fmtP(a.pct), cls: { pct: 'p-' + pc(a.pct) } });

/* ---------- groupings ---------- */
function dcAgg(rows) {
  const m = {}; rows.forEach(r => { const o = m[r.dc] || (m[r.dc] = { dc: r.dc, name: dcName(r.dc), agg: C.aggregate([]).total, rows: [] }); o.rows.push(r); });
  return Object.values(m).map(o => { const A = C.aggregate(o.rows); return { ...o, agg: A.total, AB: A.AB, CC: A.CC, cars: new Set(o.rows.map(r => r.pl)).size, routes: new Set(o.rows.map(routeKey)).size }; });
}
function routeAgg(rows) { return C.buildRouteAgg(rows).map(o => ({ ...o, key: o.dc + '|' + (o.rc || o.rd || 'ไม่ระบุ'), name: [o.rc, o.rd].filter(Boolean).join(' ') || 'ไม่ระบุ', g: Object.keys(o.groups).sort().join('/'), cars: new Set(o.rows.map(r => r.pl)).size, excess: excessOf(o.agg) })); }
function vehAgg(rows) { return C.buildVehicleRows(rows).map(v => { const top = Object.keys(v.routeMap).sort((a, b) => v.routeMap[b] - v.routeMap[a]); return { ...v, routeTop: top[0] || '-', routeN: top.length, dcs: Object.keys(v.dcSet), gs: Object.keys(v.gSet) }; }); }

/* ---------- shell ---------- */
const ICON = { home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>', dc: '<path d="M12 22s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>', car: '<path d="M2 6h12v10H2zM14 9h4l4 4v3h-8z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>', daily: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2"/>', analysis: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>' };
const PAGES = [['home', 'หน้าหลัก', 'หน้าหลัก'], ['dc', 'DC และเส้นทาง', 'เส้นทาง'], ['car', 'ทะเบียนรถ', 'รถ'], ['daily', 'รายวัน', 'รายวัน'], ['analysis', 'ผลการวิเคราะห์', 'วิเคราะห์']];
if (window.ADMIN) PAGES.push(['settings', 'ตั้งค่า', 'ตั้งค่า']);
const ic = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
const $ = s => document.querySelector(s);
function perOptions(mode) {
  if (mode === 'month') return [['all', 'ทุกเดือน'], ...MONTHS.slice().reverse().map(m => [m, mLabel(m)])];
  if (mode === 'week') return WEEKS.slice().reverse().map(w => [w, 'สัปดาห์ ' + wLabel(w)]);
  return DAYS.slice().reverse().map(d => [d, dLabel(d)]);
}
function renderShell() {
  const he = $('#hdr-export'); if (he) he.hidden = !window.ADMIN;
  const seg = (arr, val, act) => arr.map(([k, t]) => `<button data-act="${act}:${k}" aria-pressed="${val === k}">${t}</button>`).join('');
  $('#seg-group').innerHTML = seg([['all', 'รวม'], ['AB', 'AB แห้ง'], ['CC', 'CC เย็น']], S.group, 'group');
  $('#seg-mode').innerHTML = seg([['day', 'วัน'], ['week', 'สัปดาห์'], ['month', 'เดือน']], S.mode, 'mode');
  const opt = (v, t, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(t)}</option>`;
  $('#filters').innerHTML = `<select id="f-per" aria-label="ช่วงเวลา">${perOptions(S.mode).map(([v, t]) => opt(v, t, S.per)).join('')}</select><select id="f-dc" aria-label="DC">${opt('all', 'ทุก DC', S.dc)}${DCS.map(c => opt(c, dcName(c), S.dc)).join('')}</select><select id="f-trip" aria-label="กลุ่มเข้ารับ">${Object.entries(TRIPS).map(([v, t]) => opt(v, t, S.trip)).join('')}</select>`;
  const nav = i => PAGES.map(p => `<button data-act="page:${p[0]}"${S.page === p[0] ? ' aria-current="page"' : ''}>${ic(p[0])}<span>${p[i]}</span></button>`).join('');
  $('#tab').innerHTML = nav(2); $('#rail-nav').innerHTML = nav(1);
}
function chips() {
  const c = [];
  if (S.dc !== 'all') c.push(`<button class="chip" data-act="dc:all">DC ${esc(dcName(S.dc))} ✕</button>`);
  if (S.group !== 'all') c.push(`<button class="chip" data-act="group:all">${esc(GROUPS[S.group])} ✕</button>`);
  if (S.trip !== 'all') c.push(`<button class="chip" data-act="trip:all">${esc(TRIPS[S.trip])} ✕</button>`);
  if (S.route) { const r = routeAgg(D.filter(x => routeKey(x) === S.route))[0]; c.push(`<button class="chip" data-act="route:">เส้นทาง ${esc(r ? r.name : S.route)} ✕</button>`); }
  if (S.plate) c.push(`<button class="chip" data-act="plate:">ทะเบียน ${esc(S.plate)} ✕</button>`);
  return c.length ? `<div class="chips">${c.join('')}</div>` : '';
}
function header(t, sub) { return `<div class="page-h"><h1>${esc(t)}</h1>${sub ? `<p class="say" style="margin:0">${sub}</p>` : ''}</div>${chips()}`; }
const dataNote = () => LAST ? `ข้อมูล ${dShort(FIRST)} ${String(FIRST.getFullYear() + 543).slice(2)} – ${dShort(LAST)} ${String(LAST.getFullYear() + 543).slice(2)}` : 'ยังไม่มีข้อมูล';
const W = () => Math.max(300, ($('#view').clientWidth || 360) - 62);
const WW = () => { const c = $('#view').clientWidth || 360; return Math.max(300, innerWidth >= 960 ? (c - 14) * 2 / 3 - 60 : c - 62); };
const WH = () => { const c = $('#view').clientWidth || 360; return Math.max(300, innerWidth >= 960 ? (c - 14) / 2 - 60 : c - 62); };
const W3 = () => { const c = $('#view').clientWidth || 360; return Math.max(300, innerWidth >= 1180 ? (c - 28) / 3 - 60 : c - 62); };

/* ---------- KPI block ---------- */
const barOf = c => c === 'good' ? 'var(--s3)' : c === 'bad' ? 'var(--bad)' : c === 'warn' ? 'var(--warn)' : 'var(--gold-l)';
const badge = c => c === 'good' ? '✓' : c === 'warn' ? '!' : c === 'bad' ? '✕' : '';
function kpiHtml(K) {
  const X = extraStats(K.rows, K.A);
  return `<div class="kpis" id="kpi-grid">${K.list.map(k => `<button class="kpi" style="--bar:${barOf(k.cls)}" data-act="page:${k.id === 'pct' || k.id === 'cost' ? 'analysis' : k.id === 'revenue' ? 'dc' : 'daily'}" aria-label="${esc(k.l + ' ' + k.txt)}">${badge(k.cls) ? `<span class="g">${badge(k.cls)}</span>` : ''}<span class="l">${esc(k.l)}</span><span class="v">${esc(k.txt)}${k.unit && k.id !== 'pct' ? ` <small>${esc(k.unit)}</small>` : ''}</span><span class="d">${esc(k.sub)}</span><span class="s">${k.dtxt ? `<b class="${k.d.color === 'good' ? 'up' : k.d.color === 'bad' ? 'dn' : 'eq'}">${esc(k.dtxt)}</b><span class="pv"> · ก่อนหน้า ${esc(k.prev)}</span>` : '&nbsp;'}</span></button>`).join('')}</div>
  <div class="stats">
   <button class="stat" data-act="page:daily"><span>เที่ยวเดี่ยว / หลายเที่ยว</span><b>${fmtN(X.single)} / ${fmtN(X.multi)}</b><em class="mut">นับใบงานต่อทะเบียนต่อวัน</em></button>
   <button class="stat" data-act="page:analysis"><span>ส่วนเกิน KPI</span><b>${fmtN(X.excess)} <small style="font-size:13px;font-weight:400">บาท</small></b><em class="${X.over ? 'dn' : 'up'}">${fmtN(X.over)} เส้นทางเกินเกณฑ์</em></button>
   <button class="stat" data-act="page:car"><span>รถผิดปกติ</span><b>${fmtN(X.anomaly)} <small style="font-size:13px;font-weight:400">คัน</small></b><em class="mut">จาก ${fmtN(X.cars)} คัน · ค่าจ้าง/เที่ยว เกิน 1.5 เท่า</em></button>
   <button class="stat" data-act="page:analysis"><span>ค่าจ้างประมาณการ</span><b>${fmtN(X.est)} <small style="font-size:13px;font-weight:400">เที่ยว</small></b><em class="mut">${fmtN(X.estCost)} บาท · ค่าจ้างเดิมเป็น 0</em></button>
  </div>
  ${K.pr ? `<p class="note" style="margin:-4px 0 0">ลูกศรเทียบกับ ${esc(K.pr.l)} · สีน้ำเงินเขียว = ดีขึ้น สีแดง = แย่ลง</p>` : ''}`;
}

/* ---------- daily series ---------- */
function trendRows() {
  if (S.mode === 'day' && S.per !== 'all') { const d = C.parseThaiDate(S.per); return between(addDays(d, -13), d); }
  return filt();
}
function dailySeries(rows, metric, P) {
  const da = C.dailyAgg(rows), dates = da.dates.filter(dt => { const d = C.parseThaiDate(dt); return d && d.getDay() !== 0; });   // วันอาทิตย์: คิดใน KPI แต่ไม่แสดงในกราฟรายวัน
  const M = MET[metric], key = g => g === 'T' ? 'total' : g;
  const series = groupsShown().map(g => ({ name: GNAME[g], color: GCOL(P, g === 'T' ? '' : g), w: g === 'T' ? 2.6 : 2, vals: dates.map(dt => { const a = da.byDate[dt][key(g)]; return a.trips ? M.f(a) : NaN; }) }));
  return { dates, series, labels: dates.map(dt => { const d = C.parseThaiDate(dt); return d.getDate() + '/' + (d.getMonth() + 1); }), tips: dates.map(dLabel), acts: dates.map(dt => 'day:' + enc(dt)) };
}
function trendSvg(P, w, metric = 'pct', rows = trendRows(), h) {
  const Sx = dailySeries(rows, metric, P), M = MET[metric];
  if (!Sx.dates.length) return `<p class="note">ไม่มีข้อมูลรายวันในเงื่อนไขนี้</p>`;
  return lineChart({ labels: Sx.labels, series: Sx.series, fmt: M.ax, tfmt: M.x, P, W: w, H: h || Math.round(Math.max(230, Math.min(340, w * .36))), acts: Sx.acts, tips: Sx.tips, refLine: metric === 'pct' ? C.SETTINGS.kpi : null, refLabel: 'KPI ' + fmtN(C.SETTINGS.kpi, 2) + '%', mark: S.mode === 'day' ? Sx.dates.indexOf(S.per) : -1 });
}
const legendGroups = P => LEG(groupsShown().map(g => [GCOL(P, g === 'T' ? '' : g), GNAME[g]]));
function splitParts(A, P) { return ['AB', 'CC'].filter(g => S.group === 'all' || S.group === g).map(g => ({ g, l: GNAME[g], v: A[g].cost, c: GCOL(P, g), tip: `${GNAME[g]}: ค่าจ้าง ${fmtN(A[g].cost)} บาท · รายได้ ${fmtN(A[g].revenue)} บาท · ${fmtP(A[g].pct)}` })); }

/* ---------- pages ---------- */
const VIEW = {}; let goDetail = false;
const DCCOLS = () => [
  { k: 'name', t: 'DC', v: x => x.name, dir: 'text' },
  { k: 'cars', t: 'คัน', v: x => x.cars, txt: x => fmtN(x.cars) },
  { k: 'routes', t: 'เส้นทาง', v: x => x.routes, txt: x => fmtN(x.routes) },
  ...aggCols()];
function dcDetail() {
  if (S.dc === 'all' || S.page !== 'home') return '';
  const rows = filt(), R = routeAgg(rows), V = vehAgg(rows), P = pal(), A = C.aggregate(rows), w = W3();
  return `<div class="grid3" id="zone-detail">
  <section class="card"><h2>เส้นทางใน ${esc(dcName(S.dc))}</h2><p class="note">${fmtN(R.length)} เส้นทาง · AB ${fmtP(A.AB.pct)} · CC ${fmtP(A.CC.pct)} · กดเพื่อดูรายวัน</p>${table('zr', [{ k: 'name', t: 'เส้นทาง', v: x => x.name, dir: 'text' }, { k: 'g', t: 'กลุ่ม', v: x => x.g, dir: 'text', html: x => x.g.split('/').map(gtag).join(' ') }, { k: 'trips', t: 'เที่ยว', v: x => x.agg.trips, txt: x => fmtN(x.agg.trips) }, pctCol()], R, { act: x => 'route:' + enc(x.key), sort: { k: 'pct', d: 1 }, limit: 12 })}</section>
  <section class="card"><h2>ทะเบียนรถใน DC นี้</h2><p class="note">${fmtN(V.length)} คัน · ผิดปกติ ${fmtN(V.filter(v => v.anomaly).length)} คัน · กดเพื่อดูรายวัน</p>${table('zv', [{ k: 'pl', t: 'ทะเบียน', v: x => x.pl, dir: 'text', html: x => esc(x.pl) + (x.anomaly ? ' <span class="tag">ผิดปกติ</span>' : '') }, { k: 'g', t: 'กลุ่ม', v: x => x.g, dir: 'text', html: x => gtag(x.g) }, { k: 'cpt', t: 'ค่าจ้าง/เที่ยว', v: x => x.costPerTrip, txt: x => fmtN(x.costPerTrip) }, pctCol()], V, { act: x => 'car:' + enc(x.pl), sort: { k: 'pct', d: 1 }, limit: 12 })}</section>
  <section class="card"><h2>% ค่าจ้างรายวันของ DC</h2><p class="note">ไม่แสดงวันอาทิตย์ · กดจุดเพื่อดูรายวัน</p><div class="chart">${trendSvg(P, w, 'pct', trendRows(), Math.round(Math.max(220, w * .62)))}</div>${legendGroups(P)}</section></div>`;
}
const CMP = ['pct', 'revenue', 'cost', 'trips', 'points', 'avgPoints'];
function cmpRows(metric = S.cmp) {
  const M = MET[metric], base = filt({ mode: 'month', per: 'all', dc: 'all' }), ms = MONTHS;
  const last = ms[ms.length - 1], cr = last ? curRange({ mode: 'month', per: last }) : null, pr = last ? prevRange({ mode: 'month', per: last }) : null;
  const mk = (name, key, rs) => {
    const vals = ms.map(m => { const x = rs.filter(r => r.mKey === m); return x.length ? M.f(C.aggregate(x).total) : NaN; });
    let chg = NaN; if (ms.length > 1 && pr) { const a = rs.filter(r => r.dateObj >= cr.a && r.dateObj <= cr.b), b = rs.filter(r => r.dateObj >= pr.a && r.dateObj <= pr.b); if (a.length && b.length) chg = M.f(C.aggregate(a).total) - M.f(C.aggregate(b).total); }
    return { key, name, cars: new Set(rs.map(r => r.pl)).size, vals, chg };
  };
  const rows = DCS.map(c => mk(dcName(c), c, base.filter(r => r.dc === c))).filter(r => r.cars);
  return { M, ms, rows, total: mk('รวมทุก DC', 'all', base), pr };
}
function cmpTable() {
  const { M, ms, rows, total, pr } = cmpRows(), n = ms.length, good = d => M.hi ? d >= 0 : d <= 0;
  const cols = [{ k: 'name', t: 'DC', v: o => o.name, dir: 'text' }, { k: 'cars', t: 'คัน', v: o => o.cars, txt: o => fmtN(o.cars) }, ...ms.map((m, i) => ({ k: 'm' + i, t: mLabel(m), v: o => o.vals[i], txt: o => M.x(o.vals[i]), cls: o => metric_cls(S.cmp, o.vals[i]) }))];
  if (n > 1) cols.push({ k: 'chg', t: 'เปลี่ยน', v: o => o.chg, html: o => Number.isFinite(o.chg) ? `<span class="${o.chg === 0 ? 'mut' : good(o.chg) ? 'good' : 'badt'}">${o.chg > 0 ? '▲' : o.chg < 0 ? '▼' : ''} ${esc(M.isPct ? fmtN(Math.abs(o.chg), 2) + ' จุด' : M.x(Math.abs(o.chg)))}</span>` : '–' });
  const sum = { cars: fmtN(total.cars) }; ms.forEach((m, i) => sum['m' + i] = M.x(total.vals[i])); if (n > 1) sum.chg = Number.isFinite(total.chg) ? (total.chg > 0 ? '▲ ' : total.chg < 0 ? '▼ ' : '') + (M.isPct ? fmtN(Math.abs(total.chg), 2) + ' จุด' : M.x(Math.abs(total.chg))) : '–';
  return { html: table('cmp', cols, rows, { act: o => 'dc:' + o.key, sel: o => o.key === S.dc, sort: { k: 'name', d: 1 }, sum, sumLabel: 'รวมทุก DC' }), pr, n };
}
const metric_cls = (m, v) => m === 'pct' ? 'p-' + pc(v) : '';
VIEW.home = () => {
  const K = kpiData(), P = pal(), w = WW(), parts = splitParts(K.A, P), T = K.A.total, ct = cmpTable();
  const dcs = dcAgg(filt({ dc: 'all' }));
  return `<p class="eyebrow">NIMEX Inbound Cost Dashboard</p>${header('สรุปผล ' + rangeLabel(), esc(scopeText()) + ' · ' + esc(dataNote()))}${kpiHtml(K)}
  <div class="grid2 w"><section class="card"><h2>% ค่าจ้างต่อรายได้ รายวัน</h2><p class="note">เส้นประแดง = KPI ${fmtN(C.SETTINGS.kpi, 2)}% · ไม่แสดงวันอาทิตย์ · กดจุดเพื่อดูรายวัน</p><div class="chart">${trendSvg(P, w)}</div>${legendGroups(P)}</section>
  <section class="card"><h2>สัดส่วนค่าจ้าง AB / CC</h2><p class="note">ค่าจ้างรวม ${fmtN(T.cost)} บาท</p><div class="chart" style="max-width:230px;margin:auto">${donut({ parts, center: fmtP(T.pct), sub: 'ค่าจ้าง ÷ รายได้', P })}</div>
  <div class="tw" style="margin-top:8px"><table class="t"><thead><tr><th>กลุ่ม</th><th>รายได้</th><th>ค่าจ้าง</th><th>%</th></tr></thead><tbody>${parts.map(p => `<tr data-act="group:${p.g}"><td><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${p.c};margin-right:6px"></i>${esc(p.l)}</td><td>${fmtN(K.A[p.g].revenue)}</td><td>${fmtN(K.A[p.g].cost)}</td><td class="p-${pc(K.A[p.g].pct)}">${fmtP(K.A[p.g].pct)}</td></tr>`).join('')}</tbody></table></div></section></div>
  <section class="card"><h2>ผลราย DC</h2><p class="note">กด DC เพื่อกรองทั้งหน้าและเปิดเส้นทาง ทะเบียนรถ และรายวัน กดซ้ำเพื่อปิด</p>${table('dc', DCCOLS(), dcs, { act: x => 'dc:' + (x.dc === S.dc ? 'all' : x.dc), sel: x => x.dc === S.dc, sort: { k: 'name', d: 1 }, sum: sumOf(C.aggregate(filt({ dc: 'all' })).total) })}</section>
  ${dcDetail()}
  <section class="card"><h2>เทียบรายเดือนตาม DC</h2><div class="tools" style="justify-content:center"><select id="f-cmp" aria-label="ตัวชี้วัดที่เทียบ">${CMP.map(k => `<option value="${k}"${k === S.cmp ? ' selected' : ''}>${esc(MET[k].t)}</option>`).join('')}</select></div><p class="note">${esc(GROUPS[S.group])}${ct.n > 1 && ct.pr ? ' · เปลี่ยน = เดือนล่าสุดเทียบ ' + esc(ct.pr.l) : ''}</p>${ct.html}</section>`;
};

/* DC → กลุ่ม → เส้นทาง */
VIEW.dc = () => {
  const rows = filt(), q = (S.q.dd || '').trim().toLowerCase(), so = S.sort.dd || { k: 'pct', d: 1 };
  const match = r => !q || (r.rc + ' ' + r.rd + ' ' + r.pl + ' ' + r.dc + ' ' + r.dn).toLowerCase().includes(q);
  const rs = rows.filter(match), cols = aggCols(), D0 = dcAgg(rs), R = routeAgg(rs);
  const sorter = arr => { const c = cols.find(x => x.k === so.k); return c ? sortRows(arr, c, so.d) : arr; };
  const cells = a => cols.map(c => `<td${c.cls ? ` class="${c.cls({ agg: a })}"` : ''}>${esc(c.txt({ agg: a }))}</td>`).join('');
  const head = [{ k: 'name', t: 'DC / กลุ่ม / เส้นทาง' }, { k: 'cars', t: 'คัน' }, ...cols].map(c => `<th aria-sort="${so.k === c.k ? (so.d > 0 ? 'descending' : 'ascending') : 'none'}"><button data-act="sort:dd:${c.k}">${esc(c.t)}${so.k === c.k ? (so.d > 0 ? ' ▼' : ' ▲') : ''}</button></th>`).join('');
  const sortDc = so.k === 'name' ? D0.sort((a, b) => a.name.localeCompare(b.name, 'th') * so.d) : so.k === 'cars' ? D0.sort((a, b) => (b.cars - a.cars) * so.d) : sorter(D0);
  let body = '';
  sortDc.forEach(d => {
    const open = S.open['dc' + d.dc] || !!q;
    body += `<tr class="lv0${open ? ' open' : ''}${d.dc === S.dc ? ' sel' : ''}" data-act="ddopen:${d.dc}"><td><span class="chev">▸</span>${esc(d.name)}</td><td>${fmtN(d.cars)}</td>${cells(d.agg)}</tr>`;
    if (!open) return;
    ['AB', 'CC'].forEach(g => {
      const gr = rs.filter(r => r.dc === d.dc && r.g === g); if (!gr.length) return;
      const ga = C.aggregate(gr).total;
      body += `<tr class="lv1"><td>${gtag(g)} ${g === 'AB' ? 'แห้ง' : 'เย็น'}</td><td>${fmtN(new Set(gr.map(r => r.pl)).size)}</td>${cells(ga)}</tr>`;
      if (!S.showRoutes && !q) return;
      let sub = R.filter(r => r.dc === d.dc && r.groups[g]);
      sub = so.k === 'name' ? sub.sort((a, b) => a.name.localeCompare(b.name, 'th') * so.d) : so.k === 'cars' ? sub.sort((a, b) => (b.cars - a.cars) * so.d) : sorter(sub);
      sub.forEach(r => { const a = C.aggregate(r.rows.filter(x => x.g === g)).total; body += `<tr class="lv2" data-act="route:${enc(r.key)}"><td title="${esc(r.name)}">${esc(r.name)}</td><td>${fmtN(new Set(r.rows.filter(x => x.g === g).map(x => x.pl)).size)}</td>${cells(a)}</tr>`; });
    });
  });
  const T = C.aggregate(rs).total;
  body += `<tr class="sum"><td>รวม</td><td>${fmtN(new Set(rs.map(r => r.pl)).size)}</td>${cols.map(c => `<td${c.cls ? ` class="${c.cls({ agg: T })}"` : ''}>${esc(c.txt({ agg: T }))}</td>`).join('')}</tr>`;
  return `${header('DC และเส้นทาง', esc(rangeLabel()) + ' · ' + esc(scopeText()))}
  <section class="card"><h2>ผลราย DC → กลุ่ม → เส้นทาง</h2><p class="note">กด DC เพื่อขยาย · กดเส้นทางเพื่อดูรายวันและทะเบียนรถ · ${fmtN(R.length)} เส้นทาง</p>
  <div class="tools"><input type="search" id="q-dd" data-q="dd" placeholder="ค้นหาเส้นทาง ทะเบียน หรือ DC" aria-label="ค้นหาเส้นทาง ทะเบียน หรือ DC" value="${esc(S.q.dd || '')}"><div class="seg2" role="group" aria-label="ระดับรายละเอียด"><button data-act="routes:0" aria-pressed="${!S.showRoutes}">DC + กลุ่ม</button><button data-act="routes:1" aria-pressed="${S.showRoutes}">ถึงเส้นทาง</button></div><button class="btn alt" data-act="ddall" style="min-height:38px;padding:6px 12px">ขยาย/ยุบทั้งหมด</button></div>
  <div class="tw"><table class="t" id="tb-dd"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></section>
  <section class="card"><h2>เส้นทางทั้งหมด</h2><p class="note">ทุกเส้นทางแสดง DC และกลุ่ม · เรียงจาก % ค่าจ้างสูงไปต่ำ</p>${table('rt', [{ k: 'name', t: 'เส้นทาง', v: x => x.name, dir: 'text' }, { k: 'dc', t: 'DC', v: x => dcName(x.dc), dir: 'text' }, { k: 'g', t: 'กลุ่ม', v: x => x.g, dir: 'text', html: x => x.g.split('/').map(gtag).join(' ') }, { k: 'cars', t: 'คัน', v: x => x.cars, txt: x => fmtN(x.cars) }, ...aggCols(), { k: 'excess', t: 'ส่วนเกิน KPI', v: x => x.excess, txt: x => x.excess > 0 ? fmtN(x.excess) : '–' }], R, { act: x => 'route:' + enc(x.key), sort: { k: 'pct', d: 1 }, search: 'ค้นหาเส้นทาง', limit: 50 })}</section>`;
};

/* ทะเบียนรถ */
VIEW.car = () => {
  const rows = filt(); let V = vehAgg(rows); const an = V.filter(v => v.anomaly).length;
  if (S.vf === 'anomaly') V = V.filter(v => v.anomaly);
  const cols = [{ k: 'pl', t: 'ทะเบียน', v: x => x.pl, dir: 'text' }, { k: 'dc', t: 'DC', v: x => dcName(x.dc), dir: 'text', txt: x => dcName(x.dc) + (x.dcs.length > 1 ? ` +${x.dcs.length - 1}` : '') }, { k: 'g', t: 'กลุ่ม', v: x => x.g, dir: 'text', html: x => x.gs.map(gtag).join(' ') }, { k: 'route', t: 'เส้นทางหลัก', v: x => x.routeTop, dir: 'text', txt: x => x.routeTop + (x.routeN > 1 ? ` (+${x.routeN - 1})` : '') },
    ...aggCols().filter(c => ['trips', 'points', 'revenue', 'cost', 'pct'].includes(c.k)),
    { k: 'cpt', t: 'ค่าจ้าง/เที่ยว', v: x => x.costPerTrip, txt: x => fmtN(x.costPerTrip), cls: x => x.anomaly ? 'p-bad' : '' }, { k: 'med', t: 'มัธยฐาน DC+กลุ่ม', v: x => x.medianCostPerTrip, txt: x => fmtN(x.medianCostPerTrip) }, { k: 'st', t: 'สถานะ', v: x => x.anomaly ? 1 : 0, html: x => x.anomaly ? '<span class="tag">ผิดปกติ</span>' : '<span class="tag mut">ปกติ</span>' }];
  return `${header('ทะเบียนรถ', esc(rangeLabel()) + ' · ' + esc(scopeText()))}
  <section class="card"><h2>ผลรายทะเบียน</h2><p class="note">ผิดปกติ = ตั้งแต่ 2 เที่ยว และค่าจ้างต่อเที่ยวเกิน 1.5 เท่าของมัธยฐาน DC+กลุ่ม · ${fmtN(an)} คันผิดปกติ · กดแถวเพื่อดูรายวัน</p>
  ${table('veh', cols, V, { act: x => 'car:' + enc(x.pl), sel: x => x.pl === S.plate, sort: { k: 'pct', d: 1 }, search: 'ค้นหาทะเบียนหรือเส้นทาง', qx: x => Object.keys(x.routeMap).join(' '), tools: `<div class="seg2" role="group" aria-label="สถานะ"><button data-act="vf:all" aria-pressed="${S.vf === 'all'}">ทั้งหมด</button><button data-act="vf:anomaly" aria-pressed="${S.vf === 'anomaly'}">ผิดปกติ ${fmtN(an)}</button></div>`, limit: 60 })}</section>`;
};

/* รายวัน */
const DMET = ['pct', 'trips', 'points', 'bills', 'boxes', 'revenue', 'cost', 'avgPoints'];
VIEW.daily = () => {
  const P = pal(), rows = trendRows(), w = W(), da = C.dailyAgg(filt()), M = MET[S.dm];
  const list = da.dates.map(dt => { const d = C.parseThaiDate(dt), o = da.byDate[dt]; return { dt, d, sun: d && d.getDay() === 0, agg: o.total, AB: o.AB, CC: o.CC, single: 0, multi: 0 }; });
  const fr = filt(); list.forEach(x => { fr.forEach(r => { if (r.dt === x.dt) r.isMulti ? x.multi++ : x.single++; }); });
  const cols = [{ k: 'dt', t: 'วันที่', v: x => +x.d, txt: x => dLabel(x.dt) }, { k: 'sm', t: 'เดี่ยว/หลาย', v: x => x.multi, txt: x => fmtN(x.single) + ' / ' + fmtN(x.multi) }, ...aggCols()];
  return `${header('รายวัน', esc(rangeLabel()) + ' · ' + esc(scopeText()))}
  <section class="card"><h2>${esc(M.t)} รายวัน</h2><div class="tools" style="justify-content:center"><div class="seg2" role="group" aria-label="ตัวชี้วัด" style="flex-wrap:wrap">${DMET.map(k => `<button data-act="dm:${k}" aria-pressed="${S.dm === k}">${esc(MET[k].t.replace(' (บาท)', ''))}</button>`).join('')}</div></div><p class="note">ไม่แสดงวันอาทิตย์ในกราฟ (ยังคิดรวมใน KPI) · ${S.mode === 'day' ? '14 วันล่าสุดถึงวันที่เลือก · ' : ''}กดจุดเพื่อดูรายการ</p><div class="chart">${trendSvg(P, w, S.dm, rows)}</div>${legendGroups(P)}</section>
  <section class="card"><h2>ตารางรายวัน</h2><p class="note">กดแถวเพื่อดูใบงานของวันนั้น · วันอาทิตย์แสดงเป็นสีจาง</p>${table('day', cols, list, { act: x => 'day:' + enc(x.dt), sort: { k: 'dt', d: 1 }, sum: { sm: fmtN(list.reduce((s, x) => s + x.single, 0)) + ' / ' + fmtN(list.reduce((s, x) => s + x.multi, 0)), ...sumOf(C.aggregate(fr).total) } }).replace(/<tr data-act="day:([^"]+)">/g, (m, v) => { const d = C.parseThaiDate(dec(v)); return d && d.getDay() === 0 ? `<tr class="sun" data-act="day:${v}">` : m; })}</section>`;
};

/* ผลการวิเคราะห์ */
function execBullets(rows, A) {
  const t = A.total, k = C.SETTINGS.kpi, b = [];
  if (t.pct === null) b.push(['warn', 'ยังไม่มีรายได้เพียงพอสำหรับคำนวณ % ค่าจ้างในช่วงที่เลือก']);
  else if (t.pct > k) b.push(['bad', `% ค่าจ้างรวม ${fmtP(t.pct)} สูงกว่าเกณฑ์ ${fmtN(k, 2)}% อยู่ ${fmtN(t.pct - k, 2)} จุด`]);
  else b.push(['good', `% ค่าจ้างรวม ${fmtP(t.pct)} อยู่ในเกณฑ์ ${fmtN(k, 2)}%`]);
  const R = routeAgg(rows), over = R.filter(r => r.agg.pct !== null && r.agg.pct > k), byDc = {};
  over.forEach(r => { byDc[r.dc] = (byDc[r.dc] || 0) + 1; });
  Object.keys(byDc).sort().forEach(dc => b.push(['bad', `${dcName(dc)} มีเส้นทางเกิน KPI ${fmtN(byDc[dc])} เส้นทาง`]));
  if (over.length) b.push(['warn', `ส่วนเกิน KPI รวมประมาณ ${fmtN(over.reduce((s, r) => s + r.excess, 0))} บาท`]);
  const da = C.dailyAgg(rows); let peak = null; da.dates.forEach(dt => { const p = da.byDate[dt].total.pct; if (p !== null && (!peak || p > peak.p)) peak = { dt, p }; });
  if (peak) b.push([peak.p > k ? 'bad' : 'good', `วันที่ ${dLabel(peak.dt)} มี % ค่าจ้างสูงสุดในช่วงที่เลือก (${fmtP(peak.p)})`]);
  if (A.AB.pct !== null && A.CC.pct !== null) { if (A.AB.pct > A.CC.pct + .5) b.push(['warn', `AB แห้ง มี % ค่าจ้างสูงกว่า CC เย็น: ${fmtP(A.AB.pct)} เทียบ ${fmtP(A.CC.pct)}`]); else if (A.CC.pct > A.AB.pct + .5) b.push(['warn', `CC เย็น มี % ค่าจ้างสูงกว่า AB แห้ง: ${fmtP(A.CC.pct)} เทียบ ${fmtP(A.AB.pct)}`]); }
  return b;
}
const ADIM = [['dc', 'DC'], ['route', 'เส้นทาง'], ['car', 'ทะเบียน'], ['trip', 'ใบงาน']];
const AMET = {
  pct: { t: '% ค่าจ้างต่อรายได้', f: x => x.agg.pct, x: fmtP, bad: 'high' },
  excess: { t: 'ส่วนเกิน KPI (บาท)', f: x => excessOf(x.agg), x: v => fmtN(v), bad: 'high' },
  cpt: { t: 'ค่าจ้างต่อเที่ยว (บาท)', f: x => x.agg.trips ? x.agg.cost / x.agg.trips : NaN, x: v => fmtN(v), bad: 'high' },
  avgPoints: { t: 'จุดเฉลี่ยต่อเที่ยว', f: x => x.agg.avgPoints, x: v => fmtN(v, 2), bad: 'low' },
  rpt: { t: 'รายได้ต่อเที่ยว (บาท)', f: x => x.agg.trips ? x.agg.revenue / x.agg.trips : NaN, x: v => fmtN(v), bad: 'low' }
};
function analysisRows(dim = S.adim, met = S.am, rows = filt()) {
  const m = AMET[met] || AMET.pct; let R;
  if (dim === 'dc') R = dcAgg(rows).map(o => ({ ...o, loc: fmtN(o.cars) + ' คัน', act: 'dc:' + o.dc }));
  else if (dim === 'route') R = routeAgg(rows).filter(o => o.agg.trips >= 2).map(o => ({ ...o, loc: dcName(o.dc) + ' · ' + o.g, act: 'route:' + enc(o.key) }));
  else if (dim === 'car') R = vehAgg(rows).filter(o => o.agg.trips >= 2).map(o => ({ ...o, name: o.pl, loc: dcName(o.dc) + ' · ' + o.g, act: 'car:' + enc(o.pl) }));
  else R = rows.filter(r => r.pct !== null).map(r => ({ name: r.i, loc: dcName(r.dc) + ' · ' + r.g + ' · ' + r.pl + ' · ' + dLabel(r.dt), agg: { trips: 1, revenue: r.rv, cost: r.effCost, pct: r.pct, avgPoints: r.pt, points: r.pt }, est: r.isEstimated, act: 'day:' + enc(r.dt) }));
  R = R.filter(o => Number.isFinite(m.f(o))).sort((a, b) => m.bad === 'high' ? m.f(b) - m.f(a) : m.f(a) - m.f(b));
  return { m, R };
}
function groupTable(A, keys, names) {
  const rowsDef = [['เที่ยว', 'trips', v => fmtN(v)], ['จุดเข้ารับ', 'points', v => fmtN(v)], ['จุดเฉลี่ย/เที่ยว', 'avgPoints', v => fmtN(v, 2)], ['บิล', 'bills', v => fmtN(v)], ['กล่อง', 'boxes', v => fmtN(v)], ['รายได้', 'revenue', v => fmtN(v)], ['ค่าจ้าง', 'cost', v => fmtN(v)], ['% ค่าจ้าง', 'pct', fmtP]];
  return `<div class="tw"><table class="t cmpt"><thead><tr><th>ตัวชี้วัด</th>${names.map(n => `<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>${rowsDef.map(([l, k, f]) => `<tr><td>${l}</td>${keys.map(g => `<td${k === 'pct' ? ` class="p-${pc(A[g].pct)}"` : ''}>${f(A[g][k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
VIEW.analysis = () => {
  const rows = filt(), A = C.aggregate(rows), B = execBullets(rows, A), { m, R } = analysisRows(), k = C.SETTINGS.kpi;
  const ig = filt({ trip: 'all' }), AS = C.aggregate(ig.filter(r => !r.isMulti)).total, AM = C.aggregate(ig.filter(r => r.isMulti)).total;
  const over = routeAgg(rows).filter(r => r.agg.pct !== null && r.agg.pct > k).sort((a, b) => b.excess - a.excess), nAct = S.allAct ? over.length : Math.min(12, over.length);
  const noRev = rows.filter(r => r.pct === null).length;
  const cols = [{ k: 'rank', t: '#', v: x => R.indexOf(x), html: x => { const i = R.indexOf(x); return `<span class="rk${i < 3 ? ' top' : ''}">${i + 1}</span>`; } }, { k: 'name', t: ADIM.find(a => a[0] === S.adim)[1], v: x => x.name, dir: 'text', html: x => esc(x.name) + (x.est ? '<span class="est" title="ค่าจ้างประมาณการ">≈</span>' : '') }, { k: 'loc', t: S.adim === 'dc' ? 'คัน' : 'DC / รายละเอียด', v: x => x.loc, dir: 'text' }, { k: 'trips', t: 'เที่ยว', v: x => x.agg.trips, txt: x => fmtN(x.agg.trips) }, { k: 'revenue', t: 'รายได้', v: x => x.agg.revenue, txt: x => fmtN(x.agg.revenue) }, { k: 'cost', t: 'ค่าจ้าง', v: x => x.agg.cost, txt: x => fmtN(x.agg.cost) }, { k: 'm', t: m.t, v: x => m.f(x), txt: x => m.x(m.f(x)), cls: x => S.am === 'pct' ? 'p-' + pc(m.f(x)) : '' }];
  return `${header('ผลการวิเคราะห์', esc(rangeLabel()) + ' · ' + esc(scopeText()))}
  <section class="card"><h2>สรุปอัตโนมัติ</h2><p class="note">ตามตัวกรองที่เลือกอยู่</p><ul class="ins">${B.map(([c, t]) => `<li class="${c}"><i>${c === 'bad' ? '⚠️' : c === 'warn' ? 'ℹ️' : '✅'}</i><span>${esc(t)}</span></li>`).join('')}</ul></section>
  <section class="card"><h2>จัดอันดับจากแย่ไปดี</h2><div class="tools" style="justify-content:center"><div class="seg2" role="group" aria-label="มิติ">${ADIM.map(([v, t]) => `<button data-act="adim:${v}" aria-pressed="${S.adim === v}">${t}</button>`).join('')}</div><select id="f-am" aria-label="ตัวชี้วัด" style="flex:0 1 240px">${Object.entries(AMET).map(([v, o]) => `<option value="${v}"${v === S.am ? ' selected' : ''}>${esc(o.t)}</option>`).join('')}</select></div>
  <p class="note">${S.adim === 'route' || S.adim === 'car' ? 'นับเฉพาะรายการที่มีตั้งแต่ 2 เที่ยว · ' : ''}${S.adim === 'trip' && noRev ? `ไม่รวมใบงานที่ไม่มีรายได้ ${fmtN(noRev)} รายการ · ` : ''}${fmtN(R.length)} รายการ · กดเพื่อดูรายละเอียด</p>${table('an', cols, R, { act: x => x.act, limit: 20 })}</section>
  <div class="grid2"><section class="card"><h2>AB แห้ง เทียบ CC เย็น</h2><p class="note">${esc(TRIPS[S.trip])}</p>${groupTable(A, ['total', 'AB', 'CC'], ['รวม', 'AB แห้ง', 'CC เย็น'])}</section>
  <section class="card"><h2>รับรอบเดียว เทียบ มากกว่า 1 รอบ</h2><p class="note">นับใบงานต่อทะเบียนต่อวัน · ไม่ขึ้นกับตัวกรองกลุ่มเข้ารับ</p>${groupTable({ s: AS, m: AM }, ['s', 'm'], ['รับรอบเดียว', 'มากกว่า 1 รอบ'])}</section></div>
  <section class="card"><h2>เส้นทางที่ต้องแก้ไข ${fmtN(over.length)} เส้นทาง</h2><p class="note">% ค่าจ้างเกิน ${fmtN(k, 2)}% เรียงจากส่วนเกินมากไปน้อย · กดเพื่อดูใบงาน</p>
  ${over.length ? `<div class="acts-list">${over.slice(0, nAct).map(r => `<button class="act" data-act="route:${enc(r.key)}"><span class="h"><span>${r.g.split('/').map(gtag).join(' ')} ${esc(r.name)}</span><span class="badt">${fmtP(r.agg.pct)}</span></span><span class="m">${esc(dcName(r.dc))} · ${fmtN(r.agg.trips)} เที่ยว · ${fmtN(r.cars)} คัน · รายได้ ${fmtN(r.agg.revenue)} · ค่าจ้าง ${fmtN(r.agg.cost)}</span><span class="x">💡 เกินเกณฑ์ ${fmtN(r.agg.pct - k, 2)} จุด ส่วนเกินประมาณ ${fmtN(r.excess)} บาท ควรตรวจอัตราค่าจ้างเทียบรายได้ของเส้นทาง หรือปรับรอบ/จำนวนจุดเข้ารับ</span></button>`).join('')}</div>${over.length > 12 ? `<div class="pager"><button class="btn alt" data-act="allact">${S.allAct ? 'แสดงเฉพาะ 12 อันดับแรก' : 'แสดงทั้งหมด ' + fmtN(over.length) + ' เส้นทาง'}</button></div>` : ''}` : '<p class="note">ไม่มีเส้นทางที่เกินเกณฑ์ในเงื่อนไขนี้</p>'}</section>`;
};

/* ---------- detail sheets ---------- */
function tripTable(rows, showDate = true) {
  return `<div class="tw" style="max-height:52vh"><table class="t"><thead><tr><th>${showDate ? 'วันที่' : 'ใบรายการ'}</th>${showDate ? '<th>ใบรายการ</th>' : ''}<th>DC</th><th>เส้นทาง</th><th>ทะเบียน</th><th>กลุ่ม</th><th>จุด</th><th>บิล</th><th>กล่อง</th><th>รายได้</th><th>ค่าจ้าง</th><th>%</th></tr></thead><tbody>${rows.map(r => `<tr>${showDate ? `<td>${esc(dLabel(r.dt))}</td><td class="l">${esc(r.i)}</td>` : `<td>${esc(r.i)}</td>`}<td class="l">${esc(r.dc)}</td><td class="l">${esc([r.rc, r.rd].filter(Boolean).join(' '))}</td><td class="l">${esc(r.pl)}${r.isMulti ? ' <span class="tag mut">หลายเที่ยว</span>' : ''}</td><td class="l">${gtag(r.g)}</td><td>${fmtN(r.pt)}</td><td>${fmtN(r.bl)}</td><td>${fmtN(r.bx)}</td><td>${fmtN(r.rv)}</td><td>${fmtN(r.effCost)}${r.isEstimated ? '<span class="est" title="ค่าจ้างประมาณการ (ค่าจ้างเดิมเป็น 0)">≈</span>' : ''}</td><td class="p-${pc(r.pct)}">${fmtP(r.pct)}</td></tr>`).join('')}</tbody></table></div><p class="note" style="text-align:left">≈ = ค่าจ้างประมาณการ จากค่าเฉลี่ยทะเบียนเดียวกัน หรือ DC+กลุ่ม เมื่อค่าจ้างเดิมเป็น 0</p>`;
}
const miniStats = a => `<div class="mini"><div class="stat"><span>เที่ยว</span><b>${fmtN(a.trips)}</b></div><div class="stat"><span>รายได้</span><b>${fmtN(a.revenue)}</b></div><div class="stat"><span>ค่าจ้าง</span><b>${fmtN(a.cost)}</b></div><div class="stat"><span>% ค่าจ้าง</span><b class="${pc(a.pct) === 'bad' ? 'badt' : ''}">${fmtP(a.pct)}</b></div></div>`;
function daySheet(dt) {
  const rows = filt({ mode: 'day', per: dt }).sort((a, b) => b.pct - a.pct || a.dc.localeCompare(b.dc)), A = C.aggregate(rows).total;
  openSheet(`<h2>${esc(dLabel(dt))}</h2><p class="say" style="margin:0">${esc(scopeText())} · ${fmtN(rows.length)} ใบงาน${C.parseThaiDate(dt).getDay() === 0 ? ' · วันอาทิตย์ (ไม่แสดงในกราฟ แต่คิดใน KPI)' : ''}</p>${miniStats(A)}${tripTable(rows, false)}
  <div class="btnrow"><button class="btn" data-act="goday:${enc(dt)}">กรองทั้งหน้าเป็นวันนี้</button></div>`);
}
function routeSheet(key) {
  const rows = filt({ route: key, mode: S.mode, per: S.per }).sort((a, b) => byDate(a.dt, b.dt)), R = routeAgg(rows)[0], P = LIGHT_OR_PAL();
  if (!R) { openSheet('<h2>ไม่มีข้อมูล</h2>'); return; }
  const V = vehAgg(rows);
  openSheet(`<h2>${esc(R.name)}</h2><p class="say" style="margin:0">${esc(dcName(R.dc))} · ${R.g.split('/').map(gtag).join(' ')} · ${fmtN(R.cars)} คัน · ${esc(rangeLabel())}</p>${miniStats(R.agg)}
  <div class="chart">${trendSvg(P, 600, 'pct', rows, 200)}</div>
  <p class="note" style="text-align:left">ทะเบียนในเส้นทางนี้: ${V.map(v => `<button class="chip" data-act="car:${enc(v.pl)}">${esc(v.pl)} · ${fmtN(v.agg.trips)} เที่ยว · ${fmtP(v.agg.pct)}</button>`).join(' ')}</p>
  ${tripTable(rows)}<div class="btnrow"><button class="btn" data-act="route:${enc(key)}:f">กรองทั้งหน้าตามเส้นทางนี้</button><button class="btn alt" data-act="dcgo:${R.dc}">ดู ${esc(dcName(R.dc))}</button></div>`);
}
function carSheet(pl) {
  const rows = filt({ plate: pl }).sort((a, b) => byDate(a.dt, b.dt)), V = vehAgg(filt()).find(v => v.pl === pl), A = C.aggregate(rows).total, P = LIGHT_OR_PAL();
  if (!rows.length) { openSheet('<h2>ไม่มีข้อมูล</h2>'); return; }
  const dcs = [...new Set(rows.map(r => r.dc))];
  openSheet(`<h2>${esc(pl)}</h2><p class="say" style="margin:0">${dcs.map(dcName).map(esc).join(', ')} · ${[...new Set(rows.map(r => r.g))].map(gtag).join(' ')} · ${esc(rangeLabel())}</p>${miniStats(A)}
  ${V ? `<p class="note" style="text-align:left">ค่าจ้างต่อเที่ยว ${fmtN(V.costPerTrip)} บาท · มัธยฐาน DC+กลุ่ม ${fmtN(V.medianCostPerTrip)} บาท · ${V.anomaly ? '<span class="badt">ผิดปกติ (เกิน 1.5 เท่า)</span>' : 'ปกติ'}</p>` : ''}
  <div class="chart">${trendSvg(P, 600, 'pct', rows, 200)}</div>${tripTable(rows)}
  <div class="btnrow"><button class="btn" data-act="plate:${enc(pl)}">กรองทั้งหน้าเฉพาะรถคันนี้</button><button class="btn alt" data-act="dcgo:${dcs[0]}">ดู ${esc(dcName(dcs[0]))}</button></div>`);
}
const LIGHT_OR_PAL = () => pal();
function openSheet(html) { const o = $('#ov'); o.hidden = false; $('#sheet').innerHTML = `<button class="close" data-act="close" aria-label="ปิด">✕</button>${html}`; $('#sheet').scrollTop = 0; }
function closeSheet() { $('#ov').hidden = true; }

/* ---------- render + events ---------- */
function render(keepScroll) {
  if (!VIEW[S.page] || (!window.ADMIN && S.page === 'settings')) S.page = 'home';
  renderShell(); const y = window.scrollY; $('#view').innerHTML = VIEW[S.page](); window.scrollTo(0, keepScroll ? y : 0);
}
function setMode(m) {
  const c = curRange(); let anchor = c ? c.b : LAST;
  if (!anchor) { S.mode = m; S.per = m === 'month' ? 'all' : (perOptions(m)[0] || [''])[0]; return; }
  S.mode = m;
  if (m === 'month') S.per = anchor.getFullYear() + '-' + String(anchor.getMonth() + 1).padStart(2, '0');
  else if (m === 'week') S.per = C.weekKeyOf(anchor);
  else { let d = anchor; while (!DAYS.includes(dtOf(d)) && d > FIRST) d = addDays(d, -1); S.per = dtOf(d); }
  if (!perOptions(m).some(o => o[0] === S.per)) S.per = (perOptions(m)[m === 'month' ? 1 : 0] || ['all'])[0];
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const [a, ...rest] = t.dataset.act.split(':'), v = rest[0] !== undefined ? dec(rest[0]) : '';
  if (a === 'close') { closeSheet(); return; }
  if (a === 'export') { if (window.openExport) window.openExport(); return; }
  if (a === 'theme') { const r = document.documentElement, c = r.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'), n = c === 'dark' ? 'light' : 'dark'; r.setAttribute('data-theme', n); try { localStorage.setItem('nim-theme', n); } catch (x) {} render(true); return; }
  if (a.startsWith('do')) { if (window.doExport) window.doExport(a); return; }
  if (a === 'day') { daySheet(v); return; }
  if (a === 'car') { carSheet(v); return; }
  if (a === 'route' && rest[1] !== 'f' && v) { routeSheet(v); return; }
  if (a === 'page') { S.page = v; closeSheet(); render(); return; }
  if (a === 'sort') { const id = rest[0], k = rest[1], s = S.sort[id] || DEF[id] || (id === 'dd' ? { k: 'pct', d: 1 } : null); S.sort[id] = { k, d: s && s.k === k ? -s.d : 1 }; render(true); return; }
  if (a === 'more') { S.open['all-' + v] = !S.open['all-' + v]; render(true); return; }
  if (a === 'ddopen') { S.open['dc' + v] = !S.open['dc' + v]; render(true); return; }
  if (a === 'ddall') { const any = DCS.some(c => S.open['dc' + c]); DCS.forEach(c => S.open['dc' + c] = !any); render(true); return; }
  if (a === 'routes') { S.showRoutes = v === '1'; if (S.showRoutes) DCS.forEach(c => S.open['dc' + c] = true); render(true); return; }
  if (a === 'allact') { S.allAct = !S.allAct; render(true); return; }
  if (a === 'group') S.group = v;
  else if (a === 'mode') setMode(v);
  else if (a === 'trip') S.trip = v;
  else if (a === 'vf') S.vf = v;
  else if (a === 'dm') S.dm = v;
  else if (a === 'adim') S.adim = v;
  else if (a === 'plate') { S.plate = v; closeSheet(); }
  else if (a === 'route') { S.route = v; closeSheet(); }
  else if (a === 'goday') { S.mode = 'day'; S.per = v; closeSheet(); }
  else if (a === 'dc') { S.dc = v || 'all'; if (S.dc !== 'all' && S.page === 'home') goDetail = true; }
  else if (a === 'dcgo') { S.dc = v; S.page = 'home'; goDetail = true; closeSheet(); }
  else return;
  render(true);
  if (goDetail) { goDetail = false; const d = $('#zone-detail'); if (d) d.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
});
document.addEventListener('change', e => {
  const t = e.target, id = t.id;
  if (id === 'f-per') S.per = t.value; else if (id === 'f-dc') { S.dc = t.value; if (S.dc !== 'all' && S.page === 'home') goDetail = true; } else if (id === 'f-trip') S.trip = t.value; else if (id === 'f-cmp') S.cmp = t.value; else if (id === 'f-am') S.am = t.value; else return;
  render(true);
  if (goDetail) { goDetail = false; const d = $('#zone-detail'); if (d) d.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
});
document.addEventListener('input', e => {
  const q = e.target.dataset && e.target.dataset.q; if (!q) return;
  S.q[q] = e.target.value; const p = e.target.selectionStart; render(true);
  const n = document.getElementById('q-' + q); if (n) { n.focus(); try { n.setSelectionRange(p, p); } catch (x) {} }
});
const tip = () => $('#tip');
function showTip(t, x, y) { const el = tip(); el.textContent = t; el.hidden = false; const r = el.getBoundingClientRect(); el.style.left = Math.max(6, Math.min(innerWidth - r.width - 6, x - r.width / 2)) + 'px'; el.style.top = Math.max(6, y - r.height - 12) + 'px'; }
document.addEventListener('pointermove', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t.dataset.tip, e.clientX, e.clientY); else tip().hidden = true; });
document.addEventListener('pointerdown', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t.dataset.tip, e.clientX, e.clientY); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
document.getElementById('ov').addEventListener('click', e => { if (e.target.id === 'ov') closeSheet(); });
let rt, lastW = innerWidth; addEventListener('resize', () => { if (innerWidth === lastW) return; lastW = innerWidth; clearTimeout(rt); rt = setTimeout(() => render(true), 200); });
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => render(true));

window.NX = { S, D, RAW, C, filt, between, kpiData, extraStats, prevRange, curRange, rangeLabel, scopeText, dcAgg, routeAgg, vehAgg, cmpRows, analysisRows, execBullets, dailySeries, splitParts, lineChart, hbars, donut, trendSvg, LIGHT, MET, AMET, ADIM, GROUPS, TRIPS, GNAME, GCOL, esc, fmtN, fmtP, fmtK, mLabel, dLabel, dcName, DCS, MONTHS, DAYS, LAST, render, openSheet, closeSheet, VIEW, table, header, pc, excessOf, dataNote };
render();
