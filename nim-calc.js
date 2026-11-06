/**
 * NIM EXPRESS · Dashboard Inbound Cost Report — โค้ดคำนวณ (standalone, ไม่พึ่ง DOM)
 * ดึงตรงจากตรรกะในแดชบอร์ดจริง  ใช้ได้ทั้ง Node และเบราว์เซอร์ (window.NIMCalc)
 * ลำดับงาน: processSheetRows(แถว Excel) -> mergeRecords -> buildDerived -> filter -> aggregate
 */
(function (root) {
  'use strict';
  var DC_FILTER = ['610', '621', '691'];
  var SETTINGS = { kpi: 10, warnBuffer: 1.5 };

  function n(v) { v = +v; return isFinite(v) ? v : 0; }

  /* ---------- parsing ---------- */
  function parseThaiDate(s) {            // "dd/mm/พ.ศ." -> Date
    if (!s) return null;
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s).trim());
    if (!m) return null;
    return new Date(+m[3] - 543, +m[2] - 1, +m[1]);
  }
  function monthKeyOf(d) { return d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') : 'unk'; }
  function firstToken(s) { s = (s == null ? '' : String(s)).trim(); return s ? s.split(/\s+/)[0] : ''; }
  function dcNameOf(s) {
    s = (s == null ? '' : String(s)).trim();
    var p = s.split(/\s+/); return p.length > 1 ? p.slice(1).join(' ') : s;
  }
  function splitRoute(s) {
    s = (s == null ? '' : String(s)).trim();
    if (!s) return { code: '', desc: '' };
    var m = /^(\S+)\s{2,}(.*)$/.exec(s);
    if (m) return { code: m[1].trim(), desc: m[2].trim() };
    var p = s.split(/\s+/);
    return p.length > 1 ? { code: p[0], desc: p.slice(1).join(' ') } : { code: '', desc: s };
  }

  /* ---------- 1) แถว Excel (array-of-arrays, index เริ่ม 0) -> record ----------
     B=1 DC, C=2 invoice, D=3 date, F=5 rate type, H=7 plate, K=10 route type, L=11 route,
     AD=29 ชนิดรถ, AB: AM..AP = 38..41, CC: AQ..AT = 42..45, AV=47 จุดเข้ารับ */
  function processSheetRows(rows) {
    var out = [];
    rows.forEach(function (row) {
      if (!row) return;
      var inv = row[2]; if (inv === undefined || inv === null || inv === '') return;
      var invNum = Number(inv); if (!isFinite(invNum) || invNum <= 0) return;
      var dc = firstToken(row[1]); if (DC_FILTER.indexOf(dc) === -1) return;
      var rate = (row[5] == null ? '' : String(row[5])).trim();
      if (rate.indexOf('เข้ารับ') !== 0) return;                 // เฉพาะเข้ารับ
      var ad = firstToken(row[29]), g;
      if (ad === '040' || ad === '041') g = 'AB'; else if (ad === '042') g = 'CC'; else return;
      var o = g === 'AB' ? 38 : 42;
      var dv = row[3], dt;
      if (dv instanceof Date) dt = String(dv.getDate()).padStart(2, '0') + '/' + String(dv.getMonth() + 1).padStart(2, '0') + '/' + (dv.getFullYear() + 543);
      else dt = (dv == null ? '' : String(dv)).trim();
      var rt = splitRoute(row[11]);
      out.push({
        i: String(Math.round(invNum)), dc: dc, dn: dcNameOf(row[1]), dt: dt,
        pl: (row[7] == null ? '' : String(row[7])).trim(), g: g, rc: rt.code, rd: rt.desc,
        rty: (row[10] == null ? '' : String(row[10])).trim(),
        bl: n(row[o]), bx: n(row[o + 1]), rv: n(row[o + 2]), co: n(row[o + 3]), pt: n(row[47])
      });
    });
    return out;
  }

  /* ---------- 2) รวมข้อมูลเก่า+ใหม่: เลขที่ใบรายการซ้ำ -> ยึดค่าใหม่ ---------- */
  function mergeRecords(oldArr, newArr) {
    var map = new Map();
    oldArr.forEach(function (r) { map.set(r.i, r); });
    newArr.forEach(function (r) { map.set(r.i, r); });
    return Array.from(map.values());
  }

  /* ---------- 3) คอลัมน์คำนวณ: เที่ยวเดี่ยว/หลายเที่ยว, ค่าจ้างประมาณการเมื่อเป็น 0 ---------- */
  function buildDerived(RAW) {
    var sumP = {}, cntP = {}, sumG = {}, cntG = {}, trip = {};
    RAW.forEach(function (r) {
      var tk = r.pl + '|' + r.dt; trip[tk] = (trip[tk] || 0) + 1;     // ใบงานต่อทะเบียนต่อวัน
      if (n(r.co) > 0) {
        sumP[r.pl] = (sumP[r.pl] || 0) + n(r.co); cntP[r.pl] = (cntP[r.pl] || 0) + 1;
        var gk = r.dc + '|' + r.g; sumG[gk] = (sumG[gk] || 0) + n(r.co); cntG[gk] = (cntG[gk] || 0) + 1;
      }
    });
    return RAW.map(function (r) {
      var d = parseThaiDate(r.dt), tk = r.pl + '|' + r.dt;
      var eff = n(r.co), est = false;
      if (!(n(r.co) > 0)) {                                           // ค่าจ้าง 0 -> เฉลี่ยทะเบียนเดียวกัน, ไม่มีก็เฉลี่ย DC+กลุ่ม
        if (cntP[r.pl] > 0) { eff = sumP[r.pl] / cntP[r.pl]; est = true; }
        else {
          var g2 = r.dc + '|' + r.g;
          if (cntG[g2] > 0) { eff = sumG[g2] / cntG[g2]; est = true; } else eff = 0;
        }
      }
      var rv = n(r.rv);
      return {
        i: r.i, dc: r.dc, dn: r.dn, dt: r.dt, pl: r.pl, g: r.g, rc: r.rc, rd: r.rd, rty: r.rty,
        bl: n(r.bl), bx: n(r.bx), rv: rv, co: n(r.co), pt: n(r.pt),
        dateObj: d, mKey: monthKeyOf(d), tripKey: tk, isMulti: (trip[tk] || 0) >= 2,
        effCost: eff, isEstimated: est,
        pct: rv > 0 ? eff / rv * 100 : (eff > 0 ? null : 0)
      };
    });
  }

  /* ---------- 4) ตัวกรอง (ค่า 'all' = ไม่กรอง; trip = 'single'|'multi') ---------- */
  function getFiltered(DERIVED, F) {
    F = F || {};
    return DERIVED.filter(function (r) {
      if (F.dc && F.dc !== 'all' && r.dc !== F.dc) return false;
      if (F.month && F.month !== 'all' && r.mKey !== F.month) return false;
      if (F.date && F.date !== 'all' && r.dt !== F.date) return false;
      if (F.group && F.group !== 'all' && r.g !== F.group) return false;
      if (F.trip === 'single' && r.isMulti) return false;
      if (F.trip === 'multi' && !r.isMulti) return false;
      return true;
    });
  }

  /* ---------- 5) สรุปผล ---------- */
  function mkAgg() { return { trips: 0, bills: 0, boxes: 0, points: 0, revenue: 0, cost: 0, pct: 0, avgPoints: 0 }; }
  function accum(a, r) { a.trips += 1; a.bills += r.bl; a.boxes += r.bx; a.points += r.pt; a.revenue += r.rv; a.cost += r.effCost; }
  function finalizeAgg(a) {
    a.pct = a.revenue > 0 ? a.cost / a.revenue * 100 : (a.cost > 0 ? null : 0);   // %ค่าจ้าง = ค่าจ้าง ÷ รายได้ × 100
    a.avgPoints = a.trips > 0 ? a.points / a.trips : 0;
  }
  function aggregate(rows) {
    var t = mkAgg(), ab = mkAgg(), cc = mkAgg();
    rows.forEach(function (r) { accum(t, r); accum(r.g === 'AB' ? ab : cc, r); });
    finalizeAgg(t); finalizeAgg(ab); finalizeAgg(cc);
    return { total: t, AB: ab, CC: cc };
  }
  function pctClass(p) {                      // สีสถานะเทียบ KPI
    if (p === null || p === undefined) return '';
    if (p > SETTINGS.kpi) return 'bad';
    if (p > SETTINGS.kpi - SETTINGS.warnBuffer) return 'warn';
    return 'good';
  }

  /* ---------- 6) เส้นทาง / ทะเบียนรถ / รายวัน ---------- */
  function buildRouteAgg(rows) {
    var map = new Map();
    rows.forEach(function (r) {
      var key = r.dc + '|' + (r.rc || r.rd || 'ไม่ระบุ');
      if (!map.has(key)) map.set(key, { dc: r.dc, dn: r.dn, rc: r.rc, rd: r.rd, groups: {}, agg: mkAgg(), rows: [] });
      var o = map.get(key); o.groups[r.g] = true; accum(o.agg, r); o.rows.push(r);
    });
    var arr = Array.from(map.values()); arr.forEach(function (o) { finalizeAgg(o.agg); }); return arr;
  }
  function buildVehicleRows(rows) {
    var map = new Map();
    rows.forEach(function (r) {
      if (!map.has(r.pl)) map.set(r.pl, { pl: r.pl, dcSet: {}, gSet: {}, routeMap: {}, agg: mkAgg() });
      var o = map.get(r.pl); o.dcSet[r.dc] = true; o.gSet[r.g] = true;
      var rk = r.rc || r.rd || 'ไม่ระบุ'; o.routeMap[rk] = (o.routeMap[rk] || 0) + 1; accum(o.agg, r);
    });
    var arr = Array.from(map.values()), buckets = {}, median = {};
    arr.forEach(function (o) {
      finalizeAgg(o.agg); o.dc = Object.keys(o.dcSet)[0]; o.g = Object.keys(o.gSet)[0];
      o.costPerTrip = o.agg.trips > 0 ? o.agg.cost / o.agg.trips : 0;
      (buckets[o.dc + '|' + o.g] = buckets[o.dc + '|' + o.g] || []).push(o.costPerTrip);
    });
    Object.keys(buckets).forEach(function (k) {
      var s = buckets[k].slice().sort(function (a, b) { return a - b; });
      median[k] = s.length ? s[Math.floor(s.length / 2)] : 0;
    });
    arr.forEach(function (o) {                // รถผิดปกติ: ≥2 เที่ยว และ ค่าจ้าง/เที่ยว > 1.5× มัธยฐานของ DC+กลุ่ม
      var med = median[o.dc + '|' + o.g] || 0;
      o.medianCostPerTrip = med;
      o.anomaly = (o.agg.trips >= 2 && med > 0 && o.costPerTrip > med * 1.5);
    });
    return arr;
  }
  function dailyAgg(rows) {
    var by = {};
    rows.forEach(function (r) {
      if (!by[r.dt]) by[r.dt] = { total: mkAgg(), AB: mkAgg(), CC: mkAgg() };
      accum(by[r.dt].total, r); accum(by[r.dt][r.g], r);
    });
    var dates = Object.keys(by).sort(function (a, b) { return parseThaiDate(a) - parseThaiDate(b); });
    dates.forEach(function (d) { finalizeAgg(by[d].total); finalizeAgg(by[d].AB); finalizeAgg(by[d].CC); });
    return { dates: dates, byDate: by };          // วันอาทิตย์: คำนวณใน KPI แต่กราฟรายวันซ่อน (ตัดที่ชั้นแสดงผล)
  }

  /* ---------- 7) เปรียบเทียบช่วงเวลา (วัน / สัปดาห์ จ–อา / เดือน) ---------- */
  function mondayOf(d) { var day = d.getDay(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (day === 0 ? -6 : 1 - day)); }
  function weekKeyOf(d) { var m = mondayOf(d); return m.getFullYear() + '-' + (m.getMonth() + 1) + '-' + m.getDate(); }
  function rowsForPeriod(rows, mode, value) {
    if (mode === 'day') return rows.filter(function (r) { return r.dt === value; });
    if (mode === 'month') return rows.filter(function (r) { return r.mKey === value; });
    var p = value.split('-').map(Number);
    var a = new Date(p[0], p[1] - 1, p[2]), b = new Date(p[0], p[1] - 1, p[2] + 6, 23, 59, 59, 999);
    return rows.filter(function (r) { return r.dateObj && r.dateObj >= a && r.dateObj <= b; });
  }
  /* ส่วนต่าง: cur-prev ; goodWhenHigher=true (รายได้/บิล/กล่อง/จุด/จุดเฉลี่ย) ; false (ค่าจ้าง/%/เที่ยว) -> สูงขึ้น=แดง
     %ค่าจ้างแสดงเป็น "จุด" 2 ตำแหน่ง ส่วนอื่นแสดงเป็น % การเปลี่ยนแปลง */
  function diff(cur, prev, goodWhenHigher, isPct) {
    if (prev == null || cur == null) return null;
    var d = cur - prev, up = d > 0, bad = goodWhenHigher ? !up : up;
    return { delta: d, dir: d === 0 ? 0 : (up ? 1 : -1), color: d === 0 ? 'none' : (bad ? 'bad' : 'good'),
             text: isPct ? Math.abs(d).toFixed(2) + ' จุด' : (prev !== 0 ? (Math.abs(d) / Math.abs(prev) * 100).toFixed(1) + '%' : null) };
  }

  var api = {
    DC_FILTER: DC_FILTER, SETTINGS: SETTINGS, n: n,
    parseThaiDate: parseThaiDate, monthKeyOf: monthKeyOf, firstToken: firstToken, splitRoute: splitRoute,
    processSheetRows: processSheetRows, mergeRecords: mergeRecords, buildDerived: buildDerived,
    getFiltered: getFiltered, aggregate: aggregate, pctClass: pctClass,
    buildRouteAgg: buildRouteAgg, buildVehicleRows: buildVehicleRows, dailyAgg: dailyAgg,
    weekKeyOf: weekKeyOf, rowsForPeriod: rowsForPeriod, diff: diff
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NIMCalc = api;
})(typeof window !== 'undefined' ? window : this);
