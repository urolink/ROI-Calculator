/* ══════════════════════════════════════════════════════════════
   Aries 2 ROI — 계산 엔진. DOM 을 전혀 쓰지 않는 순수 함수(브라우저·Node 모두 동작).

   ▣ 시간 모델
     · 매월 초에 모델별 신규 환자 n명이 시작한다(코호트). 월 번호 1..H.
     · 환자의 k번째(0부터) 치료는 시작 후 k×간격(일) 시점 → 월 = 시작월 + floor(k×간격/30.4375)
   ▣ 용어 (섞지 말 것)
     프로그램 계약 총액 = 신규 환자 × 회당 수가 × 횟수              (계약 기준, 받은 돈이 아님)
     시술 매출         = 그 달에 실제 시행한 치료 건수 × 회당 수가   (치료 시점 기준)
     실제 수납액       = 결제 방식에 따라 그 달에 들어온 현금        (선결제/회차별/분할)
     교체비 상당액     = 시행 타수 × (교체가 ÷ 보장수명)             (손익용 적립, 현금 아님)
     교체 현금지출     = 누적 타수가 보장수명을 넘는 달의 교체가 지출 (실제 현금)
     공헌이익         = 시술 매출 − 변동비(교체비 상당액 + 회당 추가 변동비)
     운영 후 공헌이익  = 공헌이익 − 고정 운영비
     월 현금흐름       = 실제 수납액 − 회당 추가 변동비 − 고정 운영비 − 교체 현금지출
     회수기간         = 누적 현금흐름(= −공급가 + Σ월 현금흐름)이 0 이상이 되는 시점
   ▣ 금액은 전부 원. 장비·교체비는 VAT 포함 입력값 그대로 쓴다(수가와 VAT 를 섞어 계산하지 않음).
   ══════════════════════════════════════════════════════════════ */
