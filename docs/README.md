# Synthetic Persona Web — Docs

MVP que convierte pocos inputs en:
1. **Scorecard** en español sencillo (con números reales).
2. **Persona Q&A** que responde la pregunta exacta en primera persona.
3. **Insights** accionables (pasos, impacto, KPIs y “cómo hablarle”).

---

## Quickstart (local)

```bash
npm install
PORT=3001 npm run dev
# abrir: http://localhost:3001
```

---

## Piezas clave

- **`src/app/api/scorecard/route.ts`**  
  Calcula métricas base y devuelve una narrativa de eficiencia.  
  Usa benchmarks de industria, inversión en anuncios y retorno esperado.  
  Llama a `buildAIDiagnostic` (en `aiNarrative.ts`) para generar un scorecard en español sencillo.  

- **`src/app/api/persona/route.ts`**  
  Maneja la lógica de Q&A.  
  - Construye un prompt para que la persona responda en primera persona (voz de cliente).  
  - Devuelve: reacción corta, respuesta directa a la pregunta, dudas, señales de confianza, probabilidad de conversión.  
  - Si hay datos numéricos, combina con `buildActionableInsights` para producir pasos accionables, impacto esperado, KPIs y tono de comunicación.  

- **`src/lib/aiNarrative.ts`**  
  Contiene la lógica central de generación narrativa e insights:  
  - `buildAIDiagnostic`: genera el scorecard (con fallback determinístico si no hay LLM).  
  - `buildActionableInsights`: sintetiza lo que pide la persona, qué hacer esta semana, impacto esperado, cómo saber si funcionó y cómo hablarle.  

- **`src/components/IntakeForm.tsx`**  
  Componente principal de UI:  
  - Recoge inputs de usuario (persona, industria, ciudad, clientes/mes, ticket promedio, inversión, canales, repetición).  
  - Envía los datos al backend (`/api/scorecard` y `/api/persona`).  
  - Renderiza las secciones: Scorecard, Q&A y Insights.  

---

## Flujo general

1. **Usuario llena IntakeForm** → se mandan datos a `/api/scorecard`.
2. **Scorecard** calcula eficiencia y genera narrativa.  
3. **Usuario selecciona foco o pregunta** → se manda a `/api/persona`.  
4. **Persona responde** con reacción, respuesta directa y dudas.  
5. **Se generan insights** combinando números + señales de la persona.  
6. **UI muestra Scorecard, Q&A y Insights** en bloques separados.  

---

## Notas técnicas

- **Lenguaje:** TypeScript + Next.js (App Router).  
- **LLM:** OpenAI `gpt-4o-mini`, con fallback determinístico.  
- **Benchmarks:** provistos por `industryProvider` o `personaProvider`.  
- **Drift guard:** si el modelo contesta fuera de dominio (ej. habla de nutrición en vez de bienes raíces), se corrige y se fuerza reintento.  
- **Insights:** siempre conectan tres piezas:  
  - Números del scorecard.  
  - Señales de la persona (dudas, sugerencias).  
  - Pregunta específica del usuario.  

---

## Próximos pasos

- [ ] Documentar benchmarks de cada industria (`src/lib/industryProvider.ts`).  
- [ ] Mejorar consistencia de las respuestas con few-shot prompts.  
- [ ] Añadir tests de integración para `/api/scorecard` y `/api/persona`.  
- [ ] Crear ejemplos de entrada/salida para validar narrativa y Q&A.  
