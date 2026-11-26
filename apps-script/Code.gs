/**
 * 통합과학 · 과학탐구실험 세특 활동 선택 — Google Apps Script
 *
 * 이 파일은 구글 스프레드시트의 [확장 프로그램 → Apps Script]에 붙여 넣어 사용합니다.
 *  1) 아래 CONFIG 를 학교 상황에 맞게 수정
 *  2) 함수 목록에서 setupSheets 실행 → 1-1 ~ 1-10 탭, 현황, 제출기록 탭 생성
 *  3) [배포 → 새 배포 → 웹 앱] (실행: 나 / 액세스: 모든 사용자) → 웹 앱 URL 을 config.js 에 입력
 *
 * 자세한 설명은 저장소의 README.md 를 참고하세요.
 */

// ============================================================
// 1. 설정 (여기만 수정하면 됩니다)
// ============================================================
const CONFIG = {
  GRADE: 1,                 // 학년 (학번 첫 자리)
  CLASS_COUNT: 10,          // 반 수 → 1-1 ~ 1-10 탭
  STUDENTS_PER_CLASS: 30,   // 반별 최대 번호 (탭마다 이만큼 행이 만들어짐)
  REQUIRE_ROSTER: true,     // true: 교사가 입력한 명단(이름)과 일치해야 제출 가능
  OPEN: true,               // false 로 바꾸면 학생 제출 마감
  BYTE_LIMIT: 1500,         // 과목별 세특 바이트 한도 (나이스 기준)
  TEACHERS: ['황율예', '이수영', '유자현', '임형택'],  // 협업 교사 (담당 교사 드롭다운)
  PROGRESS: ['미착수', '작성중', '검토요청', '수정필요', '완료'],

  SUBJECTS: [
    {
      key: 'is',
      name: '통합과학',
      min: 1,
      max: 4,
      // 통합과학: 활동마다 기록 담당 교사(teacher)
      activities: [
        { name: '수평 방향으로 던진 물체의 운동 분석', teacher: '황율예', desc: '' },   // desc: 학생 화면에 보이는 한 줄 설명(선택)
        { name: '화학 결합의 종류에 따른 물질의 성질 탐구', teacher: '이수영', desc: '' },
        { name: '일상생활 속 효소가 활용되는 사례 탐색', teacher: '유자현', desc: '' },
        { name: '탄소 순환을 활용한 지구 시스템의 상호작용의 탐구', teacher: '임형택', desc: '' },
        { name: '시뮬레이션을 활용한 판구조론 탐구', teacher: '임형택', desc: '' },
        { name: '전자기 유도 현상 탐구', teacher: '황율예', desc: '' },
        { name: '산화 환원 반응 실험 탐구', teacher: '이수영', desc: '' },
        { name: '생물의 진화 및 생물다양성 변화 과정 탐구', teacher: '유자현', desc: '' },
        { name: '통합과학 포트폴리오 활동(D)', teacher: '임형택', desc: '' },
        { name: '대멸종 판정에 대한 근거 기반 토론', teacher: '임형택', desc: '' },
      ],
    },
    {
      key: 'se',
      name: '과학탐구실험',
      min: 1,
      max: 3,
      // 과학탐구실험: 반별 담당 교사 (해당 반의 모든 활동 기록 + 세특 담당)
      classTeachers: {
        1: '이수영', 2: '이수영', 3: '유자현', 4: '유자현', 5: '이수영',
        6: '임형택', 7: '임형택', 8: '임형택', 9: '이수영', 10: '유자현',
      },
      activities: [
        { name: '자유 낙하하는 물체의 운동 분석', desc: '' },   // desc: 학생 화면에 보이는 한 줄 설명(선택)
        { name: '멘델레예프의 주기율표 만들기', desc: '' },
        { name: '가설-연역적 탐구 설계하기', desc: '' },
        { name: '과학 기사 쓰기', desc: '' },
        { name: '산·염기 중화적정을 이용한 음료들의 산도 비교 탐구', desc: '' },
        { name: '대규모 언어 모델을 활용한 과학연구 데이터 처리 및 시각화를 위한 웹페이지 개발', desc: '' },
      ],
    },
  ],
};

// ============================================================
// 2. 시트 레이아웃 (수정 불필요)
// ============================================================
const HEADER_ROWS = 4;                 // 1: 제목, 2: 과목, 3: 활동명, 4: 세부 항목
const DATA_START = HEADER_ROWS + 1;    // 학생 데이터 시작 행
const LOG_SHEET = '제출기록';
const SUMMARY_SHEET = '현황';