const AriesCalc = (function () {
  const DAYS = 30.4375;                                   // 평균 월 일수

  const feeOf = (m, cfg) => (m.fee != null ? m.fee : cfg.fee);
  const stepOf = (m, cfg) => (m.interval != null ? m.interval : cfg.interval);
  /** 회당 수가 = 1회 타수 × 타당 수가 */
  const sessionFee = (m, cfg) => m.shots * feeOf(m, cfg);
  const programFee = (m, cfg) => sessionFee(m, cfg) * m.sess;
  const applCostPerShot = cfg => (cfg.applLife > 0 ? cfg.applPrice / cfg.applLife : 0);

  /** 환자 1명이 끝날 때까지 걸리는 월 오프셋(마지막 치료/마지막 납부 월) */
  function spanMonths(m, cfg) {
    const t = Math.floor(Math.max(0, m.sess - 1) * stepOf(m, cfg) / DAYS);
    return cfg.payMode === 'installment' ? Math.max(t, Math.max(1, cfg.inst) - 1) : t;
  }

  /** 월별 시뮬레이션. 반환 배열은 모두 index 1..H (0번은 사용 안 함, cum 만 0번=초기 투자) */
  function simulate(cfg, H) {
    H = H || 120;
    const Z = () => new Array(H + 1).fill(0);
    const R = { H, newPat: Z(), sessions: Z(), shots: Z(), revenue: Z(), collect: Z(), accrual: Z(), extraVar: Z(),
      fixed: Z(), contrib: Z(), afterFixed: Z(), replCash: Z(), net: Z(), cum: Z(), program: Z(), per: [] };
    const ac = applCostPerShot(cfg), N = Math.max(1, Math.round(cfg.inst || 1));

    cfg.models.forEach(m => {
      const P = { revenue: Z(), collect: Z(), sessions: Z(), shots: Z(), contrib: Z() };
      R.per.push(P);
      if (!(m.pat > 0) || !(m.shots > 0) || !(m.sess > 0)) return;
      const n = m.pat, sf = sessionFee(m, cfg), prog = sf * m.sess, step = stepOf(m, cfg);
      for (let s = 1; s <= H; s++) {
        R.newPat[s] += n; R.program[s] += n * prog;
        for (let k = 0; k < m.sess; k++) {
          const mm = s + Math.floor(k * step / DAYS);
          if (mm > H) break;
          R.sessions[mm] += n; R.shots[mm] += n * m.shots; R.revenue[mm] += n * sf;
          P.sessions[mm] += n; P.shots[mm] += n * m.shots; P.revenue[mm] += n * sf;
          if (cfg.payMode === 'session') { R.collect[mm] += n * sf; P.collect[mm] += n * sf; }
        }
        if (cfg.payMode === 'prepaid') { R.collect[s] += n * prog; P.collect[s] += n * prog; }
        else if (cfg.payMode === 'installment') {
          for (let j = 0; j < N && s + j <= H; j++) { R.collect[s + j] += n * prog / N; P.collect[s + j] += n * prog / N; }
        }
      }
    });

    let cumShots = 0, cum = -cfg.invest, payback = null;
    R.cum[0] = cum;
    for (let m = 1; m <= H; m++) {
      R.accrual[m] = R.shots[m] * ac;
      R.extraVar[m] = R.sessions[m] * cfg.varPerSession;
      R.fixed[m] = cfg.fixed;
      R.contrib[m] = R.revenue[m] - R.accrual[m] - R.extraVar[m];
      R.afterFixed[m] = R.contrib[m] - R.fixed[m];
      const prev = cumShots; cumShots += R.shots[m];
      const repl = cfg.applLife > 0 ? Math.floor(cumShots / cfg.applLife) - Math.floor(prev / cfg.applLife) : 0;
      R.replCash[m] = repl * cfg.applPrice;
      R.net[m] = R.collect[m] - R.extraVar[m] - R.fixed[m] - R.replCash[m];
      const before = cum; cum += R.net[m]; R.cum[m] = cum;
      if (payback == null && cum >= 0) payback = R.net[m] > 0 ? (m - 1) + (0 - before) / R.net[m] : m;
    }
    R.cfgInvest = cfg.invest;
    R.payback = payback;
    R.applCost = ac;
    R.steadyMonth = Math.min(H, 1 + Math.max(0, ...cfg.models.filter(m => m.pat > 0).map(m => spanMonths(m, cfg))));
    R.firstRepl = (function () { for (let m = 1; m <= H; m++) if (R.replCash[m] > 0) return m; return null; })();
    return R;
  }

  const clone = (cfg, pats) => Object.assign({}, cfg, { models: cfg.models.map((m, i) => Object.assign({}, m, { pat: pats[i] })) });
  const cumAt = (cfg, pats, T) => simulate(clone(cfg, pats), T).cum[T];

  /** 이분 탐색 결과(hi)를 정수로 바로잡는다. 교체비(덩어리 지출)가 환자 수에 따라 달라져 f 가 단조롭지 않을 수 있으므로,
   *  hi 근처에서 "실제로 조건을 만족하는 가장 작은 정수"를 찾는다. 못 찾으면 null */
  function fixInt(f, hi, HI) {
    let c = Math.max(1, Math.ceil(hi - 1e-6)), g = 0;
    while (c <= HI && f(c) < 0 && g++ < 300) c++;
    if (c > HI || f(c) < 0) return null;
    while (c > 1 && f(c - 1) >= 0) c--;
    return c;
  }
  /** 현재 환자 비율 유지: 총 신규 환자 수를 이분 탐색. 환자 미입력이면 확인된 모델 균등 */
  function reverseMix(cfg, T) {
    let w = cfg.models.map(m => (m.pat > 0 ? m.pat : 0));
    if (!w.some(x => x > 0)) w = cfg.models.map(m => (m.ok ? 1 : 0));
    if (!w.some(x => x > 0)) w = cfg.models.map(() => 1);
    const sw = w.reduce((a, b) => a + b, 0), wn = w.map(x => x / sw);
    const f = s => cumAt(cfg, wn.map(x => x * s), T);
    const HI = 2000;
    if (f(HI) < 0) return { ok: false, T };
    let lo = 0, hi = HI;
    for (let i = 0; i < 45; i++) { const mid = (lo + hi) / 2; if (f(mid) >= 0) hi = mid; else lo = mid; }
    const total = fixInt(f, hi, HI);
    if (total == null) return { ok: false, T };
    return { ok: true, T, total, exact: hi, split: cfg.models.map((m, i) => ({ name: m.name, n: wn[i] * total, w: wn[i] })).filter(x => x.w > 0) };
  }
  /** 특정 모델만 조정: 나머지 모델 환자는 현재 값 고정, idx 모델의 월 환자 수를 탐색 */
  function reverseSolo(cfg, T, idx) {
    const base = cfg.models.map(m => m.pat || 0);
    const f = x => { const p = base.slice(); p[idx] = x; return cumAt(cfg, p, T); };
    const HI = 2000;
    if (f(HI) < 0) return { ok: false, T };
    let lo = 0, hi = HI;
    for (let i = 0; i < 45; i++) { const mid = (lo + hi) / 2; if (f(mid) >= 0) hi = mid; else lo = mid; }
    const n = f(0) >= 0 ? 0 : fixInt(f, hi, HI);
    if (n == null) return { ok: false, T };
    return { ok: true, T, n };
  }

  return { DAYS, feeOf, stepOf, sessionFee, programFee, applCostPerShot, spanMonths, simulate, reverseMix, reverseSolo };
})();
if (typeof module !== 'undefined') module.exports = AriesCalc;
