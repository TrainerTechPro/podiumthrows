// Shared in-memory store for password reset tokens.
// In production, replace with a database-backed PasswordResetToken model.
export const resetTokens = new Map<string, { userId: string; expiresAt: Date }>();
