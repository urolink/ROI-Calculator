/* ══════════════════════════════════════════════════════════════
   Aries 2 ROI 계산기 — 화면(UI) 파일.
   데이터 = models.js / 계산 = calc.js / 이 파일 = 입력·그래프·저장·출력 (계산식은 여기 두지 말 것)
   섹션: 상수 → 유틸 → 상태 → 그리기 → 입력 → 저장·공유 → 초기화
   ══════════════════════════════════════════════════════════════ */
const APP_VERSION = '20261120h';
const C = AriesCalc, D = ARIES2;
const TARGETS = [12, 18, 24, 36, 48];
const SAVE_KEY = 'urolink_aries2_roi_saved_v3';
const DEFAULT_PAT = { skin: 4, nod: 3 };           // 상담 예시 값(처음 화면용)
const PAY_LABEL = { prepaid: '선결제', session: '회차별 결제', installment: '분할 결제' };

/* ── 유틸 ── */
const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(String(v).replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const comma = n => Math.round(n).toLocaleString('ko-KR');
function won(v) {
  const a = Math.abs(v), sg = v < 0 ? '-' : '';
  if (a >= 1e8) return sg + String(+(a / 1e8).toFixed(2)) + '억 원';
  return sg + comma(a / 1e4) + '만 원';
}
function mon(m) {
  if (m == null) return '-';
  const r = Math.round(m * 10) / 10, t = Math.round(m), y = Math.floor(t / 12), rem = t % 12;
  return r + '개월' + (t >= 12 ? ' (' + y + '년' + (rem ? ' ' + rem + '개월' : '') + ')' : '');
}
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2400);
}
function axis(v) {
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e8) return s + String(+(a / 1e8).toFixed(2)) + '억';
  if (a >= 1e4) return s + comma(a / 1e4) + '만';
  return '0';
}

/* ── 상태 ── */
let S = {};
/* 상태의 모델 항목: 프로토콜 모델 {k,pat,sh,area,se,iv,fee} / 직접 추가 {k,custom:true,name,sh,se,iv,pat,fee}
   프로토콜 값(타수·횟수·간격)의 원본은 models.js 이고, 여기에는 사용자가 범위 안에서 고른 값만 둔다. */
function newModelState(m) {
  return { k: m.k, pat: DEFAULT_PAT[m.k] || 0, fee: null,
    sh: m.shots.v != null ? m.shots.v : (m.shots.area ? 0 : m.shots.def), area: m.shots.area ? m.shots.def : 0,
    se: m.sess.v != null ? m.sess.v : m.sess.def, iv: m.iv.v };
}
function freshState() {
  return {
    hospital: '', fee: 60, payMode: 'session', inst: 3,
    labor: 30, maint: 20, varSess: 0,
    invest: D.conditions.invest, applPrice: D.conditions.applPrice, applLife: D.conditions.applLife,
    target: 24, revMode: 'mix', solo: 0, tab: 'ob',
    models: D.models.map(newModelState),
  };
}
const metaOf = sm => (sm.custom ? null : D.models.find(m => m.k === sm.k));
const nameOf = sm => (sm.custom ? (sm.name || '(이름 없음)') : metaOf(sm).name);
const shotsOf = sm => {
  const m = metaOf(sm);
  return m && m.shots.area ? Math.round(Math.min(sm.area, m.shots.cap) * m.shots.per) : sm.sh;
};
/** 자료에 없는 값(임시 가정)·확인 필요 사항이 있으면 true */
const unconfirmed = sm => { const m = metaOf(sm); return !m || !!m.warn || !!m.iv.assumed; };
function cfgOf(s) {
  return {
    invest: s.invest, applPrice: s.applPrice, applLife: s.applLife, fee: s.fee, interval: D.fallbackInterval, varPerSession: s.varSess,
    fixed: (s.labor + s.maint) * 1e4, payMode: s.payMode, inst: s.inst,
    models: s.models.map(m => ({ name: nameOf(m), shots: shotsOf(m), sess: m.se, pat: m.pat, fee: m.fee, interval: m.iv, ok: !unconfirmed(m) })),
  };
}

