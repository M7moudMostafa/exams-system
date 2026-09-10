import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { randomUUID } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Clock3, LockKeyhole, Phone, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import type { AnswerKey, ExamQuestion } from "../../../shared/exam";

const ATTEMPT_KEY = "local-network-exam-attempt";
const ACTIVE_TAB_KEY = "local-network-exam-active-tab";
const optionKeys: AnswerKey[] = ["A", "B", "C", "D"];

function getOrderedQuestions(exam: { questions: ExamQuestion[] } | undefined, questionOrder?: string[]) {
  if (!exam) return [];
  if (!questionOrder?.length) return exam.questions;
  const byId = new Map(exam.questions.map((item) => [item.id, item]));
  return questionOrder.map((id) => byId.get(id)).filter(Boolean) as ExamQuestion[];
}

function getDisplayOptions(question: ExamQuestion, optionOrder: AnswerKey[] = optionKeys) {
  return optionKeys.map((label, index) => ({
    label,
    text: question.answers[optionKeys.indexOf(optionOrder[index]!)],
  }));
}

export default function Home() {
  const examQuery = trpc.exam.definition.useQuery(undefined, { retry: 1 });
  const recoverMutation = trpc.exam.recover.useQuery({ attemptId: localStorage.getItem(ATTEMPT_KEY) || "00000000-0000-0000-0000-000000000000" }, { enabled: Boolean(localStorage.getItem(ATTEMPT_KEY)), retry: false });
  const startMutation = trpc.exam.start.useMutation();
  const answerMutation = trpc.exam.answer.useMutation();
  const submitMutation = trpc.exam.submit.useMutation();
  const exam = examQuery.data;
  const [attempt, setAttempt] = useState<any>(null);
  const [candidateName, setCandidateName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<any>(null);
  const [startError, setStartError] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const restoredAttemptRef = useRef(false);
  const sessionStartedRef = useRef(false);
  const autoSubmittedRef = useRef(false);

  const orderedQuestions = useMemo(
    () => getOrderedQuestions(exam, attempt?.questionOrder),
    [exam, attempt?.questionOrder]
  );

  useEffect(() => {
    const recoveredResponse = recoverMutation.data;
    const recovered = recoveredResponse?.attempt;
    if (!recovered || restoredAttemptRef.current) return;

    if (sessionStartedRef.current && attempt?.id === recovered.id) {
      restoredAttemptRef.current = true;
      return;
    }

    restoredAttemptRef.current = true;
    if (!recovered.submittedAt) {
      setAttempt(recovered);
      setCandidateName(recovered.candidateName);
      setPhoneNumber(recovered.phoneNumber);
      const questions = getOrderedQuestions(exam, recovered.questionOrder);
      const firstUnanswered = questions.findIndex((item) => !recovered.answers[item.id]);
      if (firstUnanswered >= 0) setCurrentIndex(firstUnanswered);
    } else {
      setResult(recoveredResponse);
    }
  }, [recoverMutation.data, exam, attempt?.id]);

  useEffect(() => {
    if (!orderedQuestions.length) return;
    setCurrentIndex((index) => Math.min(index, orderedQuestions.length - 1));
  }, [orderedQuestions.length]);

  useEffect(() => {
    if (examQuery.data?.serverNow) setClockOffset(examQuery.data.serverNow - Date.now());
  }, [examQuery.data?.serverNow]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + clockOffset), 1000);
    return () => window.clearInterval(timer);
  }, [clockOffset]);

  useEffect(() => {
    if (!attempt || attempt.submittedAt) return;

    const autoSubmit = (reason: "page-hidden" | "duplicate-tab" | "browser-closed") => {
      if (autoSubmittedRef.current) return;
      autoSubmittedRef.current = true;
      if (reason === "browser-closed") {
        const input = JSON.stringify({ "0": { json: { attemptId: attempt.id, reason } } });
        void fetch("/api/trpc/exam.submit?batch=1", { method: "POST", headers: { "content-type": "application/json" }, body: input, keepalive: true, credentials: "same-origin" });
        return;
      }
      submitMutation.mutate({ attemptId: attempt.id, reason }, { onSuccess: (data) => setResult(data) });
    };

    const channel = "BroadcastChannel" in window ? new BroadcastChannel("local-network-exam") : null;
    const tabId = randomUUID();
    const previous = localStorage.getItem(ACTIVE_TAB_KEY);
    if (previous && previous !== tabId) {
      setDuplicate(true);
      autoSubmit("duplicate-tab");
    }
    localStorage.setItem(ACTIVE_TAB_KEY, tabId);
    channel?.postMessage({ type: "exam-opened", tabId });
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "exam-opened" && event.data.tabId !== tabId) {
        setDuplicate(true);
        autoSubmit("duplicate-tab");
      }
    };
    channel?.addEventListener("message", onMessage);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") autoSubmit("page-hidden");
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", () => autoSubmit("browser-closed"));
    window.addEventListener("beforeunload", () => autoSubmit("browser-closed"));
    return () => {
      channel?.removeEventListener("message", onMessage);
      channel?.close();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [attempt?.id]);

  useEffect(() => {
    if (!attempt || attempt.submittedAt || now < attempt.deadlineAt) return;
    submitMutation.mutate({ attemptId: attempt.id, reason: "time-expired" }, { onSuccess: (data) => setResult(data) });
  }, [now, attempt?.deadlineAt, attempt?.submittedAt]);

  const question = orderedQuestions[currentIndex];
  const remaining = attempt ? Math.max(0, attempt.deadlineAt - now) : 0;
  const answeredCount = attempt ? Object.keys(attempt.answers || {}).length : 0;
  const progress = orderedQuestions.length ? Math.round((answeredCount / orderedQuestions.length) * 100) : 0;
  const deadlineLabel = attempt ? new Date(attempt.deadlineAt).toLocaleString([], { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" }) : "today at 3:55 PM";
  const currentAnswer = question && attempt?.answers?.[question.id];
  const optionOrder = question ? attempt?.optionOrders?.[question.id] ?? optionKeys : optionKeys;
  const displayOptions = question ? getDisplayOptions(question, optionOrder) : [];
  const selectedLabel = currentAnswer
    ? optionKeys[optionOrder.indexOf(currentAnswer.selectedAnswer)]
    : null;
  const isStarted = Boolean(attempt && !result);
  const isLastQuestion = currentIndex === orderedQuestions.length - 1;

  const goToQuestion = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(orderedQuestions.length - 1, index)));
  };

  const startExam = async (event: FormEvent) => {
    event.preventDefault(); setStartError("");
    if (candidateName.trim().length < 2 || phoneNumber.trim().length < 5) { setStartError("Please enter a valid name and phone number before continuing."); return; }
    try {
      const created = await startMutation.mutateAsync({ candidateName: candidateName.trim(), phoneNumber: phoneNumber.trim() });
      localStorage.setItem(ATTEMPT_KEY, created.attempt.id);
      sessionStartedRef.current = true;
      setAttempt(created.attempt);
      setCurrentIndex(0);
      try { await document.documentElement.requestFullscreen(); } catch { /* Fullscreen requires a user gesture and may be unavailable on some phones. */ }
    } catch { setStartError("The exam could not start. Check that the local server is reachable and try again."); }
  };

  const chooseAnswer = (selectedAnswer: AnswerKey) => {
    if (!attempt || attempt.submittedAt || answerMutation.isPending) return;
    if (!question) {
      setCurrentIndex((index) => Math.max(0, orderedQuestions.length - 1));
      return;
    }

    const displayOrder = attempt.optionOrders?.[question.id] ?? optionKeys;
    const originalKey = displayOrder[optionKeys.indexOf(selectedAnswer)] ?? selectedAnswer;
    const optimisticAnswer = {
      questionId: question.id,
      selectedAnswer: originalKey,
      isCorrect: false,
      answeredAt: Date.now(),
    };

    setAttempt((current: any) =>
      current ? { ...current, answers: { ...current.answers, [question.id]: optimisticAnswer } } : current
    );

    answerMutation.mutate(
      { attemptId: attempt.id, questionId: question.id, selectedAnswer },
      {
        onSuccess: (data) => setAttempt(data.attempt),
        onError: () => {
          setAttempt((current: any) => {
            if (!current) return current;
            const answers = { ...current.answers };
            delete answers[question.id];
            return { ...current, answers };
          });
        },
      }
    );
  };

  const finishExam = () => {
    if (!attempt) return;
    submitMutation.mutate({ attemptId: attempt.id, reason: "manual" }, { onSuccess: (data) => { setResult(data); localStorage.removeItem(ATTEMPT_KEY); } });
  };

  if (examQuery.isLoading) return <div className="loading-screen"><div className="brand-mark"><Sparkles size={18} /></div><p>Loading your exam room…</p></div>;
  if (examQuery.error || !exam) return <div className="loading-screen"><AlertCircle size={32} /><p>Question workbook unavailable. Please ask the exam administrator to check data/questions.xlsx.</p></div>;

  if (result) return <ResultView result={result} examName={exam.examName} />;

  if (!isStarted) return <main className="app-shell"><section className="welcome-grid"><div className="welcome-copy"><div className="eyebrow"><span className="pulse-dot" /> SECURE EXAM ROOM</div><h1>Focus on the questions.<br /><em>We’ll keep time.</em></h1><p className="lead">A calm, distraction-free assessment experience built for your local network. Your progress is saved as you go.</p><div className="feature-stack"><div><ShieldCheck size={18} /><span><strong>Protected attempt</strong><small>Answers are recorded safely as you work.</small></span></div><div><Clock3 size={18} /><span><strong>Live timekeeper</strong><small>Ends automatically at {deadlineLabel}.</small></span></div><div><LockKeyhole size={18} /><span><strong>One question at a time</strong><small>Designed for phones, tablets, and desktops.</small></span></div></div></div><div className="start-card"><div className="card-kicker">{exam.examName}</div><h2>Enter the exam room</h2><p className="muted">Please confirm your details before we begin.</p><form onSubmit={startExam} className="candidate-form"><div><Label htmlFor="candidate-name">Full name</Label><div className="input-wrap"><UserRound size={18} /><Input id="candidate-name" value={candidateName} onChange={(event) => setCandidateName(event.target.value)} placeholder="e.g. Samir Hassan" autoComplete="name" /></div></div><div><Label htmlFor="phone-number">Phone number</Label><div className="input-wrap"><Phone size={18} /><Input id="phone-number" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="e.g. 010 1234 5678" inputMode="tel" autoComplete="tel" /></div></div>{startError && <div className="form-error"><AlertCircle size={16} />{startError}</div>}<Button type="submit" className="start-button" disabled={startMutation.isPending}>{startMutation.isPending ? "Preparing exam…" : "Start exam"}<ArrowRight size={18} /></Button></form><p className="privacy-note">Your name and phone number are used only to identify this exam result.</p></div></section></main>;

  return <main className="exam-shell"><header className="exam-header"><div className="header-brand"><div className="brand-mark"><Sparkles size={17} /></div><div><strong>{exam.examName}</strong><small>{candidateName}</small></div></div><div className="timer-card"><Clock3 size={17} /><span><small>TIME REMAINING</small><strong className={remaining < 300000 ? "urgent" : ""}>{formatTimer(remaining)}</strong></span></div></header><section className="exam-content"><div className="exam-topline"><div><span className="eyebrow">QUESTION {currentIndex + 1} OF {orderedQuestions.length}</span><h2>Choose the best answer</h2></div><Badge variant="secondary">{answeredCount} answered</Badge></div><Progress value={progress} className="exam-progress" /><div className="question-layout"><article className="question-card"><div className="question-number">{String(currentIndex + 1).padStart(2, "0")}</div><p className="question-text">{question?.question}</p><div className="answer-list">{displayOptions.map((option) => { const selected = selectedLabel === option.label; return <button key={option.label} type="button" className={`answer-option ${selected ? "selected" : ""}`} onClick={() => chooseAnswer(option.label)}><span className="answer-key">{option.label}</span><span>{option.text}</span>{selected && <CheckCircle2 className="answer-state" size={19} />}</button>; })}</div><div className="question-actions"><Button variant="outline" onClick={() => goToQuestion(currentIndex - 1)} disabled={currentIndex === 0}><ArrowLeft size={17} /> Previous</Button>{isLastQuestion ? <Button onClick={finishExam} disabled={submitMutation.isPending}>{submitMutation.isPending ? "Submitting…" : "Submit exam"}<CheckCircle2 size={17} /></Button> : <Button onClick={() => goToQuestion(currentIndex + 1)}>Next question <ArrowRight size={17} /></Button>}</div></article><aside className="question-nav"><p className="nav-label">Question map</p><div className="nav-grid">{orderedQuestions.map((item, index) => <button key={`${item.id}-${index}`} type="button" className={`${index === currentIndex ? "active" : ""} ${attempt.answers[item.id] ? "answered" : ""}`} onClick={() => goToQuestion(index)}>{index + 1}</button>)}</div><div className="legend"><span><i className="legend-current" /> Current</span><span><i className="legend-done" /> Answered</span></div></aside></div></section>{(duplicate || remaining === 0) && <div className="overlay-warning"><AlertCircle size={20} /><span>{duplicate ? "This attempt was submitted because it opened in another tab or left the exam." : "Time has ended. Submitting your exam…"}</span></div>}</main>;
}

