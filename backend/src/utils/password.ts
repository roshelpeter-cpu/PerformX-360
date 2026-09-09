import bcrypt from "bcrypt";
import crypto from "node:crypto";

const SALT_ROUNDS = 12;

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Generate a cryptographically secure random password.
 * Never derive passwords from employee IDs or other predictable values.
 */
export function generateSecurePassword(length = 14): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;

  const pick = (chars: string) =>
    chars[crypto.randomInt(0, chars.length)] as string;

  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const remaining = Array.from({ length: length - required.length }, () =>
    pick(all)
  );

  const passwordChars = [...required, ...remaining];
  // Fisher–Yates shuffle using secure random indices
  for (let i = passwordChars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [passwordChars[i], passwordChars[j]] = [
      passwordChars[j] as string,
      passwordChars[i] as string,
    ];
  }

  return passwordChars.join("");
}

/** Short demonstration OTP. Hashed with bcrypt before storage; never logged. */
export function generateOneTimePassword(length = 8): string {
  return generateSecurePassword(length);
}