/* ══════════════ 그리기 ══════════════ */
function render() {
  readInputs();
  const cfg = cfgOf(S), T = clamp(Math.round(S.target) || 24, 1, 120);
  const R = C.simulate(cfg, 120), st = R.steadyMonth;
  const pat = S.models.reduce((a, m) => a + m.pat, 0);
  const fixed = cfg.fixed;

  document.title = (S.hospital ? S.hospital + ' · ' : '') + 'Aries 2 ROI';
  $('repTitle').textContent = (S.hospital ? S.hospital + ' ' : '') + 'Aries 2 도입 경제성 분석';
  $('repSub').textContent = '장비 공급가 ' + comma(S.invest) + '원(VAT 포함) · ' + PAY_LABEL[S.payMode] + ' · ' + new Date().toLocaleDateString('ko-KR');
  $('applCost').textContent = (+R.applCost.toFixed(2)) + ' 원/타';
  $('laborV').textContent = comma(S.labor) + '만 원'; $('maintV').textContent = comma(S.maint) + '만 원';
  $('instBox').hidden = S.payMode !== 'installment';
  $('payHint').textContent = { prepaid: '첫 방문 달에 프로그램 총액 전액을 수납한다고 가정합니다.',
    session: '치료를 시행하는 달에 회당 수가를 수납한다고 가정합니다.',
    installment: '첫 방문 달부터 ' + S.inst + '개월 동안 프로그램 총액을 균등하게 수납한다고 가정합니다.' }[S.payMode];
  setSeg('payMode', S.payMode); setSeg('revMode', S.revMode);
  refreshModelCalc();

  // 경고
  const msgs = [];
  if (!pat) msgs.push(['info', '치료 모델의 월 신규 환자 수를 입력하면 결과가 계산됩니다.']);
  else if (R.payback == null) msgs.push(['bad', '10년(120개월) 안에 투자금을 회수하지 못하는 조건입니다. 환자 수·수가·운영비를 확인해 주세요.']);
  if (R.payback != null) {                   // 첫 회수 뒤 교체비 지출로 누적이 다시 0 아래로 내려가는지
    let d0 = null, d1 = null;
    for (let m = Math.ceil(R.payback) + 1; m <= R.H; m++) {
      if (d0 == null && R.cum[m] < 0) d0 = m;
      else if (d0 != null && R.cum[m] >= 0) { d1 = m; break; }
    }
    if (d0 != null) msgs.push(['info', '첫 회수 후 ' + d0 + '개월차 어플리케이터 교체비 지출로 누적 현금흐름이 다시 마이너스가 되며, ' + (d1 ? d1 + '개월차에 다시 회복됩니다.' : '120개월 안에는 회복되지 않습니다.')]);
  }
  S.models.filter(m => m.pat > 0 && unconfirmed(m)).forEach(m => {
    const mt = metaOf(m);
    msgs.push(['info', '⚠ ' + nameOf(m) + ': ' + (mt ? mt.warn || ('치료 간격(' + m.iv + '일)은 자료에 없는 가정값입니다.') : '직접 입력한 모델로 프로토콜 자료에 없는 값입니다.')]);
  });
  S.models.forEach(m => { const mt = metaOf(m); if (mt && mt.shots.area && m.pat > 0 && m.area > mt.shots.cap) msgs.push(['info', '비후성 흉터: 면적 ' + m.area + '㎠는 기본 적용 면적 상한 ' + mt.shots.cap + '㎠(' + comma(mt.shots.cap * mt.shots.per) + '타)로 계산했습니다.']); });
  if (S.fee < D.feeRange[0] || S.fee > D.feeRange[1]) msgs.push(['info', '입력한 타당 수가가 검토 기준(' + D.feeRange[0] + '~' + D.feeRange[1] + '원)을 벗어납니다.']);
  $('warn').hidden = !msgs.length;
  $('warn').className = 'warn' + (msgs.length && msgs.every(x => x[0] === 'info') ? ' info' : '');
  $('warn').innerHTML = msgs.map(x => esc(x[1])).join('<br>');

  // 히어로
  const hv = $('rPayback');
  if (R.payback == null) { hv.textContent = pat ? '회수 불가' : '-'; hv.classList.toggle('bad', !!pat); hv.style.fontSize = '26px'; }
  else { hv.textContent = mon(R.payback); hv.classList.remove('bad'); hv.style.fontSize = ''; }
  $('rPaybackSub').textContent = R.payback == null ? '' : '초기 투자 ' + comma(S.invest) + '원이 월별 누적 현금흐름으로 0원을 넘는 시점입니다.';
  const g = $('rGoal');
  if (!pat) g.textContent = '';
  else if (R.payback != null && R.payback <= T) { g.className = 'goal ok'; g.textContent = '✔ 목표 ' + T + '개월 달성 (' + (+(T - R.payback).toFixed(1)) + '개월 앞서 회수)'; }
  else { g.className = 'goal no'; const rv = C.reverseMix(cfg, T);
    g.textContent = '✖ 목표 ' + T + '개월 미달' + (R.payback != null ? ' (' + (+(R.payback - T).toFixed(1)) + '개월 초과)' : '') + (rv.ok ? ' · 달성에는 월 ' + rv.total + '명 필요' : ''); }

  // KPI (안정기 = 모든 코호트가 치료·결제 주기에 들어온 이후의 대표 월)
  const sv = R.accrual[st] + R.extraVar[st];
  $('rPat').textContent = comma(pat) + '명';
  $('rProg').textContent = won(R.program[st]);
  $('rSess').textContent = comma(R.sessions[st]) + '건';
  $('rRev').textContent = won(R.revenue[st]);
  $('rCol').textContent = won(R.collect[st]);
  $('rVar').textContent = won(sv);
  setKpi('rContrib', won(R.contrib[st]), R.contrib[st]);
  $('rFixed').textContent = won(fixed);
  setKpi('rAfter', won(R.afterFixed[st]), R.afterFixed[st]);
  $('mbPay').textContent = R.payback == null ? (pat ? '회수 불가' : '-') : mon(R.payback).split(' ')[0];
  $('mbMon').textContent = pat ? won(R.afterFixed[st]) : '-';
  $('steadyNote').innerHTML = pat ? '안정기는 <b>' + st + '개월차</b> 기준입니다(그 이전에는 치료·수납이 쌓이는 중이라 값이 다릅니다). 교체비 상당액은 손익용 적립이고, 실제 교체 현금지출 '
    + (R.firstRepl ? '<b>' + comma(S.applPrice) + '원</b>은 <b>' + R.firstRepl + '개월차</b>에 발생합니다(회수기간 계산에 반영됨).' : '은 120개월 안에는 발생하지 않습니다.') : '';

  drawReverse(cfg, R, T);
  drawCharts(R, T);
  drawShare(cfg, R);
  drawMonthly(R);
  drawAssump(cfg, R);

  $('fine').innerHTML = '<ul style="padding-left:18px;margin:0">'
    + '<li><b>프로그램 계약 총액</b>은 계약 기준 금액, <b>시술 매출</b>은 실제 치료한 달의 매출, <b>실제 수납액</b>은 결제 방식에 따라 들어온 현금으로 서로 다릅니다.</li>'
    + '<li><b>공헌이익</b>은 시술 매출에서 변동비(교체비 상당액·회당 추가 변동비)를 뺀 값이고, 고정 운영비까지 뺀 것이 <b>운영 후 공헌이익</b>입니다. 순이익이 아니며 세금·감가상각 등은 반영하지 않았습니다.</li>'
    + '<li>회수기간은 <b>월별 누적 현금흐름</b>(수납액 − 변동비 − 고정 운영비 − 교체 현금지출) 기준입니다. 매월 같은 수의 신규 환자가 온다고 가정한 단순 계산입니다.</li>'
    + '<li>장비 공급가·교체비는 <b>VAT 포함</b> 금액 그대로 사용했고, 수가·수납액은 병원 수납 금액 기준입니다(부가세 해당 여부는 반영하지 않음).</li>'
    + '<li>실제 병원 수익을 예측하거나 보장하지 않습니다.</li></ul>';
  scheduleHash();
}
function setKpi(id, text, v) { const e = $(id); e.textContent = text; e.classList.toggle('gr', v > 0); e.classList.toggle('rd', v < 0); }
function setSeg(id, v) { $(id).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); }