function formatTimer(ms: number) { const total = Math.floor(ms / 1000); return `${String(Math.floor(total / 3600)).padStart(2, "0")}:${String(Math.floor((total % 3600) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }

function ResultView({ result, examName }: { result: any; examName: string }) {
  const score = result.score; const attempt = result.attempt;
  return <main className="result-shell"><div className="result-card"><div className="result-icon"><CheckCircle2 size={30} /></div><span className="eyebrow">EXAM COMPLETE</span><h1>{result.result || "Submission received"}</h1><p className="lead">Your answers for <strong>{examName}</strong> have been recorded.</p><div className="score-grid"><div><strong>{score?.correct ?? "—"}</strong><span>Correct</span></div><div><strong>{score ? `${score.percentage}%` : "—"}</strong><span>Score</span></div><div><strong>{score?.answered ?? "—"}</strong><span>Answered</span></div></div><div className="result-meta"><span><UserRound size={16} />{attempt?.candidateName}</span><span><Phone size={16} />{attempt?.phoneNumber}</span><span><Clock3 size={16} />{attempt?.submissionReason || "manual"}</span></div><div className="host-only-note"><LockKeyhole size={16} /><span>Your result has been recorded. The detailed results workbook is securely retained by the exam administrator on the host computer.</span></div><p className="privacy-note">Please contact the administrator if you need your score summary.</p></div></main>;
}