const COL = { NO: 1, ID: 2, NAME: 3, CAREER: 4, SUBMITTED: 5 };
const FIXED_COLS = 5;

const COLORS = {
  title: '#1f3a5f',
  subject: ['#2e7d32', '#6a1b9a'],
  subjectLight: ['#e8f5e9', '#f3e5f5'],
  header: '#eceff1',
  inactive: '#d9d9d9',
  inactiveFont: '#9e9e9e',
  active: '#fff8e1',
  checked: '#c8e6c9',
  formula: '#f5f5f5',
  over: '#ffcdd2',
};

/** 과목별 열 위치 계산 */
function getLayout() {
  let col = FIXED_COLS + 1;
  const subjects = CONFIG.SUBJECTS.map(function (s) {
    const start = col;
    const acts = s.activities.map(function (a, i) {
      return { sel: start + i * 2, memo: start + i * 2 + 1 };
    });
    col = start + s.activities.length * 2;
    const block = {
      start: start,
      acts: acts,
      count: col,
      draft: col + 1,
      draftBytes: col + 2,
      final: col + 3,
      len: col + 4,
      bytes: col + 5,
      status: col + 6,
      teacher: col + 7,
      progress: col + 8,
    };
    col += 9;
    block.end = col - 1;
    return block;
  });
  return { subjects: subjects, note: col, lastCol: col };
}

/** 해당 반·활동의 기록 담당 교사 */
function activityTeacher(s, i, classNo) {
  if (s.classTeachers && s.classTeachers[classNo]) return s.classTeachers[classNo];
  return s.activities[i].teacher || '';
}

function className(n) {
  return CONFIG.GRADE + '-' + n;
}

function colLetter(c) {
  let s = '';
  while (c > 0) {
    const m = (c - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    c = Math.floor((c - 1) / 26);
  }
  return s;
}

/** 나이스 기준 바이트 수식: 한글 등 비ASCII 3바이트, 영문·숫자·공백 1바이트, 줄바꿈(Enter) 2바이트 */
function bytesFormula(ref) {
  const t = '(' + ref + '&"")';
  return 'LEN(' + t + ')+2*LEN(REGEXREPLACE(' + t + ',"[\\x00-\\x7F]",""))' +
    '+(LEN(' + t + ')-LEN(SUBSTITUTE(' + t + ',CHAR(10),"")))';
}

// ============================================================
// 3. 메뉴 & 초기 설정
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('세특 도구')
    .addItem('시트 초기 설정 (없는 탭만 생성)', 'setupSheets')
    .addItem('현황 탭 다시 만들기', 'rebuildSummary')
    .addToUi();
}

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const created = [];
  const skipped = [];

  for (let n = 1; n <= CONFIG.CLASS_COUNT; n++) {
    const name = className(n);
    if (ss.getSheetByName(name)) {
      skipped.push(name);
      continue;
    }
    const sh = ss.insertSheet(name, ss.getSheets().length);
    buildClassSheet(sh, n);
    created.push(name);
  }

  if (!ss.getSheetByName(LOG_SHEET)) {
    buildLogSheet(ss.insertSheet(LOG_SHEET, ss.getSheets().length));
    created.push(LOG_SHEET);
  }
  rebuildSummary();

  // 기본 빈 시트 정리
  ['시트1', 'Sheet1'].forEach(function (nm) {
    const sh = ss.getSheetByName(nm);
    if (sh && ss.getSheets().length > 1 && sh.getLastRow() === 0) ss.deleteSheet(sh);
  });

  const msg = '생성: ' + (created.join(', ') || '없음') +
    (skipped.length ? '\n이미 있어 건너뜀: ' + skipped.join(', ') +
      '\n(다시 만들려면 해당 탭을 삭제 후 재실행)' : '');
  try { SpreadsheetApp.getUi().alert('설정 완료\n\n' + msg); } catch (e) { Logger.log(msg); }
}