/* ── 역산 ── */
function splitInt(split, total) {          // 합이 total 이 되도록 최대잔여법으로 정수 분배
  const base = split.map(x => Math.floor(x.n)), rest = total - base.reduce((a, b) => a + b, 0);
  split.map((x, i) => [x.n - base[i], i]).sort((a, b) => b[0] - a[0]).slice(0, Math.max(0, rest)).forEach(p => base[p[1]]++);
  return split.map((x, i) => ({ name: x.name, n: base[i] }));
}
function drawReverse(cfg, R, T) {
  const pat = S.models.reduce((a, m) => a + m.pat, 0);
  const solo = S.revMode === 'solo', idx = clamp(S.solo, 0, S.models.length - 1);
  $('soloSel').hidden = !solo;
  $('tgtChips').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === T));
  $('revL').textContent = '목표 ' + T + '개월 내 투자금 회수에 필요한 월 신규 환자';
  if (!solo && !pat) {
    $('revV').textContent = '-'; $('revS').textContent = '치료 모델의 월 신규 환자 수를 입력하면, 그 비율을 유지하면서 목표 기간에 필요한 환자 수를 계산합니다.';
  } else if (!solo) {
    const rv = C.reverseMix(cfg, T);
    if (!rv.ok) { $('revV').textContent = '계산 불가'; $('revS').textContent = '환자를 늘려도 목표 기간 내 회수가 어려운 조건입니다.'; }
    else {
      $('revV').textContent = comma(rv.total) + '명';
      const cur = pat ? ' · 현재 입력 ' + comma(pat) + '명 ' + (pat >= rv.total ? '(충족)' : '(' + comma(rv.total - pat) + '명 부족)') : '';
      $('revS').innerHTML = '현재 환자 비율을 유지하는 경우' + esc(cur) + '<br>구성: ' + splitInt(rv.split, rv.total).map(x => esc(x.name) + ' ' + x.n + '명').join(' · ')
        + (pat ? '' : '<br><span class="mut">환자 입력 전이라 확인된 모델에 균등 배분했습니다.</span>');
    }
  } else {
    const nm = nameOf(S.models[idx]), rv = C.reverseSolo(cfg, T, idx);
    if (!rv.ok) { $('revV').textContent = '계산 불가'; $('revS').textContent = nm + '만 늘려서는 목표 기간 내 회수가 어렵습니다.'; }
    else {
      $('revV').textContent = comma(rv.n) + '명';
      $('revS').innerHTML = esc(nm) + ' 월 신규 환자를 ' + comma(rv.n) + '명으로 조정 (현재 ' + S.models[idx].pat + '명)<br>다른 모델은 현재 입력값을 그대로 유지합니다.';
    }
  }
  let h = '<tr><th>목표 회수기간</th><th>' + (solo ? esc(nameOf(S.models[idx])) + ' 필요 월 환자' : '필요 월 환자 (비율 유지)') + '</th></tr>';
  TARGETS.forEach(t => {
    let v = '-';
    if (!solo) { if (pat) { const r = C.reverseMix(cfg, t); if (r.ok) v = comma(r.total) + '명'; } }
    else { const r = C.reverseSolo(cfg, t, idx); if (r.ok) v = comma(r.n) + '명'; }
    h += '<tr' + (t === T ? ' class="hl"' : '') + '><td>' + t + '개월</td><td>' + v + '</td></tr>';
  });
  $('revTbl').innerHTML = h;
}

