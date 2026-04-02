import bcrypt from "bcryptjs";

const getSaltRounds = (): number => {
  const raw = process.env.BCRYPT_SALT_ROUNDS;
  const parsed = raw ? Number(raw) : 10;
  if (Number.isNaN(parsed) || parsed < 6 || parsed > 15) return 10;
  return parsed;
};

export const hashPassword = async (password: string): Promise<string> => {
  const rounds = getSaltRounds();
  return await bcrypt.hash(password, rounds);
};

export const verifyPassword = async (
  password: string,
  passwordHash: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, passwordHash);
};

