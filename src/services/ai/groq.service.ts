import OpenAI from "openai"

/**
 * Groq Vision Service
 * Uses Llama 3.2 Vision models via Groq's OpenAI-compatible API.
 */

const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null

  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  })
}

export const analyzeImageWithGroq = async (args: {
  imageAsBase64: string
  mimeType: string
  prompt: string
  model?: string
}) => {
  const client = getGroqClient()
  if (!client) {
    throw new Error("GROQ_API_KEY is not configured")
  }

  const model = args.model ?? "meta-llama/llama-4-scout-17b-16e-instruct"

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: args.prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${args.mimeType};base64,${args.imageAsBase64}`,
            },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  })

  return response.choices[0]?.message?.content || ""
}
