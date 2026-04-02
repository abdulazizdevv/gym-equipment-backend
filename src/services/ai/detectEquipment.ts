export type EquipmentImage = {
  // File public URL (e.g. "/uploads/<name>") - backend static serves it.
  url: string;
};

export type EquipmentAnalysisResult = {
  equipment: {
    name: string;
    confidence?: number;
  };
  muscles: string[];
  usage: {
    steps: string[];
    cues: string[];
    commonMistakes: string[];
  };
  tips: string[];
  images: Array<{
    url: string;
    caption?: string;
  }>;
};

type DetectEquipmentArgs = {
  image?: EquipmentImage;
  question?: string;
  // Full previous structured turns (search results etc).
  history?: Array<Record<string, any>>;
};

// Temporary mock implementation:
// - It returns a structured response so the rest of the backend flow works.
// - Later you can replace the body with a real AI provider call.
export const detectEquipment = async (
  args: DetectEquipmentArgs,
): Promise<EquipmentAnalysisResult> => {
  const imageUrl = args.image?.url ?? null;

  return {
    equipment: {
      name: "Unknown equipment (mock)",
      confidence: 0.1,
    },
    muscles: ["full body"],
    usage: {
      steps: [
        "Set up the equipment safely (check stability and grip).",
        "Start with a comfortable weight range and controlled motion.",
        "Keep your posture stable throughout the exercise.",
        "Perform reps slowly, focusing on form rather than speed.",
      ],
      cues: [
        "Maintain a neutral spine and stable core.",
        "Use controlled tempo; avoid jerking.",
        "Breathe steadily and stay within comfortable range of motion.",
      ],
      commonMistakes: [
        "Using too much weight too early.",
        "Rounding the back or collapsing posture.",
        "Going through the motion too fast without control.",
      ],
    },
    tips: [
      "If you feel pain (sharp or joint pain), stop and reassess technique.",
      "Start with light resistance and increase gradually.",
      "Warm up 5-10 minutes before using the equipment.",
    ],
    images: imageUrl
      ? [
          {
            url: imageUrl,
            caption: "Uploaded image (mock).",
          },
        ]
      : [],
  };
};

