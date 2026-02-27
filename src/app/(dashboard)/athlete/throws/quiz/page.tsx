"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

export default function AthleteTypingQuizPage() {
 const router = useRouter();
 const [athleteId, setAthleteId] = useState<string | null>(null);
 const [loadingAthlete, setLoadingAthlete] = useState(true);
 const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
 const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
 const [allResponses, setAllResponses] = useState<Record<string, Record<string, number>[]>>({});
 const [pendingScore, setPendingScore] = useState<Record<string, number> | null>(null);
 const [saving, setSaving] = useState(false);
 const [done, setDone] = useState(false);

 useEffect(() => {
 fetch("/api/athletes")
 .then((r) => r.json())
 .then((data) => {
 if (data.success && data.data) {
 const athletes = Array.isArray(data.data) ? data.data : [data.data];
 if (athletes[0]?.id) {
 setAthleteId(athletes[0].id);
 }
 }
 })
 .catch(() => {})
 .finally(() => setLoadingAthlete(false));
 }, []);

 const quizId = QUIZ_ORDER[currentQuizIdx];
 const quiz = TYPING_QUIZZES[quizId];
 const questions: QuizQuestion[] = quiz.questions as unknown as QuizQuestion[];
 const currentQuestion = questions[currentQuestionIdx];
 const totalQuestions = QUIZ_ORDER.reduce(
 (sum, id) => sum + (TYPING_QUIZZES[id].questions as unknown as QuizQuestion[]).length,
 0,
 );
 const answeredSoFar =
 QUIZ_ORDER.slice(0, currentQuizIdx).reduce(
 (sum, id) => sum + (TYPING_QUIZZES[id].questions as unknown as QuizQuestion[]).length,
 0,
 ) + currentQuestionIdx;

 const isFirstQuestion = currentQuizIdx === 0 && currentQuestionIdx === 0;
 const isLastQuestion =
 currentQuizIdx === QUIZ_ORDER.length - 1 &&
 currentQuestionIdx === questions.length - 1;

 function handleOptionClick(score: Record<string, number>) {
 // Stage the selection — user must tap "Next" to confirm
 setPendingScore(score);
 }

 async function handleNext() {
 if (!athleteId || !pendingScore) return;
 const score = pendingScore;
 setPendingScore(null);

 const quizKey = QUIZ_ORDER[currentQuizIdx];
 const updated = { ...allResponses };
 if (!updated[quizKey]) updated[quizKey] = [];
 updated[quizKey] = [...updated[quizKey], score];
 setAllResponses(updated);

 if (currentQuestionIdx < questions.length - 1) {
 setCurrentQuestionIdx(currentQuestionIdx + 1);
 } else if (currentQuizIdx < QUIZ_ORDER.length - 1) {
 setCurrentQuizIdx(currentQuizIdx + 1);
 setCurrentQuestionIdx(0);
 } else {
 setSaving(true);
 try {
 const res = await fetch("/api/throws/typing", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ athleteId, quizResponses: updated }),
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

 function handleBack() {
 setPendingScore(null);
 const updated = { ...allResponses };
 if (currentQuestionIdx > 0) {
 // Go back within the same quiz section
 const quizKey = QUIZ_ORDER[currentQuizIdx];
 if (updated[quizKey]?.length) {
 updated[quizKey] = updated[quizKey].slice(0, -1);
 setAllResponses(updated);
 }
 setCurrentQuestionIdx(currentQuestionIdx - 1);
 } else if (currentQuizIdx > 0) {
 // Go back to the last question of the previous quiz section
 const prevQuizId = QUIZ_ORDER[currentQuizIdx - 1];
 const prevQuestions = TYPING_QUIZZES[prevQuizId].questions as unknown as QuizQuestion[];
 const prevQuizKey = prevQuizId;
 if (updated[prevQuizKey]?.length) {
 updated[prevQuizKey] = updated[prevQuizKey].slice(0, -1);
 setAllResponses(updated);
 }
 setCurrentQuizIdx(currentQuizIdx - 1);
 setCurrentQuestionIdx(prevQuestions.length - 1);
 }
 }

 if (loadingAthlete) {
 return (
 <div className="animate-fade-in space-y-4">
 <div className="skeleton h-8 w-64" />
 <div className="skeleton h-48 rounded-xl" />
 </div>
 );
 }

 if (!athleteId) {
 return (
 <div className="animate-fade-in card text-center py-12">
 <p className="text-[var(--color-text-3)]">Could not load your profile. Please try again.</p>
 </div>
 );
 }

 if (done) {
 return (
 <div className="animate-fade-in space-y-6">
 <div className="card text-center py-12 space-y-4">
 <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
 <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 </div>
 <h2 className="text-xl font-bold text-[var(--color-text)]">Quiz Complete!</h2>
 <p className="text-sm text-[var(--color-text-2)] max-w-xs mx-auto">
 Your Bondarchuk athlete type has been determined. Your coach will use this to personalise your training program.
 </p>
 <button
 onClick={() => router.push("/athlete/throws/profile")}
 className="btn-primary"
 >
 View My Profile
 </button>
 </div>
 </div>
 );
 }

 if (saving) {
 return (
 <div className="animate-fade-in card text-center py-12">
 <p className="text-[var(--color-text-3)]">Saving your results...</p>
 </div>
 );
 }

 return (
 <div className="animate-fade-in space-y-6">
 {/* Header */}
 <div>
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">
 Athlete Typing Quiz
 </h1>
 <p className="text-sm text-[var(--color-text-2)]">
 Assessment {currentQuizIdx + 1} of {QUIZ_ORDER.length}: {quiz.title}
 </p>
 </div>

 {/* Progress bar */}
 <div className="space-y-1">
 <div className="flex justify-between text-xs text-[var(--color-text-3)]">
 <span>{answeredSoFar} of {totalQuestions} questions answered</span>
 <span>{Math.round((answeredSoFar / totalQuestions) * 100)}%</span>
 </div>
 <div className="w-full bg-[var(--color-bg-subtle)] rounded-full h-2">
 <div
 className="bg-[var(--color-gold)] h-2 rounded-full transition-all duration-300"
 style={{ width: `${(answeredSoFar / totalQuestions) * 100}%` }}
 />
 </div>
 </div>

 {/* Quiz steps */}
 <div className="flex gap-1">
 {QUIZ_ORDER.map((_, i) => (
 <div
 key={i}
 className={`flex-1 h-1 rounded-full transition-colors ${
 i < currentQuizIdx
 ? "bg-[var(--color-gold)]"
 : i === currentQuizIdx
 ? "bg-[rgba(212,168,67,0.3)]"
 : "bg-[var(--color-bg-subtle)]"
 }`}
 />
 ))}
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
 {currentQuestion.options.map((option) => {
 const isSelected = pendingScore !== null &&
 JSON.stringify(pendingScore) === JSON.stringify(option.score);
 return (
 <button
 key={option.value}
 onClick={() => handleOptionClick(option.score)}
 className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-150 group ${
 isSelected
 ? "border-[var(--color-gold)] bg-[rgba(212,168,67,0.08)]"
 : "border-[var(--color-border)] hover:border-[rgba(212,168,67,0.3)] dark:hover:border-[var(--color-gold)] hover:bg-[var(--color-surface-2)]/50"
 }`}
 >
 <div className="flex items-center gap-3">
 <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
 isSelected ? "border-[var(--color-gold)] bg-[var(--color-gold)]" : "border-[var(--color-border-strong)]"
 }`}>
 {isSelected && (
 <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
 </svg>
 )}
 </div>
 <span className={`text-sm font-medium ${
 isSelected ? "text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)]" : "text-[var(--color-text)]"
 }`}>
 {option.label}
 </span>
 </div>
 </button>
 );
 })}
 </div>

 {/* Navigation */}
 <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
 <button
 onClick={handleBack}
 disabled={isFirstQuestion}
 className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--color-text-2)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 Back
 </button>
 <button
 onClick={handleNext}
 disabled={!pendingScore || saving}
 className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[var(--color-gold)] hover:opacity-90 text-white text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
 >
 {saving ? "Saving..." : isLastQuestion ? "Submit" : "Next"}
 {!saving && !isLastQuestion && (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 )}
 </button>
 </div>
 </div>

 <p className="text-center text-xs text-[var(--color-text-3)]">
 Answer honestly — there are no right or wrong answers. Your coach uses this to optimise your training.
 </p>
 </div>
 );
}
