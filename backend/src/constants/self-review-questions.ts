export type SelfReviewQuestionDef = {
  key: string;
  sortOrder: number;
  text: string;
  evidenceRequired: boolean;
};

/** Twenty professional self-review questions. Each is worth a maximum of 1 mark. */
export const SELF_REVIEW_QUESTIONS: SelfReviewQuestionDef[] = [
  { key: "q01", sortOrder: 1, text: "I achieved the goals assigned to me during this appraisal period.", evidenceRequired: false },
  { key: "q02", sortOrder: 2, text: "The quality of my work met the standard expected for my role.", evidenceRequired: false },
  { key: "q03", sortOrder: 3, text: "I maintained a productive pace throughout the appraisal period.", evidenceRequired: false },
  { key: "q04", sortOrder: 4, text: "I developed my technical or professional skills in line with my role.", evidenceRequired: true },
  { key: "q05", sortOrder: 5, text: "I solved problems effectively when they arose in my work.", evidenceRequired: false },
  { key: "q06", sortOrder: 6, text: "I communicated clearly with my supervisor and colleagues.", evidenceRequired: false },
  { key: "q07", sortOrder: 7, text: "I worked cooperatively with members of my team.", evidenceRequired: false },
  { key: "q08", sortOrder: 8, text: "I demonstrated leadership or a positive influence when the situation required it.", evidenceRequired: false },
  { key: "q09", sortOrder: 9, text: "I took initiative without waiting to be asked.", evidenceRequired: false },
  { key: "q10", sortOrder: 10, text: "I managed my time so that the most important work was handled first.", evidenceRequired: false },
  { key: "q11", sortOrder: 11, text: "I consistently met my assigned deadlines.", evidenceRequired: false },
  { key: "q12", sortOrder: 12, text: "I engaged in learning and development beyond my immediate tasks.", evidenceRequired: true },
  { key: "q13", sortOrder: 13, text: "I adapted well when priorities or requirements changed.", evidenceRequired: false },
  { key: "q14", sortOrder: 14, text: "I took responsibility for the outcomes of my work.", evidenceRequired: false },
  { key: "q15", sortOrder: 15, text: "I collaborated with people outside my immediate team when the work required it.", evidenceRequired: false },
  { key: "q16", sortOrder: 16, text: "I contributed to my team's shared goals.", evidenceRequired: false },
  { key: "q17", sortOrder: 17, text: "I handled challenges constructively and followed them through.", evidenceRequired: false },
  { key: "q18", sortOrder: 18, text: "I made measurable progress against my PDP goals.", evidenceRequired: true },
  { key: "q19", sortOrder: 19, text: "I can identify clear areas where I should improve in the next cycle.", evidenceRequired: false },
  { key: "q20", sortOrder: 20, text: "My overall contribution supported the team's results during this period.", evidenceRequired: false },
];

export const SELF_REVIEW_QUESTION_COUNT = SELF_REVIEW_QUESTIONS.length;
export const SELF_REVIEW_MAX_SCORE = SELF_REVIEW_QUESTION_COUNT;

export const RATING_LABELS: Record<number, string> = {
  1: "Needs Significant Improvement",
  2: "Needs Improvement",
  3: "Meets Expectations",
  4: "Exceeds Expectations",
  5: "Outstanding",
};
