/* ══════════════════════════════════════════════════════════════
   Aries 2 — 치료 모델·조건 "데이터" 파일. 계산(calc.js)·화면(app.js)과 분리되어 있다.

   ▣ 출처: "Aries 2프로토콜.pptx" (25장) — 이 파일의 프로토콜 수치는 전부 그 자료 그대로다.
     · 슬라이드 1 안내: Level·Hz·타수·횟수는 임상 참고 기준이며, 적용 여부·Level 은 의료진이 판단한다.
     · 비뇨기과(ED·CPPS·페이로니병) 프로토콜은 참고자료로 함께 제공된 것이다.
   ▣ 표기 규칙
     v         고정값(자료에 한 값만 있음)  → 화면에서 못 고친다
     min/max   자료에 범위로 적힌 값        → 범위 안에서만 고를 수 있다(def = 시작값, 하한 기준)
     assumed   자료에 없어 임시로 둔 값     → 화면에 '미확인 가정'으로 표시
     warn      자료에 없어 임시로 넣은 값 등 확인이 필요한 사항 → 경고로 표시 (자료에 적힌 값과 그 근거 문구는 경고 대상이 아님)
   ⚠ 자료에 없는 수치를 임의로 만들거나 고치지 말 것. 자료가 바뀌면 이 파일만 고친다.
   금액은 전부 원, VAT 포함 기준(장비·교체비). 수가·수납액은 병원 수납 금액 기준.
   ══════════════════════════════════════════════════════════════ */