function buildClassSheet(sh, classNo) {
  const L = getLayout();
  const lastRow = DATA_START + CONFIG.STUDENTS_PER_CLASS - 1;
  const nRows = CONFIG.STUDENTS_PER_CLASS;

  // 시트 크기 맞추기
  if (sh.getMaxColumns() < L.lastCol) sh.insertColumnsAfter(sh.getMaxColumns(), L.lastCol - sh.getMaxColumns());
  if (sh.getMaxRows() < lastRow) sh.insertRowsAfter(sh.getMaxRows(), lastRow - sh.getMaxRows());

  // ---- 1행: 제목
  sh.getRange(1, 1, 1, L.lastCol).merge()
    .setValue(className(classNo) + '  통합과학 · 과학탐구실험 세특 작성 시트   ' +
      CONFIG.SUBJECTS.filter(function (s) { return s.classTeachers && s.classTeachers[classNo]; })
        .map(function (s) { return '[' + s.name + ' 담당: ' + s.classTeachers[classNo] + ']  '; }).join('') +
      '(회색 칸 = 학생이 선택하지 않은 활동, 노란 칸 = 기록 작성 대상)')
    .setBackground(COLORS.title).setFontColor('#ffffff').setFontWeight('bold').setFontSize(12)
    .setVerticalAlignment('middle');
  sh.setRowHeight(1, 32);

  // ---- 고정 열 헤더
  const fixed = ['번호', '학번', '이름', '희망 진로', '제출 일시'];
  fixed.forEach(function (h, i) {
    sh.getRange(2, i + 1, 3, 1).merge().setValue(h);
  });
  sh.getRange(2, 1, 3, FIXED_COLS).setBackground(COLORS.header).setFontWeight('bold');

  // ---- 과목 블록 헤더
  CONFIG.SUBJECTS.forEach(function (s, si) {
    const b = L.subjects[si];
    const color = COLORS.subject[si % COLORS.subject.length];
    const light = COLORS.subjectLight[si % COLORS.subjectLight.length];

    sh.getRange(2, b.start, 1, b.end - b.start + 1).merge()
      .setValue(s.name + '  (최대 ' + s.max + '개 선택 · ' + CONFIG.BYTE_LIMIT + '바이트)')
      .setBackground(color).setFontColor('#ffffff').setFontWeight('bold');

    s.activities.forEach(function (a, i) {
      const c = b.acts[i];
      const t = activityTeacher(s, i, classNo);
      sh.getRange(3, c.sel, 1, 2).merge().setValue((i + 1) + '. ' + a.name + (t && !s.classTeachers ? '\n(' + t + ')' : ''))
        .setBackground(light).setFontWeight('bold').setWrap(true);
      sh.getRange(4, c.sel).setValue('선택');
      sh.getRange(4, c.memo).setValue('활동 기록');
      if (a.desc) sh.getRange(3, c.sel).setNote(a.desc);
    });

    const tail = [
      [b.count, '선택 수'],
      [b.draft, '세특 초안 (선택 활동 기록 자동 병합)'],
      [b.draftBytes, '초안 바이트'],
      [b.final, '세특 최종본 (교사 작성)'],
      [b.len, '최종 글자수'],
      [b.bytes, '최종 바이트'],
      [b.status, '판정'],
      [b.teacher, '담당 교사'],
      [b.progress, '진행 상태'],
    ];
    tail.forEach(function (t) {
      sh.getRange(3, t[0], 2, 1).merge().setValue(t[1]);
    });
    sh.getRange(3, b.count, 2, 9).setBackground(light).setFontWeight('bold').setWrap(true);
    sh.getRange(4, b.start, 1, s.activities.length * 2).setBackground(light);
  });

  sh.getRange(2, L.note, 3, 1).merge().setValue('비고 (교사 간 메모)')
    .setBackground(COLORS.header).setFontWeight('bold');

  sh.getRange(2, 1, HEADER_ROWS - 1, L.lastCol)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);

  // ---- 데이터 영역: 번호 + 수식
  const noVals = [];
  for (let i = 1; i <= nRows; i++) noVals.push([i]);
  sh.getRange(DATA_START, COL.NO, nRows, 1).setValues(noVals).setHorizontalAlignment('center');
  sh.getRange(DATA_START, COL.ID, nRows, 1).setNumberFormat('@').setHorizontalAlignment('center');
  sh.getRange(DATA_START, COL.SUBMITTED, nRows, 1).setNumberFormat('yyyy-mm-dd hh:mm');

  CONFIG.SUBJECTS.forEach(function (s, si) {
    const b = L.subjects[si];
    const f = { count: [], draft: [], draftBytes: [], len: [], bytes: [], status: [] };
    for (let r = DATA_START; r <= lastRow; r++) {
      const sel = b.acts.map(function (c) { return colLetter(c.sel) + r; });
      const pairs = b.acts.map(function (c) {
        return 'IF(' + colLetter(c.sel) + r + '=TRUE,' + colLetter(c.memo) + r + ',"")';
      });
      const draft = colLetter(b.draft) + r;
      const fin = colLetter(b.final) + r;
      const byt = colLetter(b.bytes) + r;
      const lim = CONFIG.BYTE_LIMIT;

      f.count.push(['=' + sel.map(function (x) { return 'N(' + x + ')'; }).join('+')]);
      f.draft.push(['=TEXTJOIN(" ",TRUE,' + pairs.join(',') + ')']);
      f.draftBytes.push(['=IF(' + draft + '="","",' + bytesFormula(draft) + ')']);
      f.len.push(['=IF(' + fin + '="","",LEN(' + fin + '))']);
      f.bytes.push(['=IF(' + fin + '="","",' + bytesFormula(fin) + ')']);
      f.status.push(['=IF(' + fin + '="","",IF(' + byt + '>' + lim + ',"⚠ "&(' + byt + '-' + lim +
        ')&"B 초과","✅ "&(' + lim + '-' + byt + ')&"B 남음"))']);
    }
    sh.getRange(DATA_START, b.count, nRows, 1).setFormulas(f.count).setHorizontalAlignment('center');
    sh.getRange(DATA_START, b.draft, nRows, 1).setFormulas(f.draft);
    sh.getRange(DATA_START, b.draftBytes, nRows, 1).setFormulas(f.draftBytes).setHorizontalAlignment('center');
    sh.getRange(DATA_START, b.len, nRows, 1).setFormulas(f.len).setHorizontalAlignment('center');
    sh.getRange(DATA_START, b.bytes, nRows, 1).setFormulas(f.bytes).setHorizontalAlignment('center');
    sh.getRange(DATA_START, b.status, nRows, 1).setFormulas(f.status).setHorizontalAlignment('center');

    [b.count, b.draft, b.draftBytes, b.len, b.bytes, b.status].forEach(function (c) {
      sh.getRange(DATA_START, c, nRows, 1).setBackground(COLORS.formula);
    });

    // 선택 체크박스
    b.acts.forEach(function (c) {
      sh.getRange(DATA_START, c.sel, nRows, 1).insertCheckboxes().setHorizontalAlignment('center');
    });

    // 활동 기록 칸: 선택된 활동만 입력 허용
    b.acts.forEach(function (c) {
      const rule = SpreadsheetApp.newDataValidation()
        .requireFormulaSatisfied('=$' + colLetter(c.sel) + DATA_START + '=TRUE')
        .setAllowInvalid(false)
        .setHelpText('학생이 선택한 활동만 기록할 수 있습니다. (선택 칸 체크 시 활성화)')
        .build();
      sh.getRange(DATA_START, c.memo, nRows, 1).setDataValidation(rule).setWrap(true)
        .setVerticalAlignment('top');
    });

    sh.getRange(DATA_START, b.teacher, nRows, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(CONFIG.TEACHERS, true).build());
    if (s.classTeachers && s.classTeachers[classNo]) {
      sh.getRange(DATA_START, b.teacher, nRows, 1).setValue(s.classTeachers[classNo]);
    }
    sh.getRange(DATA_START, b.progress, nRows, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(CONFIG.PROGRESS, true).build());

    sh.getRange(DATA_START, b.draft, nRows, 1).setWrap(true).setVerticalAlignment('top');
    sh.getRange(DATA_START, b.final, nRows, 1).setWrap(true).setVerticalAlignment('top');
  });

  // ---- 조건부 서식
  const rules = [];
  CONFIG.SUBJECTS.forEach(function (s, si) {
    const b = L.subjects[si];
    b.acts.forEach(function (c) {
      const selRef = '$' + colLetter(c.sel) + DATA_START;
      const memoRange = sh.getRange(DATA_START, c.memo, nRows, 1);
      const selRange = sh.getRange(DATA_START, c.sel, nRows, 1);
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=' + selRef + '=TRUE')
        .setBackground(COLORS.active).setRanges([memoRange]).build());
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=' + selRef + '<>TRUE')
        .setBackground(COLORS.inactive).setFontColor(COLORS.inactiveFont)
        .setRanges([memoRange]).build());
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=' + selRef + '=TRUE')
        .setBackground(COLORS.checked).setRanges([selRange]).build());
    });
    const bytesRef = colLetter(b.bytes) + DATA_START;
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(ISNUMBER(' + bytesRef + '),' + bytesRef + '>' + CONFIG.BYTE_LIMIT + ')')
      .setBackground(COLORS.over).setFontColor('#b71c1c').setBold(true)
      .setRanges([sh.getRange(DATA_START, b.bytes, nRows, 1), sh.getRange(DATA_START, b.status, nRows, 1)])
      .build());
    const dbRef = colLetter(b.draftBytes) + DATA_START;
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(ISNUMBER(' + dbRef + '),' + dbRef + '>' + CONFIG.BYTE_LIMIT + ')')
      .setFontColor('#b71c1c').setBold(true)
      .setRanges([sh.getRange(DATA_START, b.draftBytes, nRows, 1)]).build());
    const prRef = colLetter(b.progress) + DATA_START;
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=' + prRef + '="완료"').setBackground('#c8e6c9')
      .setRanges([sh.getRange(DATA_START, b.progress, nRows, 1)]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=OR(' + prRef + '="검토요청",' + prRef + '="수정필요")').setBackground('#ffe0b2')
      .setRanges([sh.getRange(DATA_START, b.progress, nRows, 1)]).build());
  });
  // 미제출 학생 이름 강조
  const subRef = '$' + colLetter(COL.SUBMITTED) + DATA_START;
  const nameRef = '$' + colLetter(COL.NAME) + DATA_START;
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND(' + nameRef + '<>"",' + subRef + '="")')
    .setBackground('#ffebee').setRanges([sh.getRange(DATA_START, COL.NO, nRows, 3)]).build());
  sh.setConditionalFormatRules(rules);

  // ---- 열 너비 / 고정
  sh.setColumnWidth(COL.NO, 45);
  sh.setColumnWidth(COL.ID, 65);
  sh.setColumnWidth(COL.NAME, 70);
  sh.setColumnWidth(COL.CAREER, 110);
  sh.setColumnWidth(COL.SUBMITTED, 110);
  L.subjects.forEach(function (b) {
    b.acts.forEach(function (c) {
      sh.setColumnWidth(c.sel, 42);
      sh.setColumnWidth(c.memo, 180);
    });
    sh.setColumnWidth(b.count, 55);
    sh.setColumnWidth(b.draft, 260);
    sh.setColumnWidth(b.draftBytes, 70);
    sh.setColumnWidth(b.final, 360);
    sh.setColumnWidth(b.len, 65);
    sh.setColumnWidth(b.bytes, 65);
    sh.setColumnWidth(b.status, 110);
    sh.setColumnWidth(b.teacher, 85);
    sh.setColumnWidth(b.progress, 85);
  });
  sh.setColumnWidth(L.note, 200);
  sh.setRowHeight(3, 64);
  sh.setFrozenRows(HEADER_ROWS);
  sh.setFrozenColumns(COL.NAME);

  // 테두리
  sh.getRange(2, 1, HEADER_ROWS - 1 + nRows, L.lastCol)
    .setBorder(true, true, true, true, true, true, '#bdbdbd', SpreadsheetApp.BorderStyle.SOLID);
  L.subjects.forEach(function (b) {
    sh.getRange(2, b.start, HEADER_ROWS - 1 + nRows, b.end - b.start + 1)
      .setBorder(true, true, true, true, null, null, '#424242', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });

  // 수식 열 실수 방지 (경고만 표시)
  L.subjects.forEach(function (b) {
    [b.count, b.draft, b.draftBytes, b.len, b.bytes, b.status].forEach(function (c) {
      sh.getRange(DATA_START, c, nRows, 1).protect()
        .setDescription('자동 계산 열 (' + sh.getName() + ')').setWarningOnly(true);
    });
  });
  sh.getRange(1, 1, HEADER_ROWS, L.lastCol).protect()
    .setDescription('머리글 (' + sh.getName() + ')').setWarningOnly(true);
}

