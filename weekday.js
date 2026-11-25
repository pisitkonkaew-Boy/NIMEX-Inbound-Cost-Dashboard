/* อินโฟกราฟิก 16:9 — สรุปแยกวันทำการ + แผนเสาร์รับอย่างเดียว · อาทิตย์ยกไปจันทร์
   เรื่องที่ 1: รายได้ / ค่าจ้าง / %ต้นทุน / เที่ยว แยกวัน จ.–อา. (AB · CC · รวม)
   เรื่องที่ 2: เดิม–ใหม่–ผลต่าง ของเสาร์และอาทิตย์
     รถเพิ่ม = ปัดขึ้น(จุดรับในสายเฉลี่ยต่อเสาร์ ÷ จุดต่อเที่ยวของรถเข้ารับอย่างเดียววันเสาร์ DC+กลุ่มเดียวกัน)
     ต้นทุนรถเพิ่ม = รถเพิ่ม × ค่าจ้างเฉลี่ยต่อเที่ยวของรถเข้ารับอย่างเดียววันเสาร์ DC+กลุ่มเดียวกัน
     อาทิตย์ = งดรับ ยกไปจันทร์ (รถวันจันทร์เดิมรับได้หมด) */
(function () {
const NX = window.NX, C = NX.C, S = NX.S, { esc, fmtN } = NX, A = () => window.NXA;
const DOW = [1, 2, 3, 4, 5, 6, 0], DN = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const MTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const dd = d => d.getDate() + ' ' + MTH[d.getMonth()];
const INK = '#0b1f3f', MUT = '#55657f', NAV = '#0a2a5e', GOLD = '#b8860b', BLUE = '#1d57b8', GOOD = '#1f8a4c', BAD = '#b8334a', LINE = '#e3e9f3';
const GC = { AB: GOLD, CC: BLUE, ALL: INK };
const pctOf = (co, rv) => rv ? co / rv * 100 : 0;
const P2 = p => fmtN(p, 2) + '%';

/* ---------- ข้อมูล ---------- */
function range() {
  const s = S.mode === 'day' && S.per !== 'all' ? { ...S, mode: 'month', per: C.monthKeyOf(C.parseThaiDate(S.per)) } : S;
  let r = NX.curRange(s);
  const rows = NX.filt({ mode: s.mode, per: s.per, group: 'all', work: 'all', trip: 'all', route: '', plate: '' }).filter(x => x.dateObj);
  if (!r) { const ds = rows.map(x => x.dateObj.getTime()); r = ds.length ? { a: new Date(Math.min(...ds)), b: new Date(Math.max(...ds)) } : null; }
  const label = s === S ? NX.rangeLabel() : NX.rangeLabel(s);
  return { r, rows, label, s };
}
function agg(rs) { const o = { rv: 0, co: 0, n: 0, pt: 0 }; rs.forEach(x => { o.rv += x.rv; o.co += x.effCost; o.n++; o.pt += x.pt; }); o.pct = pctOf(o.co, o.rv); return o; }
function model() {
  const { r, rows, label, s: per } = range(), days = {};
  DOW.forEach(d => { days[d] = 0; });
  if (r) for (let d = new Date(r.a); d <= r.b; d = NX.addDays(d, 1)) days[d.getDay()]++;
  const nSat = days[6], nSun = days[0], gs = g => g === 'ALL' ? rows : rows.filter(x => x.g === g);
  const t1 = {}; ['ALL', 'AB', 'CC'].forEach(g => { const rs = gs(g); t1[g] = { days: {}, tot: agg(rs) }; DOW.forEach(d => { t1[g].days[d] = agg(rs.filter(x => x.dateObj.getDay() === d)); }); });
  /* เครื่องคำนวณรถเพิ่ม ราย DC × กลุ่ม */
  const dcs = [...new Set(rows.map(x => x.dc))].sort((a, b) => NX.DCS.indexOf(a) - NX.DCS.indexOf(b)), eng = [];
  dcs.forEach(dc => ['AB', 'CC'].forEach(g => {
    const sat = rows.filter(x => x.dc === dc && x.g === g && x.dateObj.getDay() === 6), IN = agg(sat.filter(x => x.ty !== 'DI')), DI = agg(sat.filter(x => x.ty === 'DI'));
    if (!IN.n && !DI.n) return;
    const ppt = IN.n ? IN.pt / IN.n : 0, cpt = IN.n ? IN.co / IN.n : 0, diPt = nSat ? DI.pt / nSat : 0, diCo = nSat ? DI.co / nSat : 0, trucks = diPt && ppt ? Math.ceil(diPt / ppt - 1e-9) : 0;
    eng.push({ dc, g, ppt, cpt, diPt, diCo, trucks, xc: trucks * cpt, noIn: !IN.n && DI.n > 0 });
  }));
  const plan = {}; ['ALL', 'AB', 'CC'].forEach(g => {
    const rs = gs(g), sat = rs.filter(x => x.dateObj.getDay() === 6), sun = rs.filter(x => x.dateObj.getDay() === 0), E = eng.filter(e => g === 'ALL' || e.g === g);
    const tr = E.reduce((s, e) => s + e.trucks, 0), xc = E.reduce((s, e) => s + e.xc, 0), diCo = E.reduce((s, e) => s + e.diCo, 0);
    const os = agg(sat), ou = agg(sun), satIN = agg(sat.filter(x => x.ty !== 'DI'));
    const O = { sat: { rv: nSat ? os.rv / nSat : 0, co: nSat ? os.co / nSat : 0, n: nSat ? os.n / nSat : 0, tr: 0 }, sun: { rv: nSun ? ou.rv / nSun : 0, co: nSun ? ou.co / nSun : 0, n: nSun ? ou.n / nSun : 0, tr: 0 } };
    const N = { sat: { rv: O.sat.rv, co: (nSat ? satIN.co / nSat : 0) + xc, n: (nSat ? satIN.n / nSat : 0) + tr, tr }, sun: { rv: 0, co: 0, n: 0, tr: 0 } };
    [O.sat, O.sun, N.sat, N.sun].forEach(o => { o.pct = pctOf(o.co, o.rv); });
    const D = { sat: {}, sun: {} }; ['rv', 'co', 'n', 'pct', 'tr'].forEach(k => { D.sat[k] = N.sat[k] - O.sat[k]; D.sun[k] = N.sun[k] - O.sun[k]; });
    plan[g] = { O, N, D, tr, xc, diCo, net: D.sat.co + D.sun.co, empty: !sat.length && !sun.length };
  });
  const nextSat = r ? NX.addDays(r.b, ((6 - r.b.getDay() + 7) % 7) || 7) : null;
  return { label, r, days, nSat, nSun, t1, eng, plan, nextSat, nextSun: nextSat ? NX.addDays(nextSat, 1) : null, rows: rows.length, mode: per.mode, per: per.per };
}

/* ---------- วาด ---------- */
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.fs || 15}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.w ? ` font-weight="${o.w}"` : ''} fill="${o.c || INK}">${esc(String(s))}</text>`;
function sgn(v, d, goodNeg, unit = '') {
  if (Math.abs(v) < Math.pow(10, -d) / 2) return { s: '–', c: '#9aa6ba', w: 400 };
  return { s: (v > 0 ? '+' : '−') + fmtN(Math.abs(v), d) + unit, c: (v < 0) === goodNeg ? GOOD : BAD, w: 700 };
}
function chart(M, x0, y0, W, H) {
  const a = M.t1.AB.days, c = M.t1.CC.days, t = M.t1.ALL.days, hasCC = M.t1.CC.tot.n > 0, hasAB = M.t1.AB.tot.n > 0;
  const vals = DOW.flatMap(d => [a[d].pct, c[d].pct]).filter(Number.isFinite), mx0 = Math.max(10, ...vals), st = mx0 > 60 ? 20 : 10, mx = Math.ceil(mx0 / st) * st;
  const m = 52, bw = (W - m - 8) / 7, top = 22, bot = 56, ph = H - top - bot, y = v => y0 + top + ph * (1 - v / mx);
  let s = '';
  for (let v = 0; v <= mx; v += st) s += `<line x1="${x0 + m}" x2="${x0 + W - 4}" y1="${y(v)}" y2="${y(v)}" stroke="#dbe3f0"/>` + T(x0 + m - 8, y(v) + 5, v + '%', { fs: 13, a: 'end', c: MUT });
  const kpi = C.SETTINGS.kpi; if (kpi <= mx) s += `<line x1="${x0 + m}" x2="${x0 + W - 4}" y1="${y(kpi)}" y2="${y(kpi)}" stroke="${BAD}" stroke-width="1.6" stroke-dasharray="6 5"/>`;
  const ser = [hasAB && ['AB', a, GOLD], hasCC && ['CC', c, BLUE]].filter(Boolean), gw = bw * .72, one = gw / Math.max(1, ser.length);
  DOW.forEach((d, i) => {
    const cx = x0 + m + i * bw + bw / 2;
    ser.forEach(([g, src, col], k) => {
      const bx = cx - gw / 2 + k * one + one * .08, w = one * .84, p = src[d].pct;
      if (!src[d].n) { s += T(bx + w / 2, y(0) - 6, 'ไม่มี', { fs: 11, a: 'middle', c: '#8a97ad' }); return; }
      if (!src[d].rv) { s += T(bx + w / 2, y(0) - 6, 'ไม่มีรายได้', { fs: 10, a: 'middle', c: '#8a97ad' }); return; }
      const yy = Math.max(y(mx), y(p)); s += `<rect x="${bx}" y="${yy}" width="${w}" height="${y(0) - yy}" rx="4" fill="${col}"/>` + T(bx + w / 2, yy - 6, fmtN(p, 1), { fs: 13, a: 'middle', c: col, w: 700 });
    });
    s += T(cx, y0 + H - 30, DN[d], { fs: 16, a: 'middle', w: 600 }) + T(cx, y0 + H - 9, 'รวม ' + (t[d].rv ? P2(t[d].pct) : '–'), { fs: 13, a: 'middle', c: MUT });
  });
  return s;
}
/* ตารางเส้นตาราง: คอลัมน์แรกชิดซ้าย ที่เหลือกว้างเท่ากัน ชิดขวา */
function grid(x, w, lw, n) { const cw = (w - lw) / n; return { L: x + 12, R: i => x + lw + (i + 1) * cw - 12, X: i => x + lw + i * cw, M: i => x + lw + i * cw + cw / 2, cw }; }
function card(x, y, w, h) { return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#fff" stroke="#dbe3f0"/><rect x="${x + w * .15}" y="${y - 1}" width="${w * .7}" height="3" fill="#d4af37"/>`; }
function kpiCard(x, y, w, h, l, v, u, sub, acc, vc) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${NAV}"/><rect x="${x}" y="${y + h - 5}" width="${w}" height="5" rx="2.5" fill="${acc}"/>` + T(x + w / 2, y + 26, l, { fs: 14.5, a: 'middle', c: '#e6d79c' }) +
    `<text x="${x + w / 2}" y="${y + 66}" text-anchor="middle" font-size="32" font-weight="700" fill="${vc || '#fff'}">${esc(v)}<tspan font-size="14" font-weight="400" fill="#cfdcf2"> ${esc(u)}</tspan></text>` + sub.map((t, i) => T(x + w / 2, y + 90 + i * 18, t, { fs: 12.5, a: 'middle', c: '#cfdcf2' })).join('');
}
function infoWeekday() {
  const W = 1920, H = 1080, head = 120, foot = 40, m = 24, M = model(), A_ = A(), Pl = M.plan.ALL, T1 = M.t1;
  let b = '';
  /* แถว KPI */
  const ky = head + 14, kh = 126, kw = (W - 2 * m - 5 * 14) / 6, ab = T1.AB.tot, cc = T1.CC.tot, all = T1.ALL.tot, ou = Pl.O.sun;
  const cards = [
    ['รายได้', fmtN(all.rv / 1e6, 2), 'ล้านบาท', [`AB ${fmtN(ab.rv / 1e6, 2)} ล. · CC ${fmtN(cc.rv / 1e6, 2)} ล.`], '#d4af37'],
    ['ค่าจ้าง', fmtN(all.co), 'บาท', [`AB ${fmtN(ab.co)} · CC ${fmtN(cc.co)}`], '#d4af37'],
    ['% ต้นทุน', P2(all.pct), '', [`AB ${ab.rv ? P2(ab.pct) : '–'} · CC ${cc.rv ? P2(cc.pct) : '–'}`, `เที่ยววิ่ง ${fmtN(all.n)} เที่ยว`], '#d4af37'],
    ['เสาร์: รถเข้ารับเพิ่ม', (Pl.tr ? '+' : '') + fmtN(Pl.tr), 'คัน', [`ต้นทุนรถเพิ่ม ${fmtN(Pl.xc)} บาท`, `ตัดค่าจ้างเข้ารับในสายเดิม −${fmtN(Pl.diCo)} บาท`], BAD, Pl.tr ? '#ffb3bf' : '#fff'],
    ['อาทิตย์: งดรับ → จันทร์', (ou.co ? '−' : '') + fmtN(ou.co), 'บาท', [`เฉลี่ย ${fmtN(ou.n, 1)} เที่ยว/อาทิตย์ · %ต้นทุน ${ou.rv ? P2(ou.pct) : '–'}`, 'รถวันจันทร์เดิมรับได้หมด'], GOOD, ou.co ? '#9be3b8' : '#fff'],
    ['ผลสุทธิค่าจ้าง/สัปดาห์', (Pl.net > 0 ? '+' : Pl.net < 0 ? '−' : '') + fmtN(Math.abs(Pl.net)), 'บาท', [`${Pl.net > 0 ? 'ต้นทุนเพิ่ม' : 'ประหยัด'} (เสาร์ ${Pl.D.sat.co >= 0 ? '+' : '−'}${fmtN(Math.abs(Pl.D.sat.co))} · อาทิตย์ −${fmtN(ou.co)})`, 'รายได้ไม่เปลี่ยน'], Pl.net > 0 ? BAD : GOOD, Pl.net > 0 ? '#ffb3bf' : '#9be3b8']];
  cards.forEach((c, i) => { b += kpiCard(m + i * (kw + 14), ky, kw, kh, c[0], c[1], c[2], c[3], c[4], c[5]); });
  /* คอลัมน์ */
  const cy = ky + kh + 14, ch = H - foot - 14 - cy, lw = 900, lx = m, rx = m + lw + 14, rw = W - m - rx;
  /* ซ้าย: เรื่องที่ 1 */
  b += card(lx, cy, lw, ch) + T(lx + lw / 2, cy + 30, 'เรื่องที่ 1 · %ต้นทุนแยกวันทำการ · ' + M.label, { fs: 19, a: 'middle', w: 600, c: NAV });
  b += `<rect x="${lx + lw / 2 - 250}" y="${cy + 43}" width="12" height="12" rx="3" fill="${GOLD}"/>` + T(lx + lw / 2 - 232, cy + 54, 'AB', { fs: 13, c: MUT }) + `<rect x="${lx + lw / 2 - 198}" y="${cy + 43}" width="12" height="12" rx="3" fill="${BLUE}"/>` + T(lx + lw / 2 - 180, cy + 54, 'CC', { fs: 13, c: MUT }) + `<line x1="${lx + lw / 2 - 144}" x2="${lx + lw / 2 - 120}" y1="${cy + 49}" y2="${cy + 49}" stroke="${BAD}" stroke-width="2" stroke-dasharray="5 4"/>` + T(lx + lw / 2 - 114, cy + 54, 'KPI ' + fmtN(C.SETTINGS.kpi, 0) + '%', { fs: 13, c: BAD }) + T(lx + lw / 2 - 52, cy + 54, 'ตัวเลขบนแท่ง = % ค่าจ้างต่อรายได้', { fs: 13, c: MUT });
  const rowH = 33, tH = rowH * 9, ty = cy + ch - 16 - tH, chH = ty - (cy + 66) - 10;
  b += chart(M, lx + 16, cy + 66, lw - 32, chH);
  const g1 = grid(lx + 16, lw - 32, 200, 6), heads = ['รายได้', 'ค่าจ้าง', '%ต้นทุน', '%AB', '%CC', 'เที่ยววิ่ง'];
  b += `<rect x="${lx + 16}" y="${ty}" width="${lw - 32}" height="${rowH}" rx="6" fill="${NAV}"/>` + T(g1.L, ty + 22, 'วันทำการ', { fs: 14.5, w: 600, c: '#fff' }) + heads.map((h, i) => T(g1.R(i), ty + 22, h, { fs: 14.5, a: 'end', w: 600, c: '#fff' })).join('');
  [...DOW, 'tot'].forEach((d, k) => {
    const yy = ty + rowH * (k + 1), tot = d === 'tot', x = tot ? T1.ALL.tot : T1.ALL.days[d], a = tot ? T1.AB.tot : T1.AB.days[d], c = tot ? T1.CC.tot : T1.CC.days[d], bg = tot ? '#e6ecf7' : (d === 6 || d === 0) ? '#fbf7ec' : '';
    if (bg) b += `<rect x="${lx + 16}" y="${yy}" width="${lw - 32}" height="${rowH}" fill="${bg}"/>`;
    b += `<line x1="${lx + 16}" x2="${lx + lw - 16}" y1="${yy + rowH}" y2="${yy + rowH}" stroke="${LINE}"/>`;
    b += `<text x="${g1.L}" y="${yy + 22}" font-size="15" font-weight="700" fill="${INK}">${tot ? 'รวม' : DN[d]}<tspan font-size="12.5" font-weight="400" fill="${MUT}"> (${tot ? Object.values(M.days).reduce((s, v) => s + v, 0) : M.days[d]} วัน)</tspan></text>`;
    const v = [fmtN(x.rv), fmtN(x.co), x.rv ? P2(x.pct) : '–', a.rv ? P2(a.pct) : '–', c.rv ? P2(c.pct) : '–', fmtN(x.n)], col = [INK, INK, INK, GOLD, BLUE, INK], wt = [tot ? 700 : 400, tot ? 700 : 400, 700, 600, 600, tot ? 700 : 400];
    v.forEach((s, i) => { b += T(g1.R(i), yy + 22, s, { fs: 15, a: 'end', c: s === '–' ? '#9aa6ba' : col[i], w: wt[i] }); });
  });
  /* ขวา: เรื่องที่ 2 */
  const ix = rx + 16, iw = rw - 32, g2 = grid(ix, iw, 176, 6);
  b += card(rx, cy, rw, ch) + T(rx + rw / 2, cy + 30, 'เรื่องที่ 2 · แผนประมาณการณ์ เดิม–ใหม่ และผลต่าง (ต่อ 1 วัน)', { fs: 19, a: 'middle', w: 600, c: NAV });
  b += T(rx + rw / 2, cy + 53, `เดิม = เฉลี่ยเสาร์ ${M.nSat} วัน · อาทิตย์ ${M.nSun} วัน ในช่วงนี้ · แผน เสาร์ ${M.nextSat ? dd(M.nextSat) : '–'} รับอย่างเดียว · อาทิตย์ ${M.nextSun ? dd(M.nextSun) : '–'} งดรับ → จันทร์`, { fs: 13, a: 'middle', c: MUT });
  let y = cy + 66; const h1 = 30, h2 = 26, rh = 25;
  b += `<rect x="${ix}" y="${y}" width="${iw}" height="${h1 + h2}" rx="6" fill="${NAV}"/>` + T(g2.L, y + (h1 + h2) / 2 + 6, 'มิติงาน', { fs: 15, w: 600, c: '#fff' });
  ['เดิม', 'ใหม่', 'ผลต่าง'].forEach((t, i) => { b += T((g2.X(2 * i) + g2.X(2 * i + 2)) / 2, y + 21, t, { fs: 15.5, a: 'middle', w: 700, c: '#fff' }); if (i) b += `<line x1="${g2.X(2 * i)}" x2="${g2.X(2 * i)}" y1="${y + 6}" y2="${y + h1 + h2}" stroke="rgba(255,255,255,.25)"/>`; });
  b += `<rect x="${g2.X(0)}" y="${y + h1}" width="${iw - 176}" height="${h2}" fill="#e8ecf3"/>`;
  for (let i = 0; i < 6; i++) b += T(g2.M(i), y + h1 + 18, i % 2 ? 'อาทิตย์' : 'เสาร์', { fs: 13.5, a: 'middle', w: 600, c: NAV });
  y += h1 + h2;
  const bandTop = y;
  const rowsDef = [['รายได้', 'rv', 0], ['ค่าจ้าง', 'co', 0], ['%ต้นทุน', 'pct', 2], ['เที่ยววิ่ง (เฉลี่ย)', 'n', 1]];
  let body = '';
  [['ALL', 'ผลรวม AB + CC'], ['AB', 'AB'], ['CC', 'CC']].forEach(([g, lab]) => {
    const P = M.plan[g];
    body += `<rect x="${ix}" y="${y}" width="${iw}" height="${rh}" fill="${GC[g]}"/>` + T(g2.L, y + 18, lab, { fs: 14, w: 700, c: '#fff' }); y += rh;
    if (P.empty) { body += T(ix + iw / 2, y + 18, 'ไม่มีงานวันเสาร์/อาทิตย์ในช่วงนี้ → ไม่กระทบแผน', { fs: 13.5, a: 'middle', c: MUT }) + `<line x1="${ix}" x2="${ix + iw}" y1="${y + rh}" y2="${y + rh}" stroke="${LINE}"/>`; y += rh; return; }
    rowsDef.forEach(([l, k, d]) => {
      const isP = k === 'pct', f = v => Math.abs(v) < 1e-9 ? '–' : isP ? P2(v) : fmtN(v, d);
      const cells = [f(P.O.sat[k]), f(P.O.sun[k]), f(P.N.sat[k]), f(P.N.sun[k])].map(s => ({ s, c: s === '–' ? '#9aa6ba' : INK, w: 400 }));
      cells.push(isP ? sgn(P.D.sat[k], 2, true, 'pp') : sgn(P.D.sat[k], d, k !== 'rv'));
      cells.push(k === 'rv' && Math.abs(P.D.sun.rv) >= .5 ? { s: fmtN(P.D.sun.rv) + ' →จ.', c: MUT, w: 600 } : isP ? sgn(P.D.sun[k], 2, true, 'pp') : sgn(P.D.sun[k], d, true));
      body += T(g2.L, y + 18, l, { fs: 14.5 }) + cells.map((c, i) => T(g2.R(i), y + 18, c.s, { fs: 14.5, a: 'end', c: c.c, w: c.w })).join('') + `<line x1="${ix}" x2="${ix + iw}" y1="${y + rh}" y2="${y + rh}" stroke="${LINE}"/>`;
      y += rh;
    });
  });
  /* แถบสีคอลัมน์ ใหม่ / ผลต่าง (วาดก่อนตัวเลข) + เส้นแบ่งกลุ่มคอลัมน์ */
  b += `<rect x="${g2.X(2)}" y="${bandTop}" width="${g2.cw * 2}" height="${y - bandTop}" fill="#f4f7fb"/><rect x="${g2.X(4)}" y="${bandTop}" width="${g2.cw * 2}" height="${y - bandTop}" fill="#fbf7ec"/>` + body;
  [2, 4].forEach(i => { b += `<line x1="${g2.X(i)}" x2="${g2.X(i)}" y1="${bandTop}" y2="${y}" stroke="#c8d2e2"/>`; });
  b += `<line x1="${g2.X(0)}" x2="${g2.X(0)}" y1="${bandTop}" y2="${y}" stroke="#c8d2e2"/>`;
  b += T(ix + iw, y + 17, 'ผลต่าง: เขียว = ดีขึ้น · แดง = แย่ลง · →จ. = ย้ายไปรับวันจันทร์ (รายได้ไม่หาย)', { fs: 12, a: 'end', c: MUT });
  /* ตารางรถเพิ่ม (ใช้กริดเดียวกัน) */
  y += 28; const th = 28;
  b += `<rect x="${ix}" y="${y}" width="${iw}" height="${th}" rx="6" fill="${NAV}"/>` + T(g2.L, y + 19, 'รถเข้ารับเพิ่มวันเสาร์', { fs: 14, w: 600, c: '#fff' }) + ['จุดในสาย/เสาร์', 'จุด/เที่ยว IN', 'รถเพิ่ม (คัน)', 'บาท/เที่ยว IN', 'ต้นทุนรถเพิ่ม', 'ตัดในสายเดิม'].map((t, i) => T(g2.R(i), y + 19, t, { fs: 13, a: 'end', w: 600, c: '#fff' })).join('');
  y += th;
  const bridgeH = 62, bridgeY = cy + ch - 16 - bridgeH, room = Math.floor((bridgeY - 10 - y) / rh), E = M.eng.slice(0, Math.max(0, room));
  E.forEach(e => {
    b += `<text x="${g2.L}" y="${y + 18}" font-size="14.5" font-weight="700" fill="${INK}">${esc(e.dc)} · <tspan fill="${GC[e.g]}">${e.g}</tspan></text>`;
    const v = [fmtN(e.diPt, 1), e.ppt ? fmtN(e.ppt, 2) : '–', fmtN(e.trucks), e.cpt ? fmtN(e.cpt) : '–', fmtN(e.xc)], d = sgn(-e.diCo, 0, true);
    v.forEach((s, i) => { b += T(g2.R(i), y + 18, s, { fs: 14.5, a: 'end', w: i === 2 || i === 4 ? 700 : 400, c: s === '–' ? '#9aa6ba' : INK }); });
    b += T(g2.R(5), y + 18, d.s, { fs: 14.5, a: 'end', w: d.w, c: d.c }) + `<line x1="${ix}" x2="${ix + iw}" y1="${y + rh}" y2="${y + rh}" stroke="${LINE}"/>`;
    y += rh;
  });
  if (!M.eng.length) b += T(ix + iw / 2, y + 18, 'ไม่มีงานวันเสาร์ในช่วงนี้', { fs: 13.5, a: 'middle', c: MUT });
  if (M.eng.some(e => e.noIn)) b += T(ix + iw, y + 16, '* ไม่มีรถเข้ารับอย่างเดียววันเสาร์ใน DC+กลุ่มนี้ จึงประเมินรถเพิ่มไม่ได้', { fs: 11.5, a: 'end', c: BAD });
  /* สะพานผลต่าง 4 กล่อง กว้างเท่ากัน */
  const bw4 = (iw - 3 * 12) / 4, br = [['รถเพิ่มวันเสาร์', Pl.xc, false], ['ตัดค่าจ้างในสายเดิม', -Pl.diCo, true], ['งดรับวันอาทิตย์', -ou.co, true], ['สุทธิต่อสัปดาห์', Pl.net, true]];
  br.forEach(([l, v], i) => {
    const x = ix + i * (bw4 + 12), net = i === 3, c = Math.abs(v) < .5 ? MUT : v > 0 ? BAD : GOOD, bg = net ? (v > 0 ? '#fdecef' : '#e7f6ed') : '#f2f5fb';
    b += `<rect x="${x}" y="${bridgeY}" width="${bw4}" height="${bridgeH}" rx="10" fill="${bg}"/>` + T(x + bw4 / 2, bridgeY + 22, l, { fs: 13, a: 'middle', c: MUT, w: net ? 600 : 400 }) + T(x + bw4 / 2, bridgeY + 50, (Math.abs(v) < .5 ? '0' : (v > 0 ? '+' : '−') + fmtN(Math.abs(v))) + ' บาท', { fs: 23, a: 'middle', w: 700, c });
  });
  const ftxt = 'รถเพิ่ม = ปัดขึ้น(จุดรับในสายเฉลี่ยต่อเสาร์ ÷ จุดต่อเที่ยวของรถเข้ารับอย่างเดียววันเสาร์ DC+กลุ่มเดียวกัน) × ค่าจ้างเฉลี่ยต่อเที่ยว · รายได้วันอาทิตย์ย้ายไปวันจันทร์ · เที่ยวในสายนับรายจุดรับ';
  b += `<rect y="${H - foot}" width="${W}" height="${foot}" fill="${NAV}"/><rect y="${H - foot}" width="${W}" height="3" fill="#d4af37"/>` + T(W / 2, H - foot / 2 + 5, ftxt, { fs: 13, a: 'middle', c: '#dfe8f7' });
  /* หัว: ใช้หัวมาตรฐาน แต่ระบุว่ารวมทุกกลุ่ม/ทุกงาน */
  const keep = { group: S.group, trip: S.trip, work: S.work, mode: S.mode, per: S.per }; Object.assign(S, { group: 'all', trip: 'all', work: 'all', mode: M.mode, per: M.per });
  let hd; try { hd = A_.sheetHead(W, head, 'hwd'); } finally { Object.assign(S, keep); }
  const svg = A_.wrap(W, H, hd + b);
  svg.svg = svg.svg.replace('ต้นทุนงานเข้ารับเทียบรายได้</text>', 'สรุปแยกวันทำการ + แผนเสาร์รับอย่างเดียว · อาทิตย์ยกไปจันทร์</text>');
  return svg;
}
async function exportWeekday() { return await A().toPng(infoWeekday(), 2); }
window.NXWD = { model, infoWeekday, exportWeekday };
})();
