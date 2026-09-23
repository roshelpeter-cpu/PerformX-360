export type PeerQuestion = { key: string; sortOrder: number; text: string };

/** Five questions. Each rating of 5 is worth 2 marks, so one peer review totals 10. */
export const PEER_REVIEW_QUESTIONS: PeerQuestion[] = [
  { key: "p01", sortOrder: 1, text: "This colleague works cooperatively and supports the team." },
  { key: "p02", sortOrder: 2, text: "This colleague communicates clearly and respectfully." },
  { key: "p03", sortOrder: 3, text: "This colleague solves problems in a practical way." },
  { key: "p04", sortOrder: 4, text: "This colleague is reliable and follows through on commitments." },
  { key: "p05", sortOrder: 5, text: "The quality of this colleague's work meets the standard expected for the role." },
];

export const PEER_REVIEW_MAX_PER_REVIEWER = 10;
export const PEER_REVIEW_MAX_TOTAL = 20;

export function scoreForPeerRating(rating: number) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return 0;
  return Number(((rating / 5) * 2).toFixed(2));
}
