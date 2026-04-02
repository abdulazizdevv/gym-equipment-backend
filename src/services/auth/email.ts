export type CanonicalEmail = {
  raw: string;
  canonical: string;
};

// No strict validation: user is responsible for correct email.
// We only:
// - trim spaces
// - lowercase ONLY the domain part if `@` exists
export const canonicalizeEmail = (email: string): CanonicalEmail => {
  const raw = String(email ?? "").trim();
  const at = raw.lastIndexOf("@");

  if (at > 0 && at < raw.length - 1) {
    const local = raw.slice(0, at);
    const domain = raw.slice(at + 1);
    return { raw, canonical: `${local}@${domain.toLowerCase()}` };
  }

  // If it's not a typical email, keep canonical same as raw.
  return { raw, canonical: raw };
};

