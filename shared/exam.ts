export type AnswerKey = "A" | "B" | "C" | "D";

export type ExamQuestion = {
  id: string;
  question: string;
  answers: [string, string, string, string];
  correctAnswer: AnswerKey;
};

export type ExamDefinition = {
  examName: string;
  questions: ExamQuestion[];
};

export type CandidateAnswer = {
  questionId: string;
  selectedAnswer: AnswerKey;
  isCorrect: boolean;
  answeredAt: number;
};

export type Attempt = {
  id: string;
  examName: string;
  candidateName: string;
  phoneNumber: string;
  startedAt: number;
  deadlineAt: number;
  answers: Record<string, CandidateAnswer>;
  questionOrder: string[];
  optionOrders: Record<string, AnswerKey[]>;
  submittedAt?: number;
  submissionReason?: "manual" | "time-expired" | "page-hidden" | "duplicate-tab" | "browser-closed";
};

export type AttemptSnapshot = Omit<Attempt, "answers"> & {
  answers: Record<string, CandidateAnswer>;
};

export const ANSWER_LABELS = ["A", "B", "C", "D"] as const;

export const EXAM_DURATION_MS = 60 * 60 * 1000;

export function oneHourFromStart(now = new Date()): number {
  return now.getTime() + EXAM_DURATION_MS;
}

export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function scoreAttempt(attempt: Attempt, exam: ExamDefinition) {
  const total = exam.questions.length;
  const correct = Object.values(attempt.answers).filter((answer) => answer.isCorrect).length;
  const answered = Object.keys(attempt.answers).length;
  return { correct, answered, total, percentage: total ? Math.round((correct / total) * 100) : 0 };
}

export function finalResult(percentage: number): "PASS" | "REVIEW" {
  return percentage >= 60 ? "PASS" : "REVIEW";
}

export function isValidCandidate(candidateName: string, phoneNumber: string): boolean {
  return candidateName.trim().length >= 2 && candidateName.trim().length <= 120 && phoneNumber.trim().length >= 5 && phoneNumber.trim().length <= 30;
}
