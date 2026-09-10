import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import XLSX from "xlsx";
import {
  type AnswerKey,
  type Attempt,
  type CandidateAnswer,
  type ExamDefinition,
  finalResult,
  scoreAttempt,
  sameDayThreeFiftyFivePm,
} from "../shared/exam";

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const questionsPath = path.join(dataDir, "questions.xlsx");
const attemptsPath = path.join(dataDir, "attempts.json");
const resultsPath = path.join(dataDir, "results.xlsx");
const answerKeys: AnswerKey[] = ["A", "B", "C", "D"];

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function ensureDataFiles() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(attemptsPath)) fs.writeFileSync(attemptsPath, "{}", "utf8");
}

function readAttempts(): Record<string, Attempt> {
  ensureDataFiles();
  try { return JSON.parse(fs.readFileSync(attemptsPath, "utf8")); } catch { return {}; }
}

function writeAttempts(attempts: Record<string, Attempt>) {
  ensureDataFiles();
  fs.writeFileSync(attemptsPath, JSON.stringify(attempts, null, 2), "utf8");
}

export function loadExam(): ExamDefinition {
  ensureDataFiles();
  if (!fs.existsSync(questionsPath)) throw new Error("Question workbook not found at data/questions.xlsx");
  const workbook = XLSX.readFile(questionsPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const examName = String(rows[0]?.ExamName || rows[0]?.["Exam Name"] || "Local Network Exam").trim();
  const questions = rows.map((row, index) => {
    const correct = String(row.CorrectAnswer || row["Correct Answer"] || "A").trim().toUpperCase() as AnswerKey;
    return {
      id: String(row.ID || row.Id || index + 1),
      question: String(row.Question || row["Question Text"] || "").trim(),
      answers: [String(row.AnswerA || row["Answer A"] || ""), String(row.AnswerB || row["Answer B"] || ""), String(row.AnswerC || row["Answer C"] || ""), String(row.AnswerD || row["Answer D"] || "")] as [string, string, string, string],
      correctAnswer: answerKeys.includes(correct) ? correct : "A",
    };
  }).filter((question) => question.question && question.answers.every(Boolean));
  return { examName, questions };
}

export function createAttempt(candidateName: string, phoneNumber: string, now = Date.now()): Attempt {
  const exam = loadExam();
  const questionOrder = shuffleArray(exam.questions.map((question) => question.id));
  const optionOrders = Object.fromEntries(
    exam.questions.map((question) => [question.id, shuffleArray(answerKeys)])
  ) as Record<string, AnswerKey[]>;
  const attempt: Attempt = {
    id: randomUUID(), examName: exam.examName, candidateName, phoneNumber,
    startedAt: now, deadlineAt: sameDayThreeFiftyFivePm(new Date(now)), answers: {}, questionOrder, optionOrders,
  };
  const attempts = readAttempts(); attempts[attempt.id] = attempt; writeAttempts(attempts);
  return attempt;
}

export function getAttempt(id: string): Attempt | undefined { return readAttempts()[id]; }

export function removeAttempt(id: string) {
  const attempts = readAttempts();
  delete attempts[id];
  writeAttempts(attempts);
}

export function saveAttemptAnswer(id: string, questionId: string, selectedAnswer: AnswerKey, now = Date.now()): Attempt {
  const attempts = readAttempts();
  const attempt = attempts[id]; if (!attempt) throw new Error("Attempt not found");
  if (attempt.submittedAt) return attempt;
  if (now >= attempt.deadlineAt) {
    submitAttempt(id, "time-expired", now);
    throw new Error("The exam deadline has passed");
  }
  const exam = loadExam();
  const question = exam.questions.find((item) => item.id === questionId); if (!question) throw new Error("Question not found");
  const displayOrder = attempt.optionOrders?.[questionId] ?? answerKeys;
  const originalKey = displayOrder[answerKeys.indexOf(selectedAnswer)] ?? selectedAnswer;
  const answer: CandidateAnswer = { questionId, selectedAnswer: originalKey, isCorrect: question.correctAnswer === originalKey, answeredAt: now };
  attempt.answers[questionId] = answer;
  attempts[id] = attempt; writeAttempts(attempts); return attempt;
}

export function submitAttempt(id: string, reason: Attempt["submissionReason"], now = Date.now()): { attempt: Attempt; score: ReturnType<typeof scoreAttempt>; result: string } {
  const attempts = readAttempts(); const attempt = attempts[id]; if (!attempt) throw new Error("Attempt not found");
  if (!attempt.submittedAt) {
    attempt.submittedAt = now;
    attempt.submissionReason = now >= attempt.deadlineAt ? "time-expired" : (reason || "manual");
    attempts[id] = attempt; writeAttempts(attempts); appendResultRow(attempt);
  }
  const score = scoreAttempt(attempt, loadExam()); return { attempt, score, result: finalResult(score.percentage) };
}

export function buildResultRow(attempt: Attempt, exam = loadExam()): Record<string, string | number> {
  const score = scoreAttempt(attempt, exam);
  const row: Record<string, string | number> = {
    ExamName: attempt.examName, CandidateName: attempt.candidateName, PhoneNumber: attempt.phoneNumber,
    StartedAt: new Date(attempt.startedAt).toISOString(), SubmittedAt: new Date(attempt.submittedAt || Date.now()).toISOString(),
    SubmissionReason: attempt.submissionReason || "manual", Score: `${score.correct}/${score.total}`,
    Percentage: score.percentage, FinalResult: finalResult(score.percentage),
  };
  exam.questions.forEach((question, index) => {
    const answer = attempt.answers[question.id]; row[`Q${index + 1} Answer`] = answer?.selectedAnswer || "Not answered";
    row[`Q${index + 1} Correct`] = answer ? (answer.isCorrect ? "Correct" : "Wrong") : "Not answered";
  });
  return row;
}

function appendResultRow(attempt: Attempt) {
  const row = buildResultRow(attempt);
  let rows: Record<string, unknown>[] = [];
  if (fs.existsSync(resultsPath)) {
    const workbook = XLSX.readFile(resultsPath); const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  }
  rows.push(row); const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Results");
  XLSX.writeFile(workbook, resultsPath);
}

