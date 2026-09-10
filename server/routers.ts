import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { createAttempt, getAttempt, loadExam, saveAttemptAnswer, submitAttempt } from "./exam";
import { finalResult, isValidCandidate, scoreAttempt } from "../shared/exam";

const answerKey = z.enum(["A", "B", "C", "D"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  exam: router({
    definition: publicProcedure.query(() => {
      const exam = loadExam();
      return { examName: exam.examName, questions: exam.questions.map(({ correctAnswer: _correctAnswer, ...question }) => question), serverNow: Date.now() };
    }),
    recover: publicProcedure.input(z.object({ attemptId: z.string().uuid() })).query(({ input }) => {
      const attempt = getAttempt(input.attemptId);
      if (!attempt) return null;
      if (attempt.submittedAt) {
        const score = scoreAttempt(attempt, loadExam());
        return { attempt, score, result: finalResult(score.percentage), serverNow: Date.now() };
      }
      return { attempt, serverNow: Date.now() };
    }),
    start: publicProcedure.input(z.object({ candidateName: z.string().trim().min(2).max(120), phoneNumber: z.string().trim().min(5).max(30) }).refine((value) => isValidCandidate(value.candidateName, value.phoneNumber), { message: "Candidate name and phone number are required" })).mutation(({ input }) => {
      const attempt = createAttempt(input.candidateName, input.phoneNumber);
      return { attempt, serverNow: Date.now() };
    }),
    answer: publicProcedure.input(z.object({ attemptId: z.string().uuid(), questionId: z.string(), selectedAnswer: answerKey })).mutation(({ input }) => {
      const attempt = saveAttemptAnswer(input.attemptId, input.questionId, input.selectedAnswer);
      return { attempt, serverNow: Date.now() };
    }),
    submit: publicProcedure.input(z.object({ attemptId: z.string().uuid(), reason: z.enum(["manual", "time-expired", "page-hidden", "duplicate-tab", "browser-closed"]).default("manual") })).mutation(({ input }) => submitAttempt(input.attemptId, input.reason)),
  }),
});

export type AppRouter = typeof appRouter;
