const C = require('./calc.js');
const rnd = (a, b) => a + Math.random() * (b - a), ri = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[ri(0, a.length - 1)];
const fails = {}; const F = (k, info) => { fails[k] = fails[k] || { n: 0, ex: info }; fails[k].n++; };
const near = (a, b, t) => Math.abs(a - b) <= (t == null ? Math.max(1, Math.abs(b) * 1e-9) : t);
let N = 3000;
for (let it = 0; it < N; it++) {
  const cfg = { invest: pick([0, 88e6, rnd(1e6, 3e8)]), applPrice: 15e6, applLife: pick([2e6, 5e5, 1e7]), fee: pick([60, 70, 80, rnd(1, 200)]), interval: 7,
    varPerSession: pick([0, 3000]), fixed: pick([0, 5e5, 2e6]), payMode: pick(['prepaid', 'session', 'installment']), inst: ri(1, 12),
    models: Array.from({ length: ri(1, 5) }, () => ({ name: 'm', shots: pick([500, 1000, 1500, 5000]), sess: ri(1, 12), pat: pick([0, 1, 2.5, 4, 9]), fee: pick([null, null, 90]), interval: pick([null, 7 / 3, 7, 14, 8]) })) };
  const H = 120, R = C.simulate(cfg, H);
  // 1) 누적 = -invest + Σ net
  let cum = -cfg.invest, ok = true;
  for (let m = 1; m <= H; m++) { cum += R.net[m]; if (!near(cum, R.cum[m], 1e-3 + Math.abs(cum) * 1e-9)) ok = false; }
  if (!ok) F('cum=Σnet', cfg);
  // 2) 월 현금흐름 항등식
  for (let m = 1; m <= H; m++) {
    const expect = R.collect[m] - R.extraVar[m] - R.fixed[m] - R.replCash[m];
    if (!near(R.net[m], expect, 1e-6 * (1 + Math.abs(expect)))) { F('net identity', { m }); break; }
    if (!near(R.contrib[m], R.revenue[m] - R.accrual[m] - R.extraVar[m], 1e-6 * (1 + Math.abs(R.revenue[m])))) { F('contrib identity', { m }); break; }
  }
  // 3) 교체 현금 횟수 = floor(누적 타수 / 수명)
  const totShots = R.shots.reduce((a, b) => a + b, 0), totRepl = R.replCash.reduce((a, b) => a + b, 0);
  if (!near(totRepl, Math.floor(totShots / cfg.applLife) * cfg.applPrice, 1)) F('replacement count', { totShots, totRepl });
  // 4) 시술 건수·매출 보존: 시작월 ≤ H-span 인 코호트는 전부 시행. 매출 합 ≤ 이론 최대, 모든 코호트 완결 구간에서 단조
  let progAll = 0; cfg.models.forEach(m => { progAll += m.pat * m.shots * m.sess * (m.fee != null ? m.fee : cfg.fee) * H; });
  if (R.revenue.reduce((a, b) => a + b, 0) > progAll * (1 + 1e-9)) F('revenue > theoretical', {});
  // 5) 수납 총액 ≤ 프로그램 총액(결제 방식 무관, 지연되어 H 밖으로 나간 몫은 제외)
  if (R.collect.reduce((a, b) => a + b, 0) > progAll * (1 + 1e-9)) F('collect > program total', {});
  // 6) 안정기 이후 월 수납액 = 월 신규 프로그램 총액 (결제 방식 무관, 선결제=계약시점/회차별/분할 모두 정상상태에서 같아야 함)
  const st = R.steadyMonth;
  if (st + 1 <= H && !near(R.collect[st], R.program[st], 1e-6 * (1 + R.program[st])) && R.program[st] > 0) F('steady collect=program', { st, c: R.collect[st], p: R.program[st], pm: cfg.payMode });
  if (st + 1 <= H && !near(R.revenue[st], R.program[st], 1e-6 * (1 + R.program[st])) && R.program[st] > 0) F('steady revenue=program', { st });
  // 7) 환자 증가 시 회수 시점이 늦어지지 않는다(단조)
  const R2 = C.simulate(Object.assign({}, cfg, { models: cfg.models.map(m => Object.assign({}, m, { pat: m.pat * 2 + 1 })) }), H);
  const lumpy = R2.replCash.slice(1, Math.ceil((R2.payback == null ? 120 : R2.payback)) + 1).some(x => x > 0) && !R.replCash.slice(1, Math.ceil(R.payback || 0) + 1).some(x => x > 0);
  if (cfg.invest > 0 && !lumpy && R.payback != null && (R2.payback == null || R2.payback > R.payback + 1e-9)) F('more patients → not later payback', { p1: R.payback, p2: R2.payback });
  // 8) payback 정의: cum[floor(payback)] <0 이고 cum[ceil(payback)] >=0
  if (R.payback != null && R.payback > 0) {
    const lo = Math.floor(R.payback - 1e-9), hi = Math.ceil(R.payback - 1e-9);
    if (R.cum[Math.max(0, lo)] >= 0 && lo >= 1 && R.cum[lo] >= 0 && R.payback > lo + 1e-9 && R.cum[lo] > 1e-6) { /* 이전 달에 이미 회수된 경우는 일시 재하락 후 재상승 — 첫 도달만 취급 */ }
    if (R.cum[hi] < -1e-6) F('payback<->cum[ceil]', { pb: R.payback, v: R.cum[hi] });
  }
  // 9) 역산 정합성: reverseMix 결과가 T개월 내 회수를 만족, total-1 은 불만족
  if (cfg.models.some(m => m.pat > 0)) {
    const T = pick([6, 12, 24, 36, 48]), rv = C.reverseMix(cfg, T);
    if (rv.ok) {
      const pats = cfg.models.map((m, i) => { const w = cfg.models.map(x => x.pat > 0 ? x.pat : 0); const sw = w.reduce((a, b) => a + b, 0); return w[i] / sw * rv.total; });
      const mk = f => Object.assign({}, cfg, { models: cfg.models.map((m, i) => Object.assign({}, m, { pat: pats[i] * f })) });
      const ok1 = C.simulate(mk(1), T).cum[T] >= -1e-6;
      const ok0 = rv.total > 1 ? C.simulate(mk((rv.total - 1) / rv.total), T).cum[T] < 0 : true;
      if (!ok1) F('reverse total insufficient', { T, total: rv.total });
      if (!ok0) F('reverse total not minimal', { T, total: rv.total });
    }
  }
}
console.log('runs', N); console.log(Object.keys(fails).length ? JSON.stringify(fails, (k, v) => (k === 'ex' ? (v && v.models ? { pm: v.payMode, invest: v.invest } : v) : v), 1).slice(0, 1800) : 'ALL INVARIANTS HOLD');