function buildLogSheet(sh) {
  const headers = ['접수 시각', '반', '학번', '이름', '희망 진로'];
  CONFIG.SUBJECTS.forEach(function (s) { headers.push(s.name + ' 선택'); });
  headers.push('구분');
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setBackground(COLORS.title).setFontColor('#ffffff').setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sh.getRange('B:C').setNumberFormat('@');   // '1-3' 이 날짜로 바뀌지 않도록
  sh.setColumnWidths(6, CONFIG.SUBJECTS.length, 320);
}

/** 현황 탭: 반별 제출·작성 진행 상황 + 활동별 선택 인원 */
function rebuildSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SUMMARY_SHEET);
  if (sh) sh.clear(); else sh = ss.insertSheet(SUMMARY_SHEET, 0);
  sh.setConditionalFormatRules([]);

  const L = getLayout();
  const first = DATA_START;
  const last = DATA_START + CONFIG.STUDENTS_PER_CLASS - 1;
  const rng = function (cls, c) {
    return "'" + cls + "'!" + colLetter(c) + first + ':' + colLetter(c) + last;
  };

  const head = ['반', '명단 인원', '제출', '미제출', '제출률'];
  CONFIG.SUBJECTS.forEach(function (s) {
    head.push(s.name + ' 완료', s.name + ' 바이트 초과');
  });
  head.push('미제출 학생');

  sh.getRange(1, 1).setValue('세특 활동 선택 현황').setFontSize(14).setFontWeight('bold');
  sh.getRange(3, 1, 1, head.length).setValues([head])
    .setBackground(COLORS.title).setFontColor('#ffffff').setFontWeight('bold')
    .setHorizontalAlignment('center').setWrap(true);

  const rows = [];
  for (let n = 1; n <= CONFIG.CLASS_COUNT; n++) {
    const cls = className(n);
    const r = 4 + n - 1;
    const row = [
      cls,
      '=IFERROR(COUNTA(' + rng(cls, COL.NAME) + '),0)',
      '=IFERROR(COUNTA(' + rng(cls, COL.SUBMITTED) + '),0)',
      '=IFERROR(B' + r + '-C' + r + ',"")',
      '=IFERROR(C' + r + '/B' + r + ',"")',
    ];
    L.subjects.forEach(function (b) {
      row.push('=IFERROR(COUNTIF(' + rng(cls, b.progress) + ',"완료"),0)');
      row.push('=IFERROR(COUNTIF(' + rng(cls, b.bytes) + ',">' + CONFIG.BYTE_LIMIT + '"),0)');
    });
    row.push('=IFERROR(TEXTJOIN(", ",TRUE,FILTER(' + rng(cls, COL.NAME) + ',' + rng(cls, COL.NAME) +
      '<>"",' + rng(cls, COL.SUBMITTED) + '="")),"")');
    rows.push(row);
  }
  sh.getRange(4, 1, rows.length, head.length).setFormulas(rows.map(function (r) {
    return r.map(function (v) { return String(v); });
  }));
  // 반 이름('1-1')이 날짜로 바뀌지 않도록 텍스트로 지정
  sh.getRange(4, 1, rows.length, 1).setNumberFormat('@')
    .setValues(rows.map(function (r) { return [r[0]]; }));
  sh.getRange(4, 5, rows.length, 1).setNumberFormat('0%');
  const totalRow = 4 + rows.length;
  const tot = ['합계'];
  for (let c = 2; c < head.length; c++) {
    const L1 = colLetter(c);
    if (c === 5) tot.push('=IFERROR(C' + totalRow + '/B' + totalRow + ',"")');
    else tot.push('=SUM(' + L1 + '4:' + L1 + (totalRow - 1) + ')');
  }
  tot.push('');
  sh.getRange(totalRow, 1, 1, head.length).setFormulas([tot]).setFontWeight('bold').setBackground(COLORS.header);
  sh.getRange(totalRow, 5).setNumberFormat('0%');
  sh.getRange(3, 1, rows.length + 2, head.length)
    .setBorder(true, true, true, true, true, true, '#bdbdbd', SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(4, 1, rows.length + 1, head.length - 1).setHorizontalAlignment('center');

  const sel = function (n, c) { return 'COUNTIF(' + rng(className(n), c.sel) + ',TRUE)'; };
  const done = function (n, c) {
    return 'COUNTIFS(' + rng(className(n), c.sel) + ',TRUE,' + rng(className(n), c.memo) + ',"<>")';
  };
  const sumOf = function (parts) { return parts.length ? '=IFERROR(SUM(' + parts.join(',') + '),0)' : '=0'; };
  const tableHead = function (r, values, color) {
    sh.getRange(r, 1, 1, values.length).setValues([values])
      .setBackground(color).setFontColor('#ffffff').setFontWeight('bold')
      .setHorizontalAlignment('center').setWrap(true);
  };

  // 교사별 활동 기록 현황 (학생이 선택한 활동 중 '활동 기록' 칸이 채워진 수)
  let r0 = totalRow + 3;
  sh.getRange(r0 - 1, 1).setValue('교사별 활동 기록 현황 (학생이 선택한 활동의 기록 칸 기준)')
    .setFontWeight('bold').setFontSize(12);
  tableHead(r0, ['교사', '담당', '기록할 건수', '기록 완료', '남은 기록', '진행률'], COLORS.title);
  const tRows = CONFIG.TEACHERS.map(function (t, ti) {
    const selP = [];
    const doneP = [];
    const desc = [];
    CONFIG.SUBJECTS.forEach(function (s, si) {
      const b = L.subjects[si];
      const acts = [];
      const classes = [];
      for (let n = 1; n <= CONFIG.CLASS_COUNT; n++) {
        s.activities.forEach(function (a, i) {
          if (activityTeacher(s, i, n) !== t) return;
          selP.push(sel(n, b.acts[i]));
          doneP.push(done(n, b.acts[i]));
          if (acts.indexOf(i + 1) === -1) acts.push(i + 1);
          if (classes.indexOf(n) === -1) classes.push(n);
        });
      }
      if (!acts.length) return;
      desc.push(s.classTeachers
        ? s.name + ' ' + classes.map(className).join(', ') + '반'
        : s.name + ' ' + acts.join(', ') + '번 활동');
    });
    const r = r0 + 1 + ti;
    return [t, desc.join(' / ') || '-', sumOf(selP), sumOf(doneP),
      '=C' + r + '-D' + r, '=IFERROR(D' + r + '/C' + r + ',"")'];
  });
  sh.getRange(r0 + 1, 1, tRows.length, 6).setFormulas(tRows);
  sh.getRange(r0 + 1, 6, tRows.length, 1).setNumberFormat('0%');
  sh.getRange(r0 + 1, 3, tRows.length, 4).setHorizontalAlignment('center');
  sh.getRange(r0 + 1, 2, tRows.length, 1).setWrap(true);
  sh.getRange(r0, 1, tRows.length + 1, 6)
    .setBorder(true, true, true, true, true, true, '#bdbdbd', SpreadsheetApp.BorderStyle.SOLID);

  // 활동별 선택 인원 / 기록 현황
  r0 += tRows.length + 4;
  sh.getRange(r0 - 1, 1).setValue('활동별 선택 인원 (전체 반 합계)').setFontWeight('bold').setFontSize(12);
  CONFIG.SUBJECTS.forEach(function (s, si) {
    const b = L.subjects[si];
    tableHead(r0, [s.name, '활동', '담당', '선택 인원', '기록 완료', '남은 기록'],
      COLORS.subject[si % COLORS.subject.length]);
    const data = s.activities.map(function (a, i) {
      const selP = [];
      const doneP = [];
      for (let n = 1; n <= CONFIG.CLASS_COUNT; n++) {
        selP.push(sel(n, b.acts[i]));
        doneP.push(done(n, b.acts[i]));
      }
      const r = r0 + 1 + i;
      return [String(i + 1), a.name, s.classTeachers ? '반별 담당' : (a.teacher || ''),
        sumOf(selP), sumOf(doneP), '=D' + r + '-E' + r];
    });
    sh.getRange(r0 + 1, 1, data.length, 6).setFormulas(data);
    sh.getRange(r0 + 1, 3, data.length, 4).setHorizontalAlignment('center');
    sh.getRange(r0, 1, data.length + 1, 6)
      .setBorder(true, true, true, true, true, true, '#bdbdbd', SpreadsheetApp.BorderStyle.SOLID);
    r0 += data.length + 3;
  });

  sh.setColumnWidth(1, 110);
  sh.setColumnWidth(2, 300);
  sh.setColumnWidth(head.length, 360);
  sh.setFrozenRows(3);
}

