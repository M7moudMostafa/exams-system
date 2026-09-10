import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXAM_DURATION_MS, finalResult, isValidCandidate, oneHourFromStart, scoreAttempt, type Attempt, type ExamDefinition } from "../shared/exam";
import { buildResultRow, createAttempt, getAttempt, loadExam, removeAttempt } from "./exam";

describe("exam timing and scoring", () => {
  it("sets the deadline to one hour after the start time", () => {
    const now = new Date("2026-08-28T12:15:00.000Z");
    expect(oneHourFromStart(now)).toBe(now.getTime() + EXAM_DURATION_MS);
    expect(new Date(oneHourFromStart(now)).toISOString()).toBe("2026-08-28T13:15:00.000Z");
  });

  it("keeps a one-hour window from start even later in the day", () => {
    const now = new Date("2026-08-28T16:15:00.000Z");
    expect(new Date(oneHourFromStart(now)).toISOString()).toBe("2026-08-28T17:15:00.000Z");
  });

  it("validates both required candidate fields", () => {
    expect(isValidCandidate("Amina Hassan", "01012345678")).toBe(true);
    expect(isValidCandidate("A", "12345")).toBe(false);
    expect(isValidCandidate("Amina Hassan", "")).toBe(false);
  });

  it("maps the sample workbook columns into exactly four answers", () => {
    const exam = loadExam();
    expect(exam.questions).toHaveLength(6);
    expect(exam.questions[0]).toMatchObject({ id: "Q1", correctAnswer: "B", answers: ["DNS", "DHCP", "HTTP", "FTP"] });
  });

  it("persists a shuffled question order for recovery", () => {
    const exam = loadExam();
    const attempt = createAttempt("Order Test", "01012345678", new Date("2026-08-28T12:00:00.000Z").getTime());
    try {
      expect(attempt.questionOrder).toHaveLength(exam.questions.length);
      expect([...attempt.questionOrder].sort()).toEqual(exam.questions.map((question) => question.id).sort());
      expect(getAttempt(attempt.id)?.questionOrder).toEqual(attempt.questionOrder);
    } finally {
      removeAttempt(attempt.id);
    }
  });

  it("keeps the results workbook private from public candidate access", () => {
    const routerSource = fs.readFileSync(path.resolve(process.cwd(), "server/routers.ts"), "utf8");
    const homeSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(routerSource).not.toContain("resultsWorkbook");
    expect(homeSource).not.toContain("Download results workbook");
    expect(homeSource).not.toContain("resultsWorkbook");
  });

  it("maps an attempt into the exported results workbook row", () => {
    const exam = loadExam();
    const attempt: Attempt = { id: "export-test", examName: exam.examName, candidateName: "Export Candidate", phoneNumber: "01012345678", startedAt: 1, deadlineAt: 2, questionOrder: ["Q1", "Q2"], optionOrders: { Q1: ["A", "B", "C", "D"], Q2: ["A", "B", "C", "D"] }, submittedAt: 3, submissionReason: "manual", answers: {
      Q1: { questionId: "Q1", selectedAnswer: "B", isCorrect: true, answeredAt: 2 },
    } };
    const row = buildResultRow(attempt, exam);
    expect(row).toMatchObject({ CandidateName: "Export Candidate", PhoneNumber: "01012345678", "Q1 Answer": "B", "Q1 Correct": "Correct", "Q2 Answer": "Not answered", SubmissionReason: "manual", Score: "1/6", Percentage: 17, FinalResult: "REVIEW" });
  });

  it("scores selected answers and maps the passing result", () => {
    const exam: ExamDefinition = { examName: "Sample", questions: [
      { id: "Q1", question: "One", answers: ["a", "b", "c", "d"], correctAnswer: "A" },
      { id: "Q2", question: "Two", answers: ["a", "b", "c", "d"], correctAnswer: "C" },
    ] };
    const attempt: Attempt = { id: "x", examName: "Sample", candidateName: "A", phoneNumber: "12345", startedAt: 1, deadlineAt: 2, questionOrder: ["Q1", "Q2"], optionOrders: { Q1: ["A", "B", "C", "D"], Q2: ["A", "B", "C", "D"] }, answers: {
      Q1: { questionId: "Q1", selectedAnswer: "A", isCorrect: true, answeredAt: 1 },
      Q2: { questionId: "Q2", selectedAnswer: "B", isCorrect: false, answeredAt: 1 },
    } };
    expect(scoreAttempt(attempt, exam)).toMatchObject({ correct: 1, answered: 2, total: 2, percentage: 50 });
    expect(finalResult(60)).toBe("PASS");
    expect(finalResult(59)).toBe("REVIEW");
  });
});
