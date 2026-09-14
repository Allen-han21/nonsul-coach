// Reproducible conversion of the user-provided official guide; no student data.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const [
  pdf,
  destination = 'docs/evaluation/source.json',
  serverDestination = 'web/lib/server/official.json',
  publicDestination = 'web/lib/question-content.json',
] = process.argv.slice(2);
if (!pdf) throw new Error('Provide the official PDF path.');
const sha256 = createHash('sha256').update(readFileSync(pdf)).digest('hex');
if (
  sha256 !== '94291ab4f3f7761b74a9a410349ae751154689631c0d4dba4dc1d29e541a56cc'
)
  throw new Error(
    'Guide version changed: review source pages before updating.',
  );
const pages = execFileSync('pdftotext', ['-layout', pdf, '-'], {
  maxBuffer: 10_000_000,
})
  .toString()
  .split('\f');
const clean = (text) =>
  text
    .replace(
      /^.*(?:2027학년도 성신여자대학교 논술 가이드북|IV\s*\.\s*논술고사 기출문제 및 해설).*$/gm,
      '',
    )
    .replace(/[\u0007\u0008]/g, '')
    .trim();
const page = (n) => clean(pages[n - 1]);
const paragraph = (text) =>
  clean(text)
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
// InDesign allows Korean words to wrap between syllables. pdftotext inserts a
// space at every visual line break, so these reviewed replacements restore the
// source spelling. They apply only to public passages/questions, not rubrics or
// examples used for internal comparison.
const passageRepairs = [
  ['10,650,959명 으로', '10,650,959명으로'],
  ['초고령 사회로', '초고령사회로'],
  ['초고령 사회 진입국', '초고령사회 진입국'],
  ['평가 되며', '평가되며'],
  ['공적부 조와', '공적부조와'],
  ['연금급여 를', '연금급여를'],
  ['× (1+0.05n/12)', '×(1+0.05n/12)'],
  ['MZ세대(1980- 2010년', 'MZ세대(1980-2010년'],
  ['‘국민 연금에', '‘국민연금에'],
  ['별도의 적 립기금', '별도의 적립기금'],
  ['중복세대모 형', '중복세대모형'],
  ['싱가포 르 정부', '싱가포르 정부'],
  ['있는 그대 로의', '있는 그대로의'],
  ['벤담 (Jeremy', '벤담(Jeremy'],
  ['입 장이다', '입장이다'],
  ['자 유주의는', '자유주의는'],
  ['극대화 (maximin', '극대화(maximin'],
  ['정 당하게', '정당하게'],
  ['계약과 소 유권', '계약과 소유권'],
  ['연금 보험료의', '연금보험료의'],
  ['언어 모델 은', '언어 모델은'],
  ['전 문가나', '전문가나'],
  ['구조 자체 가', '구조 자체가'],
  ['복잡 한 개념', '복잡한 개념'],
  ['학습 도구 는', '학습 도구는'],
  ['이해되 었지만', '이해되었지만'],
  ['실 제로', '실제로'],
  ['이 러한 관점', '이러한 관점'],
  ['이러 한 양면성', '이러한 양면성'],
  ['theory)에 기반 을', 'theory)에 기반을'],
  ['기술, 경험 이', '기술, 경험이'],
  ['때문이 다', '때문이다'],
  ['증가하 고', '증가하고'],
  ['더 높은 수 준의', '더 높은 수준의'],
  ['국가들은 교 육을', '국가들은 교육을'],
  ['의미가 축 소될', '의미가 축소될'],
  ['과정을 담당 한다', '과정을 담당한다'],
  ['같은 사 회적', '같은 사회적'],
  ['학교 생 활의', '학교 생활의'],
  ['가능하 게 하는', '가능하게 하는'],
  ['뒤르켐(Émile Durkheim)은 교 육이', '뒤르켐(Émile Durkheim)은 교육이'],
  ['개인 주의가', '개인주의가'],
  ['문화 경험, 교 육 방식', '문화 경험, 교육 방식'],
  ['완화하거나 심 화시키는', '완화하거나 심화시키는'],
  ['효과 적으로', '효과적으로'],
  ['사회적 권력 관계 와', '사회적 권력 관계와'],
  ['산출할 수 있다 는', '산출할 수 있다는'],
  ['방향으 로 함께', '방향으로 함께'],
  ['도구로 작 동할', '도구로 작동할'],
];
const passage = (text) =>
  passageRepairs.reduce(
    (value, [from, to]) => value.replaceAll(from, to),
    paragraph(text),
  );
const noticeList = (n) =>
  clean(page(n).split('유 의 사 항')[1])
    .split(/\n\s*\n/)
    .map(paragraph)
    .filter(Boolean);
const problemPage = page(37);
const questions = [1, 2].map((n) =>
  passage(problemPage.split(`【문제 ${n}】`)[1].split('【문제')[0]),
);
const notices = noticeList(34);
const source = {
  university: '성신여자대학교',
  track: '인문계열',
  session: '1교시',
  examYear: 2026,
  title: '2027학년도 성신여자대학교 논술 가이드북',
  publicationYear: 2026,
  version: '2027-guide-20260701-sha256-94291ab4f3f7',
  sha256,
  provenance:
    '사용자가 제공한 대학 공식 가이드북 PDF. PDF 생성·수정일 2026-07-01. 인쇄 페이지와 PDF 페이지가 동일함.',
  pages: {
    instructions: [34],
    passages: [35, 36, 37],
    questions: [37],
    intent: [38],
    commentary: [43, 44, 45],
    rubric: [46, 47],
    examples: [48],
  },
};
const material = [
  page(35).replace('1. 문항 및 제시문', ''),
  page(36),
  problemPage.split('【문제 1】')[0],
].join('\n');
const blocks = material.split(/\n\s*([가나다라마])\s*\n/);
const passages = [];
for (let i = 1; i < blocks.length; i += 2)
  passages.push({ label: blocks[i], text: passage(blocks[i + 1]) });
