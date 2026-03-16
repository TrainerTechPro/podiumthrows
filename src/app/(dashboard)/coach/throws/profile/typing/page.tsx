"use client";

import { useState } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import { useSearchParams, useRouter } from "next/navigation";
import {
 TYPING_QUIZZES,
 type TypingQuizId,
 type QuizQuestion,
} from "@/lib/throws/profile-constants";

const QUIZ_ORDER: TypingQuizId[] = [
 "adaptationSpeed",
 "transferType",
 "selfFeeling",
 "lightImpl",
 "recovery",
];

export default function TypingQuizPage() {
 const searchParams = useSearchParams();
 const router = useRouter();
 const athleteId = searchParams.get("athleteId");

 const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
 const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
 const [allResponses, setAllResponses] = useState<Record<string, Record<string, number>[]>>({});
 const [saving, setSaving] = useState(false);
 const [done, setDone] = useState(false);

 if (!athleteId) {
 return (
 <div className="animate-spring-up card text-center py-12">
 <p className="text-[var(--color-text-3)]">No athlete selected. Go back and select an athlete.</p>
 </div>
 );
 }

 const quizId = QUIZ_ORDER[currentQuizIdx];
 const quiz = TYPING_QUIZZES[quizId];
 const questions: QuizQuestion[] = quiz.questions as unknown as QuizQuestion[];
 const currentQuestion = questions[currentQuestionIdx];
 const totalQuestions = QUIZ_ORDER.reduce((sum, id) => sum + (TYPING_QUIZZES[id].questions as unknown as QuizQuestion[]).length, 0);
 const answeredSoFar =
 QUIZ_ORDER.slice(0, currentQuizIdx).reduce(
 (sum, id) => sum + (TYPING_QUIZZES[id].questions as unknown as QuizQuestion[]).length,
 0,
 ) + currentQuestionIdx;

 async function handleSelect(score: Record<string, number>) {
 const quizKey = QUIZ_ORDER[currentQuizIdx];
 const updated = { ...allResponses };
 if (!updated[quizKey]) updated[quizKey] = [];
 updated[quizKey] = [...updated[quizKey], score];
 setAllResponses(updated);

 // Move to next question or next quiz
 if (currentQuestionIdx < questions.length - 1) {
 setCurrentQuestionIdx(currentQuestionIdx + 1);
 } else if (currentQuizIdx < QUIZ_ORDER.length - 1) {
 setCurrentQuizIdx(currentQuizIdx + 1);
 setCurrentQuestionIdx(0);
 } else {
 // All done — save
 setSaving(true);
 try {
 const res = await fetch("/api/throws/typing", {
 method: "POST",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({
 athleteId,
 quizResponses: updated,
 }),
 });
 const data = await res.json();
 if (data.success) {
 setDone(true);
 }
 } catch {
 // Allow retry
 }
 setSaving(false);
 }
 }

 if (done) {
 return (
 <div className="animate-spring-up space-y-6">
 <div className="card text-center py-12 space-y-4">
 <div className="text-4xl">&#10003;</div>
 <h2 className="text-xl font-bold text-[var(--color-text)]">Typing Complete</h2>
 <p className="text-sm text-[var(--color-text-2)]">
 The athlete&apos;s Bondarchuk typing has been saved. Classification will refine automatically as training data accumulates.
 </p>
 <button
 onClick={() => router.push(`/coach/throws/profile?athleteId=${athleteId}`)}
 className="btn-primary"
 >
 View Profile
 </button>
 </div>
 </div>
 );
 }

 if (saving) {
 return (
 <div className="animate-spring-up card text-center py-12">
 <div className="skeleton h-6 w-48 mx-auto mb-4" />
 <p className="text-[var(--color-text-3)]">Saving typing results...</p>
 </div>
 );
 }

 return (
 <div className="animate-spring-up space-y-6">
 {/* Header */}
 <div>
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">
 Bondarchuk Athlete Typing
 </h1>
 <p className="text-sm text-[var(--color-text-2)]">
 Assessment {currentQuizIdx + 1} of {QUIZ_ORDER.length}: {quiz.title}
 </p>
 </div>

 {/* Progress bar */}
 <div className="w-full bg-[var(--color-bg-subtle)] rounded-full h-2">
 <div
 className="bg-[var(--color-gold)] h-2 rounded-full transition-all duration-300"
 style={{ width: `${(answeredSoFar / totalQuestions) * 100}%` }}
 />
 </div>

 {/* Question card */}
 <div className="card !p-6 space-y-6">
 <div className="flex items-center gap-2">
 <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[rgba(212,168,67,0.12)] text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)]">
 Q{currentQuestionIdx + 1}/{questions.length}
 </span>
 <span className="text-xs text-[var(--color-text-3)]">{quiz.title}</span>
 </div>

 <p className="text-base sm:text-lg font-medium text-[var(--color-text)] leading-relaxed">
 {currentQuestion.question}
 </p>

 <div className="space-y-3">
 {currentQuestion.options.map((option) => (
 <button
 key={option.value}
 onClick={() => handleSelect(option.score)}
 className="w-full text-left p-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-gold)] dark:hover:border-[var(--color-gold)] hover:bg-[rgba(212,168,67,0.08)] transition-all duration-150 group"
 >
 <span className="text-sm font-medium text-[var(--color-text)] group-hover:text-[var(--color-gold-dark)] dark:group-hover:text-[var(--color-gold)]">
 {option.label}
 </span>
 </button>
 ))}
 </div>
 </div>
 </div>
 );
}