/* ── 그래프 ── */
function plot(o) {
  const W = 480, H = 260, L = 64, Rr = 18, Tp = 14, B = 34;
  let mn = 0, mx = 0;
  o.series.forEach(s => { for (let m = o.x0; m <= o.x1; m++) { mn = Math.min(mn, s.ys[m]); mx = Math.max(mx, s.ys[m]); } });
  if (mx - mn < 1) mx = mn + 1;
  const raw = (mx - mn) / 4, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map(k => k * mag).find(s => s >= raw);
  mn = Math.floor(mn / step) * step; mx = Math.ceil(mx / step) * step;
  const X = m => L + (W - L - Rr) * (m - o.x0) / (o.x1 - o.x0), Y = v => Tp + (H - Tp - B) * (1 - (v - mn) / (mx - mn));
  let g = '';
  for (let v = mn; v <= mx + step / 2; v += step) {
    const y = Y(v);
    g += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y + '" y2="' + y + '" stroke="#eef2f7"/><text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="12.5" fill="#94a3b8">' + axis(v) + '</text>';
  }
  for (let m = o.x0 === 0 ? 0 : o.xt; m <= o.x1; m += o.xt) g += '<text x="' + X(m) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="12.5" fill="#94a3b8">' + (m ? m + '개월' : '도입') + '</text>';
  g += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="#64748b" stroke-width="1.3"/>';
  if (o.under) g += o.under(X, Y, Tp, H - B);
  o.series.forEach(s => {
    const p = []; for (let m = o.x0; m <= o.x1; m++) p.push(X(m).toFixed(1) + ',' + Y(s.ys[m]).toFixed(1));
    g += '<polyline points="' + p.join(' ') + '" fill="none" stroke="' + s.color + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>';
  });
  if (o.over) g += o.over(X, Y, Tp, H - B, W);
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">' + g + '</svg>';
}
function drawCharts(R, T) {
  $('chartMon').innerHTML = plot({ x0: 1, x1: 36, xt: 6, series: [
    { ys: R.revenue, color: '#0e7490' }, { ys: R.collect, color: '#8b5cf6' }, { ys: R.net, color: '#ea580c' }] });
  const hz = clamp(Math.ceil(Math.max(T, R.payback || 0) * 1.2), 24, 120);
  $('chartCum').innerHTML = plot({ x0: 0, x1: hz, xt: hz <= 36 ? 6 : 12, series: [{ ys: R.cum, color: '#0e7490' }],
    under: (X, Y, t, b) => (T <= hz ? '<line x1="' + X(T) + '" x2="' + X(T) + '" y1="' + t + '" y2="' + b + '" stroke="#16a34a" stroke-width="1.6" stroke-dasharray="3 3"/>' : ''),
    over: (X, Y, t, b, W) => {
      let s = '';
      for (let m = 1; m <= hz; m++) if (R.replCash[m] > 0) s += '<circle cx="' + X(m) + '" cy="' + Y(R.cum[m]) + '" r="5" fill="#dc2626" stroke="#fff" stroke-width="2"/>';
      if (R.payback != null && R.payback <= hz) {
        const x = X(R.payback), a = x > W - 100 ? 'end' : 'start';
        s += '<line x1="' + x + '" x2="' + x + '" y1="' + t + '" y2="' + b + '" stroke="#ea580c" stroke-width="1.6" stroke-dasharray="4 3"/><circle cx="' + x + '" cy="' + Y(0) + '" r="5.5" fill="#ea580c" stroke="#fff" stroke-width="2"/>'
          + '<text x="' + (x + (a === 'end' ? -8 : 8)) + '" y="' + (t + 12) + '" text-anchor="' + a + '" font-size="14" font-weight="700" fill="#ea580c">' + (+R.payback.toFixed(1)) + '개월</text>';
      }
      return s;
    } });
}

