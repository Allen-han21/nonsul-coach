import { z } from 'zod';
export const StatusSchema = z.enum([
  '충족',
  '부분 충족',
  '미충족',
  '확인 필요',
]);
export const PackageIdSchema = z.enum([
  'sungshin-2026-1-1',
  'sungshin-2026-1-2',
  'sungshin-2027-mock-1',
  'sungshin-2027-mock-2',
]);
export const SourceSchema = z
  .object({
    document: z.string().min(1),
    version: z.string().min(1),
    page: z.number().int().positive(),
    quote: z.string().min(1),
  })
  .strict();
export const EvidenceSchema = z
  .object({
    quote: z.string().min(1).max(6000),
    start: z.number().int().min(0),
    end: z.number().int().positive(),
    paragraphStart: z.number().int().positive(),
    paragraphEnd: z.number().int().positive(),
    scope: z.enum(['excerpt', 'whole_answer']),
  })
  .strict()
  .refine(
    (e) => e.end > e.start && e.paragraphEnd >= e.paragraphStart,
    'Invalid evidence range',
  );
export const FeedbackSchema = z
  .object({
    id: z.string().min(1),
    criterionId: z.string().min(1),
    label: z.string().min(1),
    status: StatusSchema,
    priority: z.number().int().min(1).max(5),
    evidence: EvidenceSchema,
    source: SourceSchema,
    reason: z.string().min(1).max(1500),
    question: z.string().min(1).max(500),
    action: z.string().min(1).max(500),
    kind: z.enum(['rule', 'ai']),
    verified: z.boolean(),
  })
  .strict();
export const InputSchema = z
  .object({
    packageId: PackageIdSchema,
    material: z
      .string()
      .min(1)
      .max(20000)
      .refine((s) => !!s.trim(), '문제와 제시문을 입력해 주세요.'),
    answer: z
      .string()
      .min(1)
      .max(6000)
      .refine((s) => !!s.trim(), '학생 답안을 입력해 주세요.'),
  })
  .strict();
export const CriterionSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    source: SourceSchema,
    expectation: z.string(),
    question: z.string(),
    action: z.string(),
    priority: z.number().int().min(1).max(5),
  })
  .strict();
export const EvaluationPackageSchema = z
  .object({
    id: PackageIdSchema,
    university: z.literal('성신여자대학교'),
    track: z.literal('인문계열'),
    year: z.number().int(),
    kind: z.enum(['actual', 'mock']),
    label: z.string(),
    question: z.string(),
    source: SourceSchema,
    minLength: z.number().int(),
    maxLength: z.number().int(),
    requiredPassages: z.array(z.string()).min(1),
    requiredWords: z.array(z.string()),
    paragraphCount: z.number().int().positive().nullable(),
    concepts: z.array(
      z
        .object({ label: z.string(), aliases: z.array(z.string()).min(1) })
        .strict(),
    ),
    tasks: z.array(z.string()).min(1),
    criteria: z.array(CriterionSchema).min(1),
    exceptions: z.array(z.string()),
  })
  .strict();
export const ResultSchema = z
  .object({
    packageId: PackageIdSchema,
    sourceVersion: z.string().min(1),
    analysisMode: z.enum(['verified_ai', 'rules_only']),
    rules: z.array(FeedbackSchema),
    diagnoses: z.array(FeedbackSchema),
    priorities: z.array(FeedbackSchema).max(3),
    notices: z.array(z.string()),
    counts: z
      .object({
        withSpaces: z.number().int(),
        withoutSpaces: z.number().int(),
        paragraphs: z.number().int(),
      })
      .strict(),
  })
  .strict();
export type EvaluationPackage = z.infer<typeof EvaluationPackageSchema>;
export type Feedback = z.infer<typeof FeedbackSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type AnalysisInput = z.infer<typeof InputSchema>;
export type AnalysisResult = z.infer<typeof ResultSchema>;
export type Criterion = z.infer<typeof CriterionSchema>;
