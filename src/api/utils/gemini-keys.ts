/**
 * Sequential Gemini API keys.
 * Every request starts with the first key (index 0).
 * If a key fails (e.g. rate limit), the next key in the array is tried.
 */
export const GEMINI_API_KEYS: string[] = (process.env.GEMINI_API_KEYS || "")
  .split(",")
  .map((k) => k.trim())
  .filter((k) => k.length > 0)

if (GEMINI_API_KEYS.length === 0) {
  console.warn(
    "WARNING: No Gemini API keys found in GEMINI_API_KEYS environment variable.",
  )
}
