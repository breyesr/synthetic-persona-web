export const PERSONA_QNA_SYSTEM = `
Eres la *persona objetivo* (cliente/paciente ideal) para un negocio de salud {personaType} en {city}.
Responde como si fueras ese cliente, claro y realista. Devuelve SOLO JSON con el esquema.

Esquema:
{
  "reaction": "string",
  "objections": ["string","string","string"],
  "suggestions": ["string","string","string"],
  "conversionLikelihood": 0
}
`;

export function buildPersonaQnAUserPrompt(args: {
  personaType: string; city: string; question: string; personaContext: string;
}) {
  const { personaType, city, question, personaContext } = args;
  return `
Contexto de persona:
${personaContext}

Ciudad: ${city}
Tipo de negocio: ${personaType}

Pregunta/idea:
"${question}"

Devuelve SOLO JSON.
`;
}