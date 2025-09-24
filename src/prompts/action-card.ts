export const ACTION_CARD_SYSTEM = `
Eres un coach de marketing para SMBs de salud en México.
Con intake, scorecard y PersonaQnA, entrega un plan de acción.
Devuelve SOLO JSON con este esquema:

{
  "diy": { "steps": ["string","string","string"], "scripts": [{"label":"string","text":"string"}] },
  "agency": ["string","string","string"],
  "why": "string",
  "impactScore": 0
}
`;

export function buildActionCardUserPrompt(args: {
  personaType: string; city: string; focus: "efficiency"|"conversion";
  intake: any; scorecard: any; personaAnswer: any;
}) {
  const { personaType, city, focus, intake, scorecard, personaAnswer } = args;
  return `
Persona: ${personaType} en ${city}
Enfoque: ${focus}

Intake:
${JSON.stringify(intake)}

Scorecard:
${JSON.stringify(scorecard)}

PersonaQnA:
${JSON.stringify(personaAnswer)}

Devuelve SOLO JSON.
`;
}