const ARIES2 = {
  schema: 2,

  /* 확인된 공급 조건 (VAT 포함) */
  conditions: {
    invest: 88000000,        // 장비 공급가
    applPrice: 15000000,     // 어플리케이터 교체비
    applLife: 2000000,       // 어플리케이터 보장 수명(타)
  },                         // 타당 교체비 상당액 = 15,000,000 ÷ 2,000,000 = 7.5원 (calc.js 에서 계산)

  feeRange: [60, 80],        // 타당 수가 "검토 기준" — 확정 수가 아님
  fallbackInterval: 7,       // 자료에 간격이 없는 모델·직접 추가 모델의 임시 간격(일, 미확인 가정)

  groups: { ob: '산부인과', uro: '비뇨기과 (참고)' },

  /* shots: {v} 고정 | {min,max,def} 범위 | {area:true, per, def, min, cap} 면적×per
     sess : {v} | {min,max,def}
     iv   : 치료 간격(일). {v, txt} | {v, txt, assumed:true}
            주 3회 = 7/3일 */
  models: [
    /* ───────── 산부인과 ───────── */
    { k: 'skin', grp: 'ob', name: '피부·피하조직 섬유화', en: 'Skin Fibrosis', lvl: 'Level 5-7 (시작 5 → 상한 7)', hz: '3 Hz',
      shots: { v: 1500 }, sess: { v: 6 }, iv: { v: 7, max: 14, min: 7, txt: '1~2주' },
      dist: '확인된 병변 부위 1회 총 1,500 shots · 6회 기본 치료 계획, 3~4회차에 초음파 두께·경도·조직 이동성·이상반응을 확인해 잔여 치료 지속 여부 판단, 6회 후 재평가(필요 시 연장)',
      basis: '타사 연구(Ko & Cho 2024) 참고 · Aries 2에서 검증된 값이 아닌 내부 검토 값' },
    { k: 'nod', grp: 'ob', name: '결절성 섬유화·유착', en: 'Nodular Fibrosis', lvl: 'Level 5-7 (시작 5 → 상한 7)', hz: '3 Hz',
      shots: { v: 1500 }, sess: { v: 6 }, iv: { v: 7, max: 14, min: 7, txt: '1~2주' },
      dist: '결절 + 인접 섬유화 영역 1회 총 1,500 shots',
      basis: '타사 연구(Ko & Cho 2024) 참고 · Aries 2에서 검증된 값이 아닌 내부 검토 값' },
    { k: 'scar', grp: 'ob', name: '비후성 흉터', en: 'Hypertrophic Scar', lvl: 'Level 4-6 (얇은·민감 부위 3-4)', hz: '4 Hz',
      shots: { area: true, per: 100, def: 15, min: 1, cap: 20 }, sess: { v: 4 }, iv: { v: 7, txt: '주 1회' },
      dist: '조사 면적(㎠) × 100 shots/회 (10㎠=1,000 · 15㎠=1,500 · 20㎠=2,000, 20㎠가 기본 적용 면적 상한)',
      basis: '타사 연구(Joo 2020, 화상 후 손 비후성 흉터) 참고 · Aries 2 검증값 아님, Level 범위는 내부 설정',
      warn: '흉터 면적은 병원별로 달라 입력값입니다(기본 15㎠는 예시). 20㎠ 초과 시 가장 비후된 10~20㎠ 구역만 4회 치료 후 재평가합니다.' },
    { k: 'lymphUp', grp: 'ob', name: '림프부종 섬유화 (상지)', en: 'Lymphedema · Upper limb', lvl: 'Level 5', hz: '4 Hz',
      shots: { v: 2500 }, sess: { v: 9 }, iv: { v: 7 / 3, txt: '주 3회' },
      dist: '섬유화 최심부 전완 1,000 + 팔꿈치·상완·전완·손 림프절 부위 1,500 = 2,500 shots',
      basis: 'AR2 임상연구(Lee 2022, 2기 9회) · 복합림프부종치료(CDT) 병행 결과로 충격파 단독 효과 아님' },
    { k: 'lymphLow', grp: 'ob', name: '림프부종 섬유화 (하지)', en: 'Lymphedema · Lower limb', lvl: 'Level 5', hz: '4 Hz',
      shots: { v: 2500 }, sess: { v: 9 }, iv: { v: 7 / 3, txt: '주 3회' },
      dist: '일측 하지: 섬유화 최심부 1,000 + 그 외 표재성 경화 조직 1,500 = 2,500 shots',
      basis: '상지 AR2 연구(Lee 2022) 값을 하지에 적용한 외삽 · CDT 병행' },
    { k: 'cell', grp: 'ob', name: '셀룰라이트 개선', en: 'Cellulite', lvl: 'Level 8-10 (시작 8 → 상한 10)', hz: '4 Hz',
      shots: { v: 2000 }, sess: { v: 6 }, iv: { v: 7, max: 14, min: 7, txt: '1~2주' },
      dist: '양쪽 허벅지 각 1,000 = 2,000 shots',
      basis: '타사 연구(Knobloch 2013) 참고 · Aries 2에서 검증된 값이 아닌 내부 검토 값 · 지방 분해 목적 아님' },
    { k: 'vulvo', grp: 'ob', name: '외음부통', en: 'Vulvodynia', lvl: 'Level 4-5', hz: '4 Hz',
      shots: { v: 3000 }, sess: { v: 4 }, iv: { v: 7, txt: '주 1회' },
      dist: 'Vulva·perineum 6개 영역 각 500 = 3,000 shots', basis: '' },
    { k: 'dyspa', grp: 'ob', name: '성교통', en: 'Dyspareunia', lvl: 'Level 4-5', hz: '4 Hz',
      shots: { v: 4000 }, sess: { v: 4 }, iv: { v: 7, txt: '주 1회' },
      dist: 'Vulva·perineum·posterior vestibular 8개 영역 각 500 = 4,000 shots', basis: '' },
    { k: 'cppsF', grp: 'ob', name: 'CPPS (만성골반통증증후군)', en: 'CPPS · 산부인과', lvl: 'Level 4-5', hz: '4 Hz',
      shots: { v: 2000 }, sess: { v: 4 }, iv: { v: 7, txt: '주 1회' },
      dist: 'Vulva·perineum 4개 영역 각 500 = 2,000 shots (회음부 중심)',
      basis: '반응이 제한적일 때 "주 1회, 총 4-6회 기준으로 충분히 진행했는지" 확인하도록 되어 있음' },
    { k: 'sui', grp: 'ob', name: '복압성 요실금 (SUI)', en: 'SUI', lvl: 'Level 5 (Standard L5)', hz: '3 Hz',
      shots: { v: 3000 }, sess: { v: 8 }, iv: { v: 7, txt: '주 1회' },
      dist: '좌·우 소음순 중부 요도 대응 부위 각 1,500 = 3,000 shots',
      basis: '원 연구는 타사 집중형(EFD 0.25 mJ/mm², 3Hz, 3,000타) · Aries 2 Level 5는 최대 EFD 0.062 mJ/mm²' },
    { k: 'oab', grp: 'ob', name: '과민성방광 (OAB)', en: 'OAB', lvl: 'Level 6 (Standard L6)', hz: '3 Hz',
      shots: { v: 3000 }, sess: { v: 8 }, iv: { v: 7, txt: '주 1회' },
      dist: '방광 돔 · 좌측 · 우측 방광벽 각 1,000 = 3,000 shots',
      basis: 'Level은 내부 검토값, 타수·빈도·횟수는 관련 임상연구 참고 조건' },

    /* ───────── 비뇨기과 (참고자료) ───────── */
    { k: 'edMild', grp: 'uro', name: 'ED — Mild', en: 'Erectile Dysfunction', lvl: 'Level 7 (EFD 0.1 mJ/mm²)', hz: '5 Hz',
      shots: { v: 5000 }, sess: { v: 6 }, iv: { v: 7, txt: '주 1회' },
      dist: 'Shaft 좌/우 각 1,000 · Root 좌/우 각 500 · Crura 좌/우 각 1,000 = 5,000 shots (약 15분, 총 20~30분)',
      basis: '6회(Mild) / 12회(Moderate·Severe) · 주 1회 시행(PPT: 간격 8일 초과 시 연속성 저하) · 효과 확인까지 1~3개월 필요할 수 있음' },
    { k: 'edSev', grp: 'uro', name: 'ED — Moderate·Severe', en: 'Erectile Dysfunction', lvl: 'Level 7 (EFD 0.1 mJ/mm²)', hz: '5 Hz',
      shots: { v: 5000 }, sess: { v: 12 }, iv: { v: 7, txt: '주 1회' },
      dist: 'Shaft 좌/우 각 1,000 · Root 좌/우 각 500 · Crura 좌/우 각 1,000 = 5,000 shots',
      basis: 'Moderate/Severe에 6회만 시행하고 판단하지 않았는지 확인하도록 되어 있음 · 주 1회 시행(PPT: 간격 8일 초과 시 연속성 저하)' },
    { k: 'cppsM', grp: 'uro', name: 'CPPS — Perineal (남성)', en: 'CPPS · Perineal protocol', lvl: 'Level 7 (EFD 0.096 mJ/mm²)', hz: '5 Hz',
      shots: { v: 5000 }, sess: { v: 6 }, iv: { v: 7, txt: '주 1회' },
      dist: 'Perineum 중심 총 5,000 shots (고정 + 천천한 circular motion)',
      basis: '반응이 제한적일 때 "주 1회, 총 4-6회 기준으로 충분히 진행했는지" 확인하도록 되어 있음' },
    { k: 'cppsTP', grp: 'uro', name: 'CPPS — Trigger point (남성)', en: 'CPPS · Trigger point protocol', lvl: 'Level 4-9', hz: '5 Hz',
      shots: { v: 5000 }, sess: { v: 6 }, iv: { v: 7, txt: '주 1회' },
      dist: 'Trigger point당 500-1,000 shots, 여러 지점·external pelvic muscle 포함 시 총 5,000 shots 안에서 분배',
      basis: '주 1회 시행(자료에 간격 표기가 없어 같은 CPPS 프로토콜 Perineal과 동일하게 적용)' },
    { k: 'peyA', grp: 'uro', name: '페이로니병 — Acute', en: "Peyronie's · Acute", lvl: 'Level 7', hz: '5 Hz',
      shots: { min: 1000, max: 2000, def: 1000 }, sess: { v: 6 }, iv: { v: 7, txt: '주 1회' },
      dist: 'Acute plaque 1,000-2,000 shots · ED 동반 시 ED protocol(5,000 shots) 병행 고려 → ED 모델을 따로 추가',
      basis: 'Plaque 제거·완치를 보장하지 않으며 phase에 따라 protocol 분리 필요' },
    { k: 'peyS', grp: 'uro', name: '페이로니병 — Stable', en: "Peyronie's · Stable", lvl: 'Level 9 (9-11은 stable plaque에만 신중 적용)', hz: '5 Hz',
      shots: { min: 3000, max: 5000, def: 3000 }, sess: { min: 8, max: 12, def: 8 }, iv: { v: 7, txt: '주 1회' },
      dist: 'Stable plaque 3,000-5,000 shots · ED 동반 시 ED protocol(5,000 shots) 병행 고려 → ED 모델을 따로 추가',
      basis: 'Plaque 제거·완치를 보장하지 않으며 phase에 따라 protocol 분리 필요' },
  ],
};