if (passages.map((p) => p.label).join('') !== '가나다라마')
  throw new Error('Passage extraction failed.');
const examples = [1, 2].map((n) =>
  paragraph(page(48).split(`【문제 ${n}】`)[1].split('【문제')[0]),
);
if (!examples[0].endsWith('(996자)') || !examples[1].endsWith('(985자)'))
  throw new Error('Example extraction failed.');
const result = {
  source,
  instructions: { page: 34, notices, directions: [] },
  passages,
  questions,
  intent: paragraph(
    page(38).split('3. 출제 근거')[0].replace('2. 출제 의도', ''),
  ),
  commentary: [
    paragraph(page(43).replace('4. 문항 해설', '')),
    paragraph(page(44) + '\n' + page(45)),
  ],
  rubricText: paragraph(page(46) + '\n' + page(47)),
  examples,
  figureNote:
    '35쪽 인구상황판은 원본 PDF에서 시각 확인. 텍스트 추출에 포함되지 않는 그림의 수치를 분석 근거로 임의 생성하지 않는다.',
};
const mockPage = page(93);
const mockMaterial = [page(91), page(92), mockPage.split('【문제 1】')[0]].join(
  '\n',
);
const mockBlocks = mockMaterial.split(/\n\s*([가나다라])\s*\n/);
const mockPassages = [];
for (let i = 1; i < mockBlocks.length; i += 2)
  mockPassages.push({ label: mockBlocks[i], text: passage(mockBlocks[i + 1]) });
const mockNotices = noticeList(90);
if (notices.join('\n') !== mockNotices.join('\n'))
  throw new Error('Actual and mock notices differ: review the source.');
const mockDirections = page(91)
  .split(/\n\s*가\s*\n/)[0]
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.startsWith('※'));
const mockExamples = (page(101) + '\n' + page(102)).split('7. 예시 답안')[1];
result.mock = {
  source: {
    ...source,
    session: '모의논술',
    examYear: 2027,
    pages: {
      instructions: [90, 91],
      passages: [91, 92, 93],
      questions: [93],
      intent: [94],
      commentary: [96, 97, 98],
      rubric: [99, 100, 101],
      examples: [101, 102],
    },
  },
  instructions: { page: 90, notices: mockNotices, directions: mockDirections },
  passages: mockPassages,
  questions: [1, 2].map((n) =>
    passage(mockPage.split(`【문제 ${n}】`)[1].split('【문제')[0]),
  ),
  intent: paragraph(
    page(94).split('3. 출제 근거')[0].replace('2. 출제 의도', ''),
  ),
  commentary: [
    paragraph(
      (page(97) + '\n' + page(98))
        .split('【문제 1】')[1]
        .split('【문제 2】')[0],
    ),
    paragraph(page(98).split('【문제 2】')[1]),
  ],
  rubricText: paragraph(
    (page(99) + '\n' + page(100) + '\n' + page(101)).split('7. 예시 답안')[0],
  ),
  examples: [1, 2].map((n) =>
    paragraph(mockExamples.split(`【문제 ${n}】`)[1].split('【문제')[0]),
  ),
};
if (
  mockPassages.length !== 4 ||
  result.mock.examples.some((x) => x.length < 800)
)
  throw new Error('Mock examination extraction failed.');
mkdirSync(destination.slice(0, destination.lastIndexOf('/')), {
  recursive: true,
});
writeFileSync(destination, JSON.stringify(result, null, 2) + '\n');
mkdirSync(serverDestination.slice(0, serverDestination.lastIndexOf('/')), {
  recursive: true,
});
writeFileSync(serverDestination, JSON.stringify(result, null, 2) + '\n');
const publicResult = {
  source: {
    title: source.title,
    version: source.version,
    publicationYear: source.publicationYear,
  },
  actual: {
    label: '2026학년도 논술고사 인문계열(1교시)',
    pageRange: '34-37',
    instructions: result.instructions,
    passages,
    questions,
    figure: {
      afterPassage: '가',
      src: '/official/sungshin-2026-population-board-000.jpg',
      caption: '그림 인구상황판 (자료출처: 통계청, 「장래인구추계」, 2023)',
    },
  },
  mock: {
    label: '2027학년도 모의 논술고사 인문계열',
    pageRange: '90-93',
    instructions: result.mock.instructions,
    passages: mockPassages,
    questions: result.mock.questions,
    figure: null,
  },
};
mkdirSync(publicDestination.slice(0, publicDestination.lastIndexOf('/')), {
  recursive: true,
});
writeFileSync(publicDestination, JSON.stringify(publicResult, null, 2) + '\n');
console.log(
  JSON.stringify({
    destination,
    serverDestination,
    publicDestination,
    sha256,
    questions: questions.length + result.mock.questions.length,
    passages: passages.length + mockPassages.length,
    notices: notices.length + mockDirections.length,
    examples: examples.length + result.mock.examples.length,
  }),
);