// ============================================================
// 4. 웹 앱 (학생 페이지와 통신)
// ============================================================
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function publicConfig() {
  return {
    open: CONFIG.OPEN,
    grade: CONFIG.GRADE,
    classCount: CONFIG.CLASS_COUNT,
    subjects: CONFIG.SUBJECTS.map(function (s) {
      return {
        key: s.key, name: s.name, min: s.min, max: s.max,
        activities: s.activities.map(function (a) { return { name: a.name, desc: a.desc || '' }; }),
      };
    }),
  };
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'lookup') return json(lookup(p.id, p.name));
    return json({ ok: true, config: publicConfig() });
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return json(submit(body));
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) });
  }
}

/** 학생 입력값이 수식으로 해석되지 않도록 처리 */
function safeText(s) {
  s = String(s || '').trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function normName(s) {
  return String(s || '').replace(/\s+/g, '');
}

/** 학번(예: 10305 = 1학년 3반 5번) 검증 → 해당 탭/행 반환 */
function resolveStudent(id, name) {
  id = String(id || '').trim();
  name = normName(name);
  if (!/^\d{5}$/.test(id)) throw new Error('학번은 숫자 5자리로 입력하세요. (예: 1학년 3반 5번 → 10305)');
  const grade = Number(id.charAt(0));
  const cls = Number(id.substr(1, 2));
  const no = Number(id.substr(3, 2));
  if (grade !== CONFIG.GRADE) throw new Error(CONFIG.GRADE + '학년 학번이 아닙니다.');
  if (cls < 1 || cls > CONFIG.CLASS_COUNT) throw new Error('반 번호가 올바르지 않습니다.');
  if (no < 1 || no > CONFIG.STUDENTS_PER_CLASS) throw new Error('번호가 올바르지 않습니다.');
  if (!name) throw new Error('이름을 입력하세요.');

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(className(cls));
  if (!sh) throw new Error('시트가 준비되지 않았습니다. 선생님께 문의하세요.');
  const row = DATA_START + no - 1;
  const roster = normName(sh.getRange(row, COL.NAME).getValue());

  if (roster) {
    if (roster !== name) throw new Error('학번과 이름이 명단과 일치하지 않습니다. 다시 확인하세요.');
  } else if (CONFIG.REQUIRE_ROSTER) {
    throw new Error('명단에 등록되지 않은 학번입니다. 선생님께 문의하세요.');
  }
  return { sh: sh, row: row, cls: cls, no: no, id: id, name: name, rosterEmpty: !roster };
}

function lookup(id, name) {
  const st = resolveStudent(id, name);
  const L = getLayout();
  const values = st.sh.getRange(st.row, 1, 1, L.lastCol).getValues()[0];
  const submitted = values[COL.SUBMITTED - 1];
  const selections = {};
  CONFIG.SUBJECTS.forEach(function (s, si) {
    selections[s.key] = [];
    L.subjects[si].acts.forEach(function (c, i) {
      if (values[c.sel - 1] === true) selections[s.key].push(i);
    });
  });
  return {
    ok: true,
    student: { id: st.id, name: st.name, className: className(st.cls), no: st.no },
    submitted: submitted ? Utilities.formatDate(new Date(submitted), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : null,
    career: values[COL.CAREER - 1] || '',
    selections: submitted ? selections : null,
    open: CONFIG.OPEN,
  };
}

function submit(body) {
  if (!CONFIG.OPEN) throw new Error('제출이 마감되었습니다.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const st = resolveStudent(body.id, body.name);
    const L = getLayout();
    const sel = body.selections || {};
    const career = safeText(String(body.career || '').slice(0, 100));

    // 선택 검증
    const picked = CONFIG.SUBJECTS.map(function (s) {
      const arr = Array.isArray(sel[s.key]) ? sel[s.key] : [];
      const uniq = [];
      arr.forEach(function (v) {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n >= s.activities.length) throw new Error('잘못된 활동 번호입니다.');
        if (uniq.indexOf(n) === -1) uniq.push(n);
      });
      if (uniq.length < s.min) throw new Error(s.name + ' 활동을 ' + s.min + '개 이상 선택하세요.');
      if (uniq.length > s.max) throw new Error(s.name + ' 활동은 최대 ' + s.max + '개까지 선택할 수 있습니다.');
      return uniq.sort(function (a, b) { return a - b; });
    });

    const sh = st.sh;
    const r = st.row;
    const wasSubmitted = !!sh.getRange(r, COL.SUBMITTED).getValue();
    const now = new Date();

    sh.getRange(r, COL.ID).setValue(st.id);
    if (st.rosterEmpty) sh.getRange(r, COL.NAME).setValue(safeText(body.name));
    sh.getRange(r, COL.CAREER).setValue(career);
    sh.getRange(r, COL.SUBMITTED).setValue(now);

    const on = [];
    const off = [];
    CONFIG.SUBJECTS.forEach(function (s, si) {
      L.subjects[si].acts.forEach(function (c, i) {
        (picked[si].indexOf(i) !== -1 ? on : off).push(colLetter(c.sel) + r);
      });
    });
    if (on.length) sh.getRangeList(on).check();
    if (off.length) sh.getRangeList(off).uncheck();

    // 제출 기록
    const log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SHEET);
    if (log) {
      const row = [now, className(st.cls), st.id, st.name, career];
      CONFIG.SUBJECTS.forEach(function (s, si) {
        row.push(picked[si].map(function (i) { return (i + 1) + '. ' + s.activities[i].name; }).join(' / '));
      });
      row.push(wasSubmitted ? '수정' : '신규');
      log.appendRow(row);
    }

    return {
      ok: true,
      updated: wasSubmitted,
      submitted: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
      selections: CONFIG.SUBJECTS.reduce(function (acc, s, si) { acc[s.key] = picked[si]; return acc; }, {}),
    };
  } finally {
    lock.releaseLock();
  }
}
