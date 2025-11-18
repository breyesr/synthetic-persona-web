// src/app/api/stress-test/prompt.ts

import { ChallengeLevel } from "@/lib/challengeLevels";

export function describeFocus(customLabel: string) {
  if (customLabel?.trim()) {
    return {
      label: customLabel.trim(),
      description: "Custom angle to stress-test per user input.",
    };
  }
  return {
    label: "General evaluation",
    description: "Holistic validation of the idea.",
  };
}

export function buildStressSystemPrompt(opts: {
  personaName: string;
  personaContext?: string;
  level: ChallengeLevel;
  focusLabel: string;
}) {
  const info = opts.level;
  const toneDescription =
    typeof info.tone === "string"
      ? info.tone
      : [
          info.tone?.style ? `Style: ${info.tone.style}` : "",
          Array.isArray(info.tone?.voiceRules)
            ? `Voice rules: ${info.tone.voiceRules.join("; ")}`
            : "",
        ]
          .filter(Boolean)
          .join(" | ");

  const questionStyle =
    typeof info.questionStyle === "string"
      ? info.questionStyle
      : [
          info.questionStyle?.tone ? `Tone: ${info.questionStyle.tone}` : "",
          Array.isArray(info.questionStyle?.examples)
            ? `Examples: ${info.questionStyle.examples.join(" | ")}`
            : "",
        ]
          .filter(Boolean)
          .join(" | ");

  const behaviorFlaws = Array.isArray(info.behavior?.flawDetection)
    ? info.behavior?.flawDetection.join(" • ")
    : "";

  const personaIntegration =
    typeof info.behavior?.personaIntegration === "string"
      ? info.behavior.personaIntegration
      : "";

  const useCaseAware =
    typeof info.behavior?.useCaseAwareness === "object" && info.behavior?.useCaseAwareness
      ? Object.entries(info.behavior.useCaseAwareness)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" | ")
      : "";

  return `
You are the Idea Stress Testing evaluator "${info.name}" channeling the buyer persona "${opts.personaName}".
Use their lived experience and context to react to marketing/GT ideas.

Challenge profile:
- Mission: ${info.purpose ?? info.guidance}
- Tone: ${toneDescription}
- Core behavior: ${behaviorFlaws}
- Persona integration: ${personaIntegration}
- Focus area provided by user: ${opts.focusLabel}
- Use-case considerations: ${useCaseAware}
- Question style: ${questionStyle}
- Never mention persona names or that you're role-playing. Speak as this evaluator archetype only.

Output format (JSON only):
{
  "summary": "2-sentence verdict in the specified tone",
  "strengths": ["bullet list tying positives to persona needs"],
  "gaps": ["bullet list of risks/flaws per persona"],
  "improvements": ["3-5 fixes tied to persona context"],
  "questions": ["2-4 questions following questionStyle"],
  "confidence": 0-100,
  "tone": "descriptor of the voice used"
}

Persona context for reference:
${opts.personaContext ?? "(none)"}
`.trim();
}

export function buildStressUserMessage(opts: {
  idea: string;
  goal: string;
  evaluationFocusKey: string;
}) {
  const focus = describeFocus(opts.evaluationFocusKey);
  return `
Idea to stress-test:
${opts.idea}

Goal / desired outcome:
${opts.goal}

Evaluation lens:
- Focus area: ${focus.label}
- What to emphasize: ${focus.description}
`.trim();
}
