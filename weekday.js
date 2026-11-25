/* อินโฟกราฟิก 16:9 — ผลการดำเนินงานแยกวันทำการ (จ.–อา.) มิติ ผลรวม / AB / CC
   แถว: รายได้ · ค่าจ้าง · %ต้นทุน · เที่ยววิ่ง | คอลัมน์: จันทร์ … อาทิตย์ · รวม
   ใต้ตัวเลขทุกช่อง = เทียบวันเดียวกันของช่วงก่อนหน้า (ตามตัวเลือก "เทียบกับ" บนหน้าเว็บ)
   ใช้ช่วงเวลาและ DC ตามตัวกรอง (โหมดรายวันจะใช้ทั้งเดือนของวันนั้น) · รวมทุกกลุ่มและทุกประเภทงาน */
(function () {
const NX = window.NX, C = NX.C, S = NX.S, { esc, fmtN } = NX, A = () => window.NXA;
const DOW = [1, 2, 3, 4, 5, 6, 0], DN = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const INK = '#0b1f3f', MUT = '#55657f', NAV = '#0a2a5e', GOLD = '#b8860b', BLUE = '#1d57b8', GOOD = '#1f8a4c', BAD = '#b8334a', LINE = '#e3e9f3', GREY = '#8a97ad';
const GC = { ALL: INK, AB: GOLD, CC: BLUE };
const P2 = p => fmtN(p, 2) + '%';
const ALLF = { group: 'all', work: 'all', trip: 'all', route: '', plate: '' };

/* ---------- ข้อมูล ---------- */
function agg(rs) { const o = { rv: 0, co: 0, n: 0 }; rs.forEach(x => { o.rv += x.rv; o.co += x.effCost; o.n++; }); o.pct = o.rv ? o.co / o.rv * 100 : NaN; return o; }
function countDays(r) { const d0 = {}; DOW.forEach(d => { d0[d] = 0; }); if (r) for (let d = new Date(r.a); d <= r.b; d = NX.addDays(d, 1)) d0[d.getDay()]++; return d0; }
function cube(rows) { const o = {}; ['ALL', 'AB', 'CC'].forEach(g => { const rs = g === 'ALL' ? rows : rows.filter(x => x.g === g); o[g] = { tot: agg(rs), days: {} }; DOW.forEach(d => { o[g].days[d] = agg(rs.filter(x => x.dateObj.getDay() === d)); }); }); return o; }
function model() {
  const s = S.mode === 'day' && S.per !== 'all' ? { ...S, mode: 'month', per: C.monthKeyOf(C.parseThaiDate(S.per)) } : { ...S };
  const rows = NX.filt({ ...ALLF, mode: s.mode, per: s.per }).filter(x => x.dateObj);
  let r = NX.curRange(s);
  if (!r && rows.length) { const ds = rows.map(x => x.dateObj.getTime()); r = { a: new Date(Math.min(...ds)), b: new Date(Math.max(...ds)) }; }
  const pr = s.per !== 'all' ? NX.prevRange(s) : null, prows = pr ? NX.between(pr.a, pr.b, ALLF).filter(x => x.dateObj) : [];
  return { s, label: NX.rangeLabel(s), r, pr, days: countDays(r), pdays: pr ? countDays(pr) : null, cur: cube(rows), prev: prows.length ? cube(prows) : null, n: rows.length };
}

/* ---------- วาด ---------- */
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.fs || 15}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.w ? ` font-weight="${o.w}"` : ''} fill="${o.c || INK}">${esc(String(s))}</text>`;
/* ผลต่าง: k = rv|co|pct|n  (รายได้ขึ้น = ดี, ค่าจ้าง/%ต้นทุนขึ้น = แย่, เที่ยว = กลาง) */
function dif(k, c, p) {
  if (!p) return null;
  if (k === 'pct') { if (!Number.isFinite(c.pct) || !Number.isFinite(p.pct)) return { s: p.n ? '–' : 'ไม่มีก่อนหน้า', c: GREY }; const d = c.pct - p.pct; return Math.abs(d) < .005 ? { s: '0.00 จุด', c: GREY } : { s: (d > 0 ? '▲ ' : '▼ ') + fmtN(Math.abs(d), 2) + ' จุด', c: d > 0 ? BAD : GOOD }; }
  const a = c[k], b = p[k]; if (!b) return { s: a ? 'ไม่มีก่อนหน้า' : '–', c: GREY };
  const d = (a - b) / b * 100, good = k === 'rv' ? d > 0 : k === 'co' ? d < 0 : null;
  return Math.abs(d) < .05 ? { s: '0.0%', c: GREY } : { s: (d > 0 ? '▲ ' : '▼ ') + fmtN(Math.abs(d), 1) + '%', c: good === null ? GREY : good ? GOOD : BAD };
}
function grid(x, w, lw, n) { const cw = (w - lw) / n; return { L: x + 14, X: i => x + lw + i * cw, R: i => x + lw + (i + 1) * cw - 12, M: i => x + lw + i * cw + cw / 2, cw }; }
function card(x, y, w, h) { return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#fff" stroke="#dbe3f0"/><rect x="${x + w * .15}" y="${y - 1}" width="${w * .7}" height="3" fill="#d4af37"/>`; }
function pill(cx, y, d, lab) {
  if (!d) return '';
  const w = 26 + (d.s.length + lab.length) * 7.4;
  return `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="22" rx="7" fill="#fff"/><text x="${cx}" y="${y + 16}" text-anchor="middle" font-size="12.5"><tspan font-weight="700" fill="${d.c}">${esc(d.s)}</tspan><tspan fill="${MUT}"> ${esc(lab)}</tspan></text>`;
}
function kpiCard(x, y, w, h, l, v, u, sub, acc, d, lab) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${NAV}"/><rect x="${x}" y="${y + h - 5}" width="${w}" height="5" rx="2.5" fill="${acc}"/>` + T(x + w / 2, y + 25, l, { fs: 14.5, a: 'middle', c: '#e6d79c' }) +
    `<text x="${x + w / 2}" y="${y + 63}" text-anchor="middle" font-size="31" font-weight="700" fill="#fff">${esc(v)}${u ? `<tspan font-size="14" font-weight="400" fill="#cfdcf2"> ${esc(u)}</tspan>` : ''}</text>` + T(x + w / 2, y + 85, sub, { fs: 12.5, a: 'middle', c: '#cfdcf2' }) + pill(x + w / 2, y + 95, d, lab);
}
function chart(M, x0, y0, W, H) {
  const a = M.cur.AB.days, c = M.cur.CC.days, t = M.cur.ALL.days, ser = [M.cur.AB.tot.n && ['AB', a, GOLD], M.cur.CC.tot.n && ['CC', c, BLUE]].filter(Boolean);
  const vals = ser.flatMap(x => DOW.map(d => x[1][d].pct)).filter(Number.isFinite), kpi = C.SETTINGS.kpi, mx0 = Math.max(kpi * 1.2, ...vals), st = mx0 > 60 ? 20 : 10, mx = Math.ceil(mx0 / st) * st;
  const m = 44, bw = (W - m - 4) / 7, top = 22, bot = 50, ph = H - top - bot, y = v => y0 + top + ph * (1 - v / mx);
  let s = '';
  for (let v = 0; v <= mx; v += st) s += `<line x1="${x0 + m}" x2="${x0 + W}" y1="${y(v)}" y2="${y(v)}" stroke="#e3e9f3"/>` + T(x0 + m - 7, y(v) + 4, v + '%', { fs: 12, a: 'end', c: MUT });
  s += `<line x1="${x0 + m}" x2="${x0 + W}" y1="${y(kpi)}" y2="${y(kpi)}" stroke="${BAD}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  const gw = bw * .76, one = gw / Math.max(1, ser.length);
  DOW.forEach((d, i) => {
    const cx = x0 + m + i * bw + bw / 2;
    ser.forEach(([g, src, col], k) => {
      const bx = cx - gw / 2 + k * one + one * .08, w = one * .84, p = src[d].pct;
      if (!Number.isFinite(p)) { s += T(bx + w / 2, y(0) - 5, '–', { fs: 11, a: 'middle', c: GREY }); return; }
      const yy = Math.max(y(mx), y(p)); s += `<rect x="${bx}" y="${yy}" width="${w}" height="${y(0) - yy}" rx="3" fill="${col}"/>` + T(bx + w / 2, yy - 5, fmtN(p, 1), { fs: 11.5, a: 'middle', c: col, w: 700 });
    });
    s += T(cx, y0 + H - 27, DN[d], { fs: 13.5, a: 'middle', w: 600 }) + T(cx, y0 + H - 9, 'รวม ' + (Number.isFinite(t[d].pct) ? P2(t[d].pct) : '–'), { fs: 11.5, a: 'middle', c: MUT });
  });
  return s;
}
function infoWeekday() {
  const W = 1920, H = 1080, head = 120, foot = 40, m = 24, M = model(), A_ = A(), cur = M.cur, prev = M.prev, kpi = C.SETTINGS.kpi;
  const cmpShort = M.pr ? M.pr.l.replace(/\s*\(.*\)/, '') : '', cmpLab = M.pr ? 'เทียบ ' + cmpShort : '';
  let b = '';
  /* แถว KPI */
  const ky = head + 14, kh = 128, kw = (W - 2 * m - 5 * 14) / 6, all = cur.ALL.tot, ab = cur.AB.tot, cc = cur.CC.tot, pa = prev && prev.ALL.tot;
  const pf = p => Number.isFinite(p) ? P2(p) : '–';
  const ds = DOW.filter(d => Number.isFinite(cur.ALL.days[d].pct)), best = ds.length ? ds.reduce((x, y) => cur.ALL.days[y].pct < cur.ALL.days[x].pct ? y : x) : null, worst = ds.length ? ds.reduce((x, y) => cur.ALL.days[y].pct > cur.ALL.days[x].pct ? y : x) : null;
  const cards = [
    ['รายได้', fmtN(all.rv), 'บาท', `AB ${fmtN(ab.rv)} · CC ${fmtN(cc.rv)}`, '#d4af37', dif('rv', all, pa)],
    ['ค่าจ้าง', fmtN(all.co), 'บาท', `AB ${fmtN(ab.co)} · CC ${fmtN(cc.co)}`, '#d4af37', dif('co', all, pa)],
    ['% ต้นทุน', pf(all.pct), '', `AB ${pf(ab.pct)} · CC ${pf(cc.pct)} · KPI ≤ ${fmtN(kpi, 0)}%`, all.pct > kpi ? BAD : GOOD, dif('pct', all, pa)],
    ['เที่ยววิ่ง', fmtN(all.n), 'เที่ยว', `AB ${fmtN(ab.n)} · CC ${fmtN(cc.n)}`, '#d4af37', dif('n', all, pa)],
    ['วันที่ต้นทุนต่ำสุด', best === null ? '–' : DN[best], '', best === null ? '' : `${P2(cur.ALL.days[best].pct)} · ${fmtN(cur.ALL.days[best].n)} เที่ยว`, GOOD, null],
    ['วันที่ต้นทุนสูงสุด', worst === null ? '–' : DN[worst], '', worst === null ? '' : `${P2(cur.ALL.days[worst].pct)} · ${fmtN(cur.ALL.days[worst].n)} เที่ยว`, BAD, null]];
  cards.forEach((c, i) => { b += kpiCard(m + i * (kw + 14), ky, kw, kh, c[0], c[1], c[2], c[3], c[4], c[5], cmpLab); });
  /* ซ้าย: ตาราง 3 มิติ */
  const cy = ky + kh + 14, ch = H - foot - 14 - cy, lw = 1262, lx = m, rx = m + lw + 14, rw = W - m - rx;
  b += card(lx, cy, lw, ch) + T(lx + lw / 2, cy + 30, 'ผลรวม ' + M.label + ' · มิติงาน × วันทำการ', { fs: 19, a: 'middle', w: 600, c: NAV });
  const note = (prev ? `ใต้ตัวเลข = เทียบ ${M.pr.l} (วันในสัปดาห์เดียวกัน) · ▲▼ เขียว = ดีขึ้น · แดง = แย่ลง · ` : M.pr ? 'ไม่มีข้อมูลช่วงก่อนหน้า · ' : '') + `%ต้นทุน เขียว = ผ่าน KPI · แดง = เกิน KPI ${fmtN(kpi, 0)}%`;
  b += T(lx + lw / 2, cy + 52, note, { fs: 12.5, a: 'middle', c: MUT });
  const tx = lx + 16, tw = lw - 32, G = grid(tx, tw, 190, 8), th = 43, rh = 43, gap = Math.max(8, (ch - 66 - 14 - 3 * (th + 4 * rh)) / 2);
  let y = cy + 66;
  const totDays = Object.values(M.days).reduce((s, v) => s + v, 0), ptot = M.pdays ? Object.values(M.pdays).reduce((s, v) => s + v, 0) : 0;
  [['ALL', 'ผลรวม AB + CC'], ['AB', 'AB'], ['CC', 'CC']].forEach(([g, lab]) => {
    const X = cur[g], PX = prev && prev[g], col = GC[g];
    b += `<rect x="${tx}" y="${y}" width="${tw}" height="${th}" rx="6" fill="${col}"/><rect x="${G.X(7)}" y="${y}" width="${G.cw}" height="${th}" fill="#000" opacity=".18"/>` + T(G.L, y + 20, lab, { fs: 16, w: 700, c: '#fff' }) + T(G.L, y + 36, 'มิติงาน / วันทำการ', { fs: 11.5, c: '#e8ecf3' });
    DOW.forEach((d, i) => { b += T(G.M(i), y + 20, DN[d], { fs: 15.5, a: 'middle', w: 600, c: '#fff' }) + T(G.M(i), y + 36, M.days[d] + ' วัน' + (M.pdays ? ' · ก่อน ' + M.pdays[d] : ''), { fs: 11.5, a: 'middle', c: '#e8ecf3' }); });
    b += T(G.M(7), y + 20, 'รวม', { fs: 15.5, a: 'middle', w: 700, c: '#fff' }) + T(G.M(7), y + 36, totDays + ' วัน' + (M.pdays ? ' · ก่อน ' + ptot : ''), { fs: 11.5, a: 'middle', c: '#e8ecf3' });
    y += th; const y0 = y; b += `<!--slot${g}-->`;
    [['รายได้', 'rv'], ['ค่าจ้าง', 'co'], ['%ต้นทุน', 'pct'], ['เที่ยววิ่ง', 'n']].forEach(([l, k]) => {
      b += T(G.L, y + 27, l, { fs: 15.5, w: 700 });
      const cell = (i, c, p, bold) => {
        const isP = k === 'pct', v = isP ? (Number.isFinite(c.pct) ? P2(c.pct) : '–') : (c[k] ? fmtN(c[k]) : '–'), vc = v === '–' ? GREY : isP ? (c.pct > kpi ? BAD : GOOD) : INK, dd = prev ? dif(k, c, p) : null;
        return T(G.R(i), y + (dd ? 20 : 27), v, { fs: 15.5, a: 'end', c: vc, w: isP || bold ? 700 : 400 }) + (dd ? T(G.R(i), y + 36, dd.s, { fs: 11.5, a: 'end', c: dd.c, w: dd.c === GREY ? 400 : 600 }) : '');
      };
      DOW.forEach((d, i) => { b += cell(i, X.days[d], PX && PX.days[d]); });
      b += cell(7, X.tot, PX && PX.tot, true) + `<line x1="${tx}" x2="${tx + tw}" y1="${y + rh}" y2="${y + rh}" stroke="${LINE}"/>`;
      y += rh;
    });
    /* แถบเสาร์-อาทิตย์และคอลัมน์รวม วาดใต้ตัวเลข (แทนที่ตำแหน่งที่จองไว้) */
    const bg = `<rect x="${G.X(5)}" y="${y0}" width="${G.cw * 2}" height="${y - y0}" fill="#fbf7ec"/><rect x="${G.X(7)}" y="${y0}" width="${G.cw}" height="${y - y0}" fill="#e6ecf7"/><line x1="${G.X(7)}" x2="${G.X(7)}" y1="${y0}" y2="${y}" stroke="#c8d2e2" stroke-width="2"/>`;
    b = b.replace(`<!--slot${g}-->`, bg);
    y += gap;
  });
  /* ขวา: กราฟ + เฉลี่ยต่อวัน */
  b += card(rx, cy, rw, ch) + T(rx + rw / 2, cy + 30, '%ต้นทุนรายวัน · AB vs CC', { fs: 19, a: 'middle', w: 600, c: NAV });
  const lgx = rx + rw / 2 - 120;
  b += `<rect x="${lgx}" y="${cy + 42}" width="12" height="12" rx="3" fill="${GOLD}"/>` + T(lgx + 18, cy + 53, 'AB', { fs: 12.5, c: MUT }) + `<rect x="${lgx + 54}" y="${cy + 42}" width="12" height="12" rx="3" fill="${BLUE}"/>` + T(lgx + 72, cy + 53, 'CC', { fs: 12.5, c: MUT }) + `<line x1="${lgx + 110}" x2="${lgx + 134}" y1="${cy + 48}" y2="${cy + 48}" stroke="${BAD}" stroke-width="2" stroke-dasharray="5 4"/>` + T(lgx + 140, cy + 53, 'KPI ' + fmtN(kpi, 0) + '%', { fs: 12.5, c: BAD });
  const atH = 32 + 7 * 34, atY = cy + ch - 14 - atH, chH = atY - 40 - (cy + 64);
  b += chart(M, rx + 14, cy + 64, rw - 28, chH);
  b += T(rx + rw / 2, atY - 12, 'เฉลี่ยต่อวัน (ผลรวม AB + CC)', { fs: 16.5, a: 'middle', w: 600, c: NAV });
  const ax = rx + 14, aw = rw - 28, AG = grid(ax, aw, 92, prev ? 5 : 4), aheads = ['รายได้/วัน', 'ค่าจ้าง/วัน', 'เที่ยว/วัน', '%ต้นทุน', ...(prev ? ['เทียบก่อน'] : [])];
  b += `<rect x="${ax}" y="${atY}" width="${aw}" height="32" rx="6" fill="${NAV}"/>` + T(AG.L - 4, atY + 21, 'วัน', { fs: 13.5, w: 600, c: '#fff' }) + aheads.map((h, i) => T(AG.R(i) + 4, atY + 21, h, { fs: 13, a: 'end', w: 600, c: '#fff' })).join('');
  DOW.forEach((d, k) => {
    const yy = atY + 32 + k * 34, o = cur.ALL.days[d], n = M.days[d] || 1, we = d === 6 || d === 0;
    if (we) b += `<rect x="${ax}" y="${yy}" width="${aw}" height="34" fill="#fbf7ec"/>`;
    b += T(AG.L - 4, yy + 23, DN[d], { fs: 14, w: 700 });
    const v = [fmtN(o.rv / n), fmtN(o.co / n), fmtN(o.n / n, 1)];
    v.forEach((s, i) => { b += T(AG.R(i) + 4, yy + 23, s, { fs: 14, a: 'end' }); });
    b += T(AG.R(3) + 4, yy + 23, Number.isFinite(o.pct) ? P2(o.pct) : '–', { fs: 14, a: 'end', w: 700, c: !Number.isFinite(o.pct) ? GREY : o.pct > kpi ? BAD : GOOD });
    if (prev) { const dd = dif('pct', o, prev.ALL.days[d]); b += T(AG.R(4) + 4, yy + 23, dd.s, { fs: 13, a: 'end', w: 600, c: dd.c }); }
    b += `<line x1="${ax}" x2="${ax + aw}" y1="${yy + 34}" y2="${yy + 34}" stroke="${LINE}"/>`;
  });
  const ftxt = `%ต้นทุน = ค่าจ้าง ÷ รายได้ × 100 · KPI ≤ ${fmtN(kpi, 2)}% · จำนวนวัน = วันในปฏิทินของช่วง · รวมทุกกลุ่มและทุกประเภทงาน · เข้ารับในสายคิดแบบ${NX.CALCS[S.calc] || ''}` + (M.pr ? ' · ' + M.pr.l : '');
  b += `<rect y="${H - foot}" width="${W}" height="${foot}" fill="${NAV}"/><rect y="${H - foot}" width="${W}" height="3" fill="#d4af37"/>` + T(W / 2, H - foot / 2 + 5, ftxt, { fs: 13, a: 'middle', c: '#dfe8f7' });
  const keep = { group: S.group, trip: S.trip, work: S.work, mode: S.mode, per: S.per }; Object.assign(S, { group: 'all', trip: 'all', work: 'all', mode: M.s.mode, per: M.s.per });
  let hd; try { hd = A_.sheetHead(W, head, 'hwd'); } finally { Object.assign(S, keep); }
  const svg = A_.wrap(W, H, hd + b);
  svg.svg = svg.svg.replace('ต้นทุนงานเข้ารับเทียบรายได้</text>', 'ผลการดำเนินงานแยกวันทำการ · ผลรวม / AB / CC</text>');
  return svg;
}
async function exportWeekday() { return await A().toPng(infoWeekday(), 2); }
window.NXWD = { model, infoWeekday, exportWeekday };
})();