/* ── 모델별 기여도·월별 표·조건 요약 ── */
function drawShare(cfg, R) {
  const W = 36, ac = R.applCost, rows = [];
  S.models.forEach((m, i) => {
    if (!(m.pat > 0)) return;
    const P = R.per[i]; let rev = 0, col = 0, sh = 0, se = 0;
    for (let k = 1; k <= W; k++) { rev += P.revenue[k]; col += P.collect[k]; sh += P.shots[k]; se += P.sessions[k]; }
    rows.push({ m, i, rev, col, contrib: rev - sh * ac - se * S.varSess, prog: C.programFee(cfg.models[i], cfg) });
  });
  const tot = rows.reduce((a, r) => a + Math.max(0, r.contrib), 0), cols = ['#0e7490', '#8b5cf6', '#ea580c', '#16a34a', '#0891b2', '#db2777'];
  $('share').innerHTML = rows.length ? '<div class="pnl-bar">' + rows.map((r, k) => '<i style="width:' + (tot ? Math.max(0, r.contrib) / tot * 100 : 0).toFixed(1) + '%;background:' + cols[k % cols.length] + '"></i>').join('') + '</div>' : '<div class="hint">입력된 환자가 없습니다.</div>';
  let h = '<tr><th>치료 모델</th><th>월 환자</th><th>1인 프로그램</th><th>시술 매출</th><th>실제 수납액</th><th>공헌이익</th><th>기여도</th></tr>';
  rows.forEach((r, k) => {
    h += '<tr><td><i class="dot" style="background:' + cols[k % cols.length] + '"></i>' + esc(nameOf(r.m)) + (unconfirmed(r.m) ? ' <span class="bd warn-b">확인 필요</span>' : '') + '</td><td>' + r.m.pat + '명</td><td>' + won(r.prog) + '</td><td>' + won(r.rev)
      + '</td><td>' + won(r.col) + '</td><td class="' + (r.contrib < 0 ? 'neg' : 'pos') + '">' + won(r.contrib) + '</td><td>' + (tot ? Math.round(Math.max(0, r.contrib) / tot * 100) : 0) + '%</td></tr>';
  });
  $('perTbl').innerHTML = rows.length ? h : '';
}
function drawMonthly(R) {
  let h = '<tr><th>경과</th><th>신규 환자</th><th>치료 건수</th><th>시술 매출</th><th>실제 수납액</th><th>공헌이익</th><th>월 현금흐름</th><th>누적 현금흐름</th></tr>';
  [1, 2, 3, 6, 12, 18, 24, 36, 48, 60].forEach(m => {
    h += '<tr><td>' + m + '개월</td><td>' + comma(R.newPat[m]) + '명</td><td>' + comma(R.sessions[m]) + '건</td><td>' + won(R.revenue[m]) + '</td><td>' + won(R.collect[m]) + '</td>'
      + '<td class="' + (R.contrib[m] < 0 ? 'neg' : '') + '">' + won(R.contrib[m]) + '</td>'
      + '<td class="' + (R.net[m] < 0 ? 'neg' : '') + '">' + won(R.net[m]) + (R.replCash[m] ? ' <small class="neg">교체</small>' : '') + '</td>'
      + '<td class="' + (R.cum[m] < 0 ? 'neg' : 'pos') + '">' + won(R.cum[m]) + '</td></tr>';
  });
  $('monTbl').innerHTML = h;
}
function drawAssump(cfg, R) {
  const row = (l, v) => '<div class="pnl-r"><span>' + l + '</span><b>' + v + '</b></div>';
  let h = '<div class="as-h">확인된 조건 <small>(제안서 기준, VAT 포함)</small></div>'
    + row('장비 공급가', comma(S.invest) + '원') + row('어플리케이터 교체비', comma(S.applPrice) + '원') + row('어플리케이터 보장 수명', comma(S.applLife) + '타')
    + row('타당 교체비 상당액', (+R.applCost.toFixed(2)) + '원');
  h += '<div class="as-h">가정값 <small>(상담 시 조정 · 확정 아님)</small></div>'
    + row('타당 수가', S.fee + '원 <small>(검토 기준 ' + D.feeRange[0] + '~' + D.feeRange[1] + '원)</small>')
    + row('결제 방식', PAY_LABEL[S.payMode] + (S.payMode === 'installment' ? ' ' + S.inst + '회' : ''))
    + row('월 인건비 · 유지관리비', won(S.labor * 1e4) + ' · ' + won(S.maint * 1e4)) + row('시술 1회당 추가 변동비', comma(S.varSess) + '원');
  h += '<div class="as-h">치료 모델 · 월 신규 환자 <small>(Aries 2 프로토콜 자료 기준)</small></div>';
  const act = S.models.map((m, i) => ({ m, i })).filter(x => x.m.pat > 0);
  h += act.length ? act.map(x => {
    const c = cfg.models[x.i], mt = metaOf(x.m);
    const ivTxt = mt ? (mt.iv.txt + (mt.iv.max != null || mt.iv.v !== x.m.iv ? ' (' + (+x.m.iv.toFixed(1)) + '일)' : '')) : x.m.iv + '일';
    return row(esc(nameOf(x.m)) + ' <small>' + (mt ? esc(mt.lvl) + ' · ' + esc(mt.hz) + '<br>' : '') + comma(c.shots) + '타 × ' + c.sess + '회 · 간격 ' + esc(ivTxt) + ' · 타당 ' + C.feeOf(c, cfg) + '원'
      + (unconfirmed(x.m) ? ' · ⚠ 확인 필요' : '') + '</small>', x.m.pat + '명');
  }).join('') : '<div class="hint">입력된 환자가 없습니다.</div>';
  h += '<div class="hint" style="margin-top:10px">프로토콜의 Level·Hz·타수·횟수는 임상 참고 기준이며 실제 적용 여부와 Level 조절은 담당 의료진이 판단합니다. 비뇨기과 프로토콜(ED·CPPS·페이로니병)은 참고자료입니다.</div>';
  $('assump').innerHTML = h;
}

/* ══════════════ 입력 ══════════════ */
const NUM_FIELDS = ['fee', 'inst', 'varSess', 'invest', 'applPrice', 'applLife', 'target'];
function readInputs() {
  S.hospital = $('hospital').value.trim();
  NUM_FIELDS.forEach(k => { S[k] = num($(k).value); });
  S.inst = clamp(Math.round(S.inst) || 1, 1, 24);
  S.labor = num($('labor').value); S.maint = num($('maint').value);
  S.solo = +$('soloSel').value || 0;
}
function writeInputs() {
  $('hospital').value = S.hospital || '';
  NUM_FIELDS.forEach(k => { $(k).value = k === 'fee' ? String(S[k]) : comma(S[k]); });
  $('labor').value = S.labor; $('maint').value = S.maint;
  renderModels(); fillSolo(); chipSync();
}
function chipSync() { $('feeChips').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === +S.fee)); }
function fillSolo() {
  $('soloSel').innerHTML = S.models.map((m, i) => '<option value="' + i + '">' + esc(nameOf(m)) + ' 만 조정</option>').join('');
  $('soloSel').value = String(clamp(S.solo, 0, S.models.length - 1));
}

