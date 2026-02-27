"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface PendingInvite {
 id: string;
 firstName: string | null;
 lastName: string | null;
 email: string;
 accessLevel: string | null;
 status: string;
 createdAt: string;
 inviteUrl?: string;
}

const ACCESS_LEVELS = [
 {
 value: "full",
 label: "Full Access",
 desc: "Complete app access — training, throws, wellness, progress, and more",
 icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
 color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700",
 },
 {
 value: "throws_only",
 label: "Podium Throws Only",
 desc: "Throws sessions, profile, PRs, and check-ins — no general training",
 icon: "M13 10V3L4 14h7v7l9-11h-7z",
 color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700",
 },
 {
 value: "prescribed",
 label: "Prescribed Only",
 desc: "Only sees sessions and content you assign — most restrictive",
 icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
 color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700",
 },
];

export default function ThrowsInvitePage() {
 const [firstName, setFirstName] = useState("");
 const [lastName, setLastName] = useState("");
 const [accessLevel, setAccessLevel] = useState("full");
 const [loading, setLoading] = useState(false);
 const [generatedLink, setGeneratedLink] = useState("");
 const [copied, setCopied] = useState(false);
 const [error, setError] = useState("");
 const [recentInvites, setRecentInvites] = useState<PendingInvite[]>([]);
 const [loadingInvites, setLoadingInvites] = useState(true);

 useEffect(() => {
 fetch("/api/invitations")
 .then((r) => r.json())
 .then((data) => {
 if (data.success) {
 setRecentInvites(
 data.data
 .filter((inv: PendingInvite) => inv.firstName && inv.lastName)
 .slice(0, 10)
 );
 }
 })
 .catch(() => {})
 .finally(() => setLoadingInvites(false));
 }, []);

 async function handleGenerate(e: React.FormEvent) {
 e.preventDefault();
 setError("");
 setGeneratedLink("");
 setCopied(false);
 setLoading(true);

 try {
 const res = await fetch("/api/invitations", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 firstName: firstName.trim(),
 lastName: lastName.trim(),
 accessLevel,
 sport: "Throws",
 }),
 });
 const data = await res.json();
 if (data.success) {
 const baseUrl = window.location.origin;
 const token = data.data.token;
 const link = `${baseUrl}/register?invite=${token}`;
 setGeneratedLink(link);
 setRecentInvites((prev) => [{ ...data.data, inviteUrl: link }, ...prev]);
 setFirstName("");
 setLastName("");
 } else {
 setError(data.error || "Failed to generate invite link");
 }
 } catch {
 setError("Something went wrong. Please try again.");
 } finally {
 setLoading(false);
 }
 }

 async function copyLink(link?: string) {
 const url = link || generatedLink;
 try {
 await navigator.clipboard.writeText(url);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 } catch {
 // Fallback
 const input = document.createElement("input");
 input.value = url;
 document.body.appendChild(input);
 input.select();
 document.execCommand("copy");
 document.body.removeChild(input);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 }
 }

 return (
 <div className="animate-spring-up space-y-6 max-w-2xl mx-auto">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">
 Invite Athlete
 </h1>
 <p className="text-sm text-[var(--color-text-2)]">
 Generate a unique link to send to your athlete
 </p>
 </div>
 <Link
 href="/coach/throws"
 className="text-sm text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] hover:text-[var(--color-gold-dark)] font-medium"
 >
 Throws Dashboard
 </Link>
 </div>

 {/* Invite Form */}
 <form onSubmit={handleGenerate} className="card space-y-5">
 <div className="flex items-center gap-3 mb-1">
 <div className="w-10 h-10 rounded-xl bg-[rgba(212,168,67,0.12)] flex items-center justify-center">
 <svg className="w-5 h-5 text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
 </svg>
 </div>
 <div>
 <h2 className="text-base font-semibold text-[var(--color-text)]">
 New Athlete Invite
 </h2>
 <p className="text-xs text-[var(--color-text-2)]">
 Enter their name and choose what they can access
 </p>
 </div>
 </div>

 {/* Name inputs */}
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label htmlFor="firstName" className="label">First Name</label>
 <input
 id="firstName"
 className="input"
 value={firstName}
 onChange={(e) => setFirstName(e.target.value)}
 placeholder="e.g. John"
 required
 />
 </div>
 <div>
 <label htmlFor="lastName" className="label">Last Name</label>
 <input
 id="lastName"
 className="input"
 value={lastName}
 onChange={(e) => setLastName(e.target.value)}
 placeholder="e.g. Doe"
 required
 />
 </div>
 </div>

 {/* Access Level */}
 <div>
 <label className="label mb-2">Access Level</label>
 <div className="space-y-2">
 {ACCESS_LEVELS.map((level) => (
 <button
 key={level.value}
 type="button"
 onClick={() => setAccessLevel(level.value)}
 className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
 accessLevel === level.value
 ? level.color + " border-current"
 : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
 }`}
 >
 <div className="flex items-center gap-3">
 <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={level.icon} />
 </svg>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold">{level.label}</p>
 <p className={`text-xs mt-0.5 ${
 accessLevel === level.value ? "opacity-80" : "text-[var(--color-text-2)]"
 }`}>
 {level.desc}
 </p>
 </div>
 {accessLevel === level.value && (
 <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
 </svg>
 )}
 </div>
 </button>
 ))}
 </div>
 </div>

 {error && (
 <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
 {error}
 </div>
 )}

 <button
 type="submit"
 disabled={loading || !firstName.trim() || !lastName.trim()}
 className="btn-primary w-full"
 >
 {loading ? "Generating..." : "Generate Invite Link"}
 </button>
 </form>

 {/* Generated Link */}
 {generatedLink && (
 <div className="card border-2 border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10">
 <div className="flex items-center gap-2 mb-3">
 <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">
 Invite Link Ready!
 </h3>
 </div>
 <div className="flex gap-2">
 <input
 type="text"
 readOnly
 value={generatedLink}
 className="input text-xs flex-1 font-mono bg-[var(--color-surface)]"
 onClick={(e) => (e.target as HTMLInputElement).select()}
 />
 <button
 onClick={() => copyLink()}
 className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-shrink-0 ${
 copied
 ? "bg-green-600 text-white"
 : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/60"
 }`}
 >
 {copied ? "Copied!" : "Copy"}
 </button>
 </div>
 <p className="text-xs text-green-600 dark:text-green-500 mt-2">
 Share this link with your athlete. It expires in 30 days.
 </p>
 </div>
 )}

 {/* Recent Invites */}
 <div className="card">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-base font-semibold text-[var(--color-text)]">
 Recent Invites
 </h2>
 <Link
 href="/coach/settings"
 className="text-xs text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] hover:underline"
 >
 All invitations
 </Link>
 </div>

 {loadingInvites ? (
 <div className="space-y-3">
 {[1, 2].map((i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
 </div>
 ) : recentInvites.length === 0 ? (
 <p className="text-sm text-[var(--color-text-3)] text-center py-6">
 No invites sent yet. Generate one above!
 </p>
 ) : (
 <div className="space-y-2">
 {recentInvites.map((inv) => {
 const level = ACCESS_LEVELS.find((l) => l.value === (inv.accessLevel || "full"));
 const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
 const linkUrl = inv.inviteUrl || `${baseUrl}/register?invite=${(inv as PendingInvite & { token?: string }).token || ""}`;

 return (
 <div
 key={inv.id}
 className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface-2)]"
 >
 <div className="w-9 h-9 rounded-full bg-[rgba(212,168,67,0.12)] flex items-center justify-center text-xs font-bold text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)]">
 {(inv.firstName || "?")[0]}{(inv.lastName || "?")[0]}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-[var(--color-text)] truncate">
 {inv.firstName} {inv.lastName}
 </p>
 <div className="flex items-center gap-2">
 <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
 inv.status === "ACCEPTED"
 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
 : inv.status === "EXPIRED"
 ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
 : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
 }`}>
 {inv.status}
 </span>
 {level && (
 <span className="text-[10px] text-[var(--color-text-3)]">
 {level.label}
 </span>
 )}
 </div>
 </div>
 {inv.status === "PENDING" && (
 <button
 onClick={() => copyLink(linkUrl)}
 className="text-xs font-medium text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] hover:text-[var(--color-gold-dark)] px-2 py-1 rounded hover:bg-[rgba(212,168,67,0.08)] transition-colors"
 >
 Copy Link
 </button>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 );
}
