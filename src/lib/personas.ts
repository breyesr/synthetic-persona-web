import type { PersonaType } from "./benchmarks";

type PersonaSeed = { name: string; channels: string[]; pains: string[]; habits: string[]; regionNotes: string[]; };

export const PERSONAS: Record<PersonaType, PersonaSeed> = {
  nutriologa: {
    name: "Lic. Mariana la Nutrióloga",
    channels: ["Instagram","WhatsApp","TikTok","Google Reviews"],
    pains: ["retención baja","ads caros","competencia de coaches"],
    habits: ["WhatsApp seguimiento","promos estacionales","reels educativos"],
    regionNotes: ["Enero pico; baja en abril/diciembre","GDL pide seguimiento por WhatsApp"],
  },
  odontologa: {
    name: "Dra. Karla la Odontóloga",
    channels: ["Google Ads","Instagram","Doctoralia","WhatsApp"],
    pains: ["no-shows","aceptación de tratamientos","costos Google"],
    habits: ["valoración","reseñas Google","recordatorios WA"],
    regionNotes: ["CDMX reputación online crítica","MTY sensible a no-shows"],
  },
  psicologo: {
    name: "Lic. Andrés el Psicólogo",
    channels: ["Doctoralia","Google Maps","WhatsApp","Instagram"],
    pains: ["cancelaciones","ética publicitaria","competencia no regulada"],
    habits: ["agendar por WA","reseñas Doctoralia","contenido educativo"],
    regionNotes: ["GDL valida por WA","Puebla: adolescentes por escuela"],
  },
  fisioterapeuta: {
    name: "Lic. Jorge el Fisioterapeuta",
    channels: ["Google Business","Referidos médicos","Instagram","WhatsApp"],
    pains: ["abandono antes de completar","diferenciación","estacionalidad"],
    habits: ["alianzas con ortopedistas","tips de ejercicios","paquetes"],
    regionNotes: ["CDMX busca en Maps","Puebla convenios con gimnasios"],
  },
  estetica: {
    name: "Dra. Fernanda la Estética",
    channels: ["Instagram Ads","TikTok","WhatsApp","Doctoralia"],
    pains: ["estacionalidad","ROI en ads","expectativas irreales"],
    habits: ["antes/después","promos fechas clave","CM freelance"],
    regionNotes: ["GDL: IG es sala de espera","MTY: MSI importa"],
  },
};

export function buildPersonaContext(personaType: PersonaType, city: string) {
  const p = PERSONAS[personaType];
  return `Nombre: ${p.name}
Canales: ${p.channels.join(", ")}
Pains: ${p.pains.join(", ")}
Hábitos: ${p.habits.join(", ")}
Notas regionales: ${p.regionNotes.join(" | ")}
Ciudad del caso: ${city}`;
}