function renderModels() {
  $('mTabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.v === S.tab));
  $('models').innerHTML = S.models.map((m, i) => ({ m, i })).filter(x => x.m.custom || metaOf(x.m).grp === S.tab).map(x => rowHtml(x.m, x.i)).join('');
}
function fixedBox(label, txt) { return '<div class="fld"><span>' + label + '</span><div class="ro sm">' + txt + '</div></div>'; }
function rowHtml(m, i) {
  const mt = metaOf(m);
  const badge = !mt ? '<span class="bd warn-b">직접 입력</span>' : (unconfirmed(m) ? '<span class="bd warn-b">확인 필요</span>' : '<span class="bd ok">프로토콜 자료</span>');
  const head = mt ? '<div class="mname"><b>' + esc(mt.name) + '</b> <span class="en">' + esc(mt.en) + '</span> ' + badge + '</div>'
    : '<div class="mname"><input class="m-name" maxlength="30" placeholder="모델 이름" value="' + esc(m.name) + '"> ' + badge + '</div>';
  const inp = (cls, v, hint) => '<input class="' + cls + '" inputmode="decimal" value="' + v + '">' + (hint ? '<div class="rng">' + hint + '</div>' : '');
  let adj = '', proto = '';
  if (mt) {
    const sh = mt.shots, se = mt.sess, iv = mt.iv;
    adj += sh.area ? '<div class="fld"><span>흉터 면적 <u>㎠</u></span>' + inp('m-area', m.area, '1~' + sh.cap + '㎠ (×' + sh.per + '타)') + '</div>'
      : sh.v != null ? fixedBox('1회 타수', comma(sh.v) + '타')
      : '<div class="fld"><span>1회 타수 <u>타</u></span>' + inp('m-sh', m.sh, comma(sh.min) + '~' + comma(sh.max)) + '</div>';
    adj += se.v != null ? fixedBox('치료 횟수', se.v + '회')
      : '<div class="fld"><span>치료 횟수 <u>회</u></span>' + inp('m-se', m.se, se.min + '~' + se.max + '회') + '</div>';
    adj += iv.max != null ? '<div class="fld"><span>치료 간격 <u>일</u></span>' + inp('m-iv', +m.iv.toFixed(1), iv.min + '~' + iv.max + '일 (' + iv.txt + ')') + '</div>'
      : iv.assumed ? '<div class="fld"><span>치료 간격 <u>일</u> <span class="bd warn-b">가정</span></span>' + inp('m-iv', +m.iv.toFixed(1), '자료: ' + esc(iv.txt)) + '</div>'
      : fixedBox('치료 간격', iv.txt);
    proto = '<div class="proto"><b>' + esc(mt.lvl) + '</b> · ' + esc(mt.hz) + '<br>' + esc(mt.dist) + (mt.basis ? '<br><span class="mut">근거: ' + esc(mt.basis) + '</span>' : '')
      + (mt.warn ? '<br><span class="wr">⚠ ' + esc(mt.warn) + '</span>' : '') + '</div>';
  } else {
    adj = '<div class="fld"><span>1회 타수 <u>타</u></span>' + inp('m-sh', m.sh) + '</div><div class="fld"><span>치료 횟수 <u>회</u></span>' + inp('m-se', m.se) + '</div>'
      + '<div class="fld"><span>치료 간격 <u>일</u></span>' + inp('m-iv', m.iv) + '</div>';
    proto = '<div class="proto"><span class="wr">프로토콜 자료에 없는 사용자 입력 모델입니다.</span> <button class="m-del" data-a="del">삭제</button></div>';
  }
  return '<div class="mrow' + (m.pat > 0 ? ' on' : '') + '" data-i="' + i + '"><div class="mtop">' + head
    + '<div class="step"><button data-a="dec" aria-label="줄이기">−</button><input class="m-pat" inputmode="numeric" value="' + m.pat + '"><button data-a="inc" aria-label="늘리기">+</button></div></div>'
    + '<div class="msub m-calc"></div>'
    + '<details class="mdet"><summary>프로토콜 · 조건 조정</summary><div class="mdet-in">' + proto + '<div class="g2">' + adj
    + '<label class="fld"><span>타당 수가 <u>원</u></span><input class="m-fee" inputmode="decimal" placeholder="공통 적용" value="' + (m.fee == null ? '' : m.fee) + '"></label></div></div></details></div>';
}
function ivText(m) { const mt = metaOf(m); return mt && mt.iv.max == null && !mt.iv.assumed ? mt.iv.txt : (+m.iv.toFixed(1)) + '일' + (mt && mt.iv.assumed ? '(가정)' : ''); }
function refreshModelCalc() {
  const cfg = cfgOf(S);
  document.querySelectorAll('#models .mrow').forEach(row => {
    const i = +row.dataset.i, m = S.models[i], c = cfg.models[i]; if (!m) return;
    row.querySelector('.m-calc').textContent = comma(c.shots) + '타 × ' + c.sess + '회 · 간격 ' + ivText(m) + ' · 회당 ' + comma(C.sessionFee(c, cfg)) + '원 · 프로그램 ' + comma(C.programFee(c, cfg)) + '원';
  });
  const cnt = g => S.models.filter(m => m.pat > 0 && (m.custom || metaOf(m).grp === g)).length;
  $('cntOb').textContent = cnt('ob') ? cnt('ob') + '종 선택' : ''; $('cntUro').textContent = cnt('uro') ? cnt('uro') + '종 선택' : '';
}
function addModel() {
  S.models.push({ k: 'c' + Date.now(), custom: true, name: '', sh: 1000, area: 0, se: 4, iv: D.fallbackInterval, pat: 0, fee: null });
  renderModels(); fillSolo(); render();
  const ins = document.querySelectorAll('.m-name'); if (ins.length) ins[ins.length - 1].focus();
}

function bind() {
  $('feeChips').innerHTML = [60, 70, 80].map(v => '<button type="button" data-v="' + v + '">' + v + '원</button>').join('');
  $('tgtChips').innerHTML = TARGETS.map(v => '<button type="button" data-v="' + v + '">' + v + '개월</button>').join('');
  $('feeChips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('fee').value = b.dataset.v; chipSync(); render(); });
  $('tgtChips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('target').value = b.dataset.v; render(); });
  $('payMode').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.payMode = b.dataset.v; render(); });
  $('revMode').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.revMode = b.dataset.v; render(); });
  $('soloSel').addEventListener('change', render);
  $('mTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.tab = b.dataset.v; renderModels(); render(); });

  document.querySelectorAll('#hospital, #inputs > .card > .fld input, #inputs > .card > .sub input, #inputs > .card > .g2 input, #revCard input').forEach(el => {
    el.addEventListener('input', () => { if (el.id === 'fee') chipSync(); render(); });
    if (el.hasAttribute('data-num')) {
      el.addEventListener('focus', () => setTimeout(() => el.select(), 0));
      el.addEventListener('blur', () => { if (el.id !== 'fee') el.value = comma(num(el.value)); });
    }
  });
  $('labor').addEventListener('input', render); $('maint').addEventListener('input', render);

  const M = $('models');
  M.addEventListener('input', e => {
    const row = e.target.closest('.mrow'); if (!row) return;
    const m = S.models[+row.dataset.i], mt = metaOf(m), el = e.target, c = el.classList, v = num(el.value);
    if (c.contains('m-pat')) m.pat = clamp(Math.round(v), 0, 999);
    else if (c.contains('m-name')) { m.name = el.value.slice(0, 30); fillSolo(); }
    else if (c.contains('m-area')) m.area = clamp(v, mt.shots.min, 9999);
    else if (c.contains('m-sh')) m.sh = mt ? clamp(Math.round(v), mt.shots.min, mt.shots.max) : clamp(Math.round(v), 0, 100000);
    else if (c.contains('m-se')) m.se = mt ? clamp(Math.round(v), mt.sess.min, mt.sess.max) : clamp(Math.round(v), 0, 99);
    else if (c.contains('m-iv')) m.iv = mt && mt.iv.max != null ? clamp(v, mt.iv.min, mt.iv.max) : clamp(v, 0, 365);
    else if (c.contains('m-fee')) m.fee = el.value.trim() === '' ? null : Math.max(0, v);
    row.classList.toggle('on', m.pat > 0);
    render();
  });
  M.addEventListener('change', e => {           // 입력이 끝나면 범위로 보정된 값을 화면에 되돌려 보여준다
    const row = e.target.closest('.mrow'); if (!row) return;
    const m = S.models[+row.dataset.i], c = e.target.classList;
    if (c.contains('m-pat')) e.target.value = m.pat; else if (c.contains('m-area')) e.target.value = m.area;
    else if (c.contains('m-sh')) e.target.value = m.sh; else if (c.contains('m-se')) e.target.value = m.se; else if (c.contains('m-iv')) e.target.value = +m.iv.toFixed(1);
  });
  M.addEventListener('focusin', e => { if (e.target.matches('.m-pat,.m-sh,.m-se,.m-area,.m-iv')) setTimeout(() => e.target.select(), 0); });
  M.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const row = b.closest('.mrow'), i = +row.dataset.i, m = S.models[i];
    if (b.dataset.a === 'inc') m.pat = clamp(m.pat + 1, 0, 999);
    else if (b.dataset.a === 'dec') m.pat = clamp(m.pat - 1, 0, 999);
    else if (b.dataset.a === 'del') { S.models.splice(i, 1); renderModels(); fillSolo(); render(); return; }
    row.querySelector('.m-pat').value = m.pat; row.classList.toggle('on', m.pat > 0); render();
  });
  $('jsonFile').addEventListener('change', importJson);
}

