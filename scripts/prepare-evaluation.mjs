// Reproducible conversion of the user-provided official guide; no student data.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const [pdf, destination = 'docs/evaluation/source.json'] = process.argv.slice(2);
if (!pdf) throw new Error('Provide the official PDF path.');
const sha256 = createHash('sha256').update(readFileSync(pdf)).digest('hex');
if (sha256 !== '94291ab4f3f7761b74a9a410349ae751154689631c0d4dba4dc1d29e541a56cc') throw new Error('Guide version changed: review source pages before updating.');
const pages = execFileSync('pdftotext', ['-layout', pdf, '-'], { maxBuffer: 10_000_000 }).toString().split('\f');
const clean = text => text.replace(/^.*(?:2027학년도 성신여자대학교 논술 가이드북|IV\s*\.\s*논술고사 기출문제 및 해설).*$/gm, '').replace(/[\u0007\u0008]/g, '').trim();
const page = n => clean(pages[n - 1]);
const paragraph = text => clean(text).split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
const problemPage = page(37);
const questions = [1, 2].map(n => paragraph(problemPage.split(`【문제 ${n}】`)[1].split('【문제')[0]));
const source = {
  university: '성신여자대학교', track: '인문계열', session: '1교시', examYear: 2026,
  title: '2027학년도 성신여자대학교 논술 가이드북', publicationYear: 2026,
  version: '2027-guide-20260701-sha256-94291ab4f3f7', sha256,
  provenance: '사용자가 제공한 대학 공식 가이드북 PDF. PDF 생성·수정일 2026-07-01. 인쇄 페이지와 PDF 페이지가 동일함.',
  pages: { passages: [35, 36, 37], questions: [37], intent: [38], commentary: [43, 44, 45], rubric: [46, 47], examples: [48] },
};
const material = [page(35).replace('1. 문항 및 제시문', ''), page(36), problemPage.split('【문제 1】')[0]].join('\n');
const blocks = material.split(/\n\s*([가나다라마])\s*\n/);
const passages = [];
for (let i = 1; i < blocks.length; i += 2) passages.push({ label: blocks[i], text: paragraph(blocks[i + 1]) });
if (passages.map(p => p.label).join('') !== '가나다라마') throw new Error('Passage extraction failed.');
const examples = [1, 2].map(n => paragraph(page(48).split(`【문제 ${n}】`)[1].split('【문제')[0]));
if (!examples[0].endsWith('(996자)') || !examples[1].endsWith('(985자)')) throw new Error('Example extraction failed.');
const result = { source, passages, questions, intent: paragraph(page(38).split('3. 출제 근거')[0].replace('2. 출제 의도', '')), commentary: [paragraph(page(43).replace('4. 문항 해설', '')), paragraph(page(44) + '\n' + page(45))], rubricText: paragraph(page(46) + '\n' + page(47)), examples,
  figureNote: '35쪽 인구상황판은 원본 PDF에서 시각 확인. 텍스트 추출에 포함되지 않는 그림의 수치를 분석 근거로 임의 생성하지 않는다.' };
const mockPage = page(93);
const mockMaterial = [page(91), page(92), mockPage.split('【문제 1】')[0]].join('\n');
const mockBlocks = mockMaterial.split(/\n\s*([가나다라])\s*\n/);
const mockPassages = [];
for (let i = 1; i < mockBlocks.length; i += 2) mockPassages.push({ label: mockBlocks[i], text: paragraph(mockBlocks[i + 1]) });
const mockExamples = (page(101) + '\n' + page(102)).split('7. 예시 답안')[1];
result.mock = {
  source: { ...source, session: '모의논술', examYear: 2027, pages: { passages: [91, 92, 93], questions: [93], intent: [94], commentary: [96, 97, 98], rubric: [99, 100, 101], examples: [101, 102] } },
  passages: mockPassages,
  questions: [1, 2].map(n => paragraph(mockPage.split(`【문제 ${n}】`)[1].split('【문제')[0])),
  intent: paragraph(page(94).split('3. 출제 근거')[0].replace('2. 출제 의도', '')),
  commentary: [paragraph((page(97) + '\n' + page(98)).split('【문제 1】')[1].split('【문제 2】')[0]), paragraph(page(98).split('【문제 2】')[1])],
  rubricText: paragraph((page(99) + '\n' + page(100) + '\n' + page(101)).split('7. 예시 답안')[0]),
  examples: [1, 2].map(n => paragraph(mockExamples.split(`【문제 ${n}】`)[1].split('【문제')[0])),
};
if (mockPassages.length !== 4 || result.mock.examples.some(x => x.length < 800)) throw new Error('Mock examination extraction failed.');
mkdirSync(destination.slice(0, destination.lastIndexOf('/')), { recursive: true });
writeFileSync(destination, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ destination, sha256, questions: questions.length + result.mock.questions.length, passages: passages.length + mockPassages.length, examples: examples.length + result.mock.examples.length }));