/* ══════════════ 저장 · 공유 · JSON ══════════════ */
function sanitize(o) {
  const s = freshState();
  if (!o || typeof o !== 'object') return s;
  s.hospital = String(o.hospital || '').slice(0, 60);
  const ov = (k, a, b) => { if (k in o) s[k] = clamp(num(o[k]), a, b); };
  ov('fee', 0, 1e5); ov('inst', 1, 24); ov('labor', 0, 1e5); ov('maint', 0, 1e5); ov('varSess', 0, 1e8);
  ov('invest', 0, 1e11); ov('applPrice', 0, 1e11); ov('applLife', 1, 1e9); ov('target', 1, 120);
  s.inst = Math.round(s.inst);
  s.payMode = ['prepaid', 'session', 'installment'].includes(o.payMode) ? o.payMode : s.payMode;
  s.revMode = o.revMode === 'solo' ? 'solo' : 'mix';
  const nn = (v, a, b) => (v == null || v === '' ? null : clamp(num(v), a, b));
  s.tab = o.tab === 'uro' ? 'uro' : 'ob';
  const pick = (v, def, lo, hi) => (v == null || v === '' ? def : clamp(num(v), lo, hi));
  if (Array.isArray(o.models)) {
    s.models = D.models.map(mt => {             // 프로토콜 값은 models.js 범위 안으로만 받는다(범위 밖·고정값 변조 무시)
      const b = newModelState(mt); b.pat = 0;
      const f = o.models.find(x => x && x.k === mt.k); if (!f) return b;
      b.pat = clamp(Math.round(num(f.pat)), 0, 999); b.fee = nn(f.fee, 0, 1e5);
      if (mt.shots.area) b.area = pick(f.area, mt.shots.def, mt.shots.min, 9999);
      else if (mt.shots.v == null) b.sh = Math.round(pick(f.sh, mt.shots.def, mt.shots.min, mt.shots.max));
      if (mt.sess.v == null) b.se = Math.round(pick(f.se, mt.sess.def, mt.sess.min, mt.sess.max));
      if (mt.iv.max != null) b.iv = pick(f.iv, mt.iv.v, mt.iv.min, mt.iv.max); else if (mt.iv.assumed) b.iv = pick(f.iv, mt.iv.v, 0, 365);
      return b;
    });
    o.models.filter(x => x && x.custom).slice(0, 8).forEach(x => s.models.push({
      k: 'c' + Math.random().toString(36).slice(2, 8), custom: true, name: String(x.name || '').slice(0, 30), sh: clamp(Math.round(num(x.sh)), 0, 100000), area: 0,
      se: clamp(Math.round(num(x.se)), 0, 99), iv: pick(x.iv, D.fallbackInterval, 0, 365), pat: clamp(Math.round(num(x.pat)), 0, 999), fee: nn(x.fee, 0, 1e5) }));
  }
  s.solo = clamp(Math.round(num(o.solo)), 0, s.models.length - 1);
  return s;
}
function stateToHash() {
  try { return '#d=' + btoa(unescape(encodeURIComponent(JSON.stringify(S)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); } catch (e) { return ''; }
}
function hashToState() {
  try {
    const m = /[#&]d=([^&]+)/.exec(location.hash); if (!m) return null;
    let b = m[1].replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
    return JSON.parse(decodeURIComponent(escape(atob(b))));
  } catch (e) { return null; }
}
let hashT;
function scheduleHash() { clearTimeout(hashT); hashT = setTimeout(() => { try { history.replaceState(null, '', stateToHash()); } catch (e) { } }, 400); }
function copyLink() {
  readInputs();
  const url = location.href.split('#')[0] + stateToHash();
  const done = () => toast('링크를 복사했습니다. 입력값이 그대로 담겨 있어요');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, () => prompt('링크를 복사하세요', url));
  else prompt('링크를 복사하세요', url);
}
function loadSaved() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]'); } catch (e) { return []; } }
function putSaved(a) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(a)); return true; } catch (e) { toast('이 브라우저에서는 저장할 수 없습니다'); return false; } }
function saveScenario() {
  readInputs();
  const a = loadSaved();
  a.unshift({ id: Date.now(), name: S.hospital || '이름 없음', ts: Date.now(), s: S });
  if (putSaved(a.slice(0, 30))) { toast('브라우저에 저장했습니다'); renderSaved(); }
}
function renderSaved() {
  const a = loadSaved();
  $('savedCard').hidden = !a.length;
  $('savedList').innerHTML = a.map(x => '<div class="sv-item"><div class="nm" onclick="loadScenario(' + x.id + ')"><b>' + esc(x.name) + '</b><small>'
    + new Date(x.ts).toLocaleDateString('ko-KR') + ' · 눌러서 불러오기</small></div><button aria-label="삭제" onclick="delScenario(' + x.id + ')">✕</button></div>').join('');
}
function loadScenario(id) {
  const x = loadSaved().find(v => v.id === id); if (!x) return;
  S = sanitize(x.s); writeInputs(); render(); toast('불러왔습니다'); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function delScenario(id) {
  if (!confirm('이 저장본을 삭제할까요?')) return;
  putSaved(loadSaved().filter(v => v.id !== id)); renderSaved();
}
function resetInputs() {
  const h = $('hospital').value.trim(); S = freshState(); S.hospital = h; writeInputs(); render(); toast('초기값으로 되돌렸습니다');
}
function exportJson() {
  readInputs();
  const doc = { app: 'urolink-aries2-roi', schema: D.schema, version: APP_VERSION, savedAt: new Date().toISOString(), state: S };
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'), d = new Date().toISOString().slice(0, 10);
  a.href = URL.createObjectURL(blob);
  a.download = 'aries2-roi_' + (S.hospital || '병원').replace(/[\\/:*?"<>|\s]+/g, '_') + '_' + d + '.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('JSON 파일로 내보냈습니다');
}
function importJson(e) {
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if (!f) return;
  if (f.size > 1e6) { toast('파일이 너무 큽니다'); return; }
  const r = new FileReader();
  r.onload = () => {
    try {
      const o = JSON.parse(r.result);
      if (!o || (o.app && o.app !== 'urolink-aries2-roi')) throw 0;
      S = sanitize(o.state || o); writeInputs(); render(); toast('불러왔습니다');
    } catch (err) { toast('올바른 계산 파일이 아닙니다'); }
  };
  r.readAsText(f);
}

/* ── 새 버전 알림 ── */
function checkUpdate() {
  fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(j => {
    if (j && j.version && j.version !== APP_VERSION) $('update-bar').classList.add('on');
  }).catch(() => { });
}
function applyUpdate() { location.href = location.pathname + '?r=' + Date.now() + location.hash; }

/* ══════════════ 초기화 ══════════════ */
(function init() {
  S = sanitize(hashToState());
  bind(); writeInputs(); render(); renderSaved();
  checkUpdate();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
})();
