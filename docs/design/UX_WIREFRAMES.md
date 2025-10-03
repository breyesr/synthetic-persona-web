Design System — Synthetic Persona Web

This design system ensures visual and interaction consistency across all steps: intake form → scorecard → persona Q&A → insights.

⸻

1. Colors

Primary Palette
  • Indigo 600 (#4F46E5) → primary actions (buttons, highlights).
  • Indigo 700 (#4338CA) → hover state.
  • Indigo 200 (#C7D2FE) → subtle backgrounds.

Neutral Palette
  • White (#FFFFFF) → background.
  • Gray 50 (#F9FAFB) → light background.
  • Gray 200 (#E5E7EB) → borders.
  • Gray 700 (#374151) → body text.
  • Gray 900 (#111827) → titles.

Accent Palette
  • Green 500 (#10B981) → success / good efficiency.
  • Red 500 (#EF4444) → error / critical.
  • Amber 500 (#F59E0B) → warning / medium score.
  • Blue 500 (#3B82F6) → info / neutral highlight.

⸻

2. Typography

Font family: Inter, sans-serif

Scale:
  • H1 → 24px, bold (section titles).
  • H2 → 20px, semibold (card titles).
  • H3 → 16px, semibold (subsections).
  • Body → 14px, regular (default text).
  • Small → 12px, regular (helper/error messages).

⸻

3. Spacing & Layout
  • Container max width: 640px (mobile-first, centered).
  • Padding inside cards: 20px.
  • Vertical spacing between sections: 16px.
  • Border radius: 12px (cards, inputs, buttons).
  • Shadows: subtle 0 1px 3px rgba(0,0,0,0.1).

⸻

4. Components

Buttons
  • Primary: Indigo 600 background, white text, rounded-xl, hover Indigo 700.
  • Secondary: White background, Indigo 600 border + text.
  • Disabled: Gray 200 background, gray 500 text.

Inputs
  • Rounded-xl, border Gray 200.
  • Focus: Indigo 600 border, ring effect.
  • Error: Red 500 border + helper text.

Cards
  • White background, shadow, rounded-xl.
  • Title in H2, divider line (Gray 200).

Chips / Checkboxes
  • Pills with Indigo 200 background when selected.
  • Neutral border when unselected.

⸻

5. Icons & Indicators
  • Use emojis or simple icons to anchor categories:
  • 📊 Inversión
  • 👥 Clientes
  • 🔄 Repetición
  • 🌐 Presencia
  • ❓ Dudas
  • ✅ Confianza
  • Efficiency Score: circular gauge (10 segments, colored → red <4, amber 4–7, green >7).

⸻

6. States

Loading:
  • Buttons show spinner + text (“Calculando…”, “Preguntando…”).

Empty States:
  • Before running scorecard: “Llena tus datos y genera tu scorecard en segundos.”
  • Before persona selection: “Elige una persona para conocer sus dudas reales.”

Error States:
  • Card with Red 500 border + message: “Algo salió mal. Intenta de nuevo.”

⸻

7. Accessibility
  • Color contrast ratio ≥ 4.5 for text.
  • All buttons/inputs have focus rings.
  • Labels above inputs, helper text below.

⸻

8. Example Flow Styling
  • Step 1 Intake → white card, indigo button.
  • Step 2 Scorecard → result card with efficiency gauge (colored ring).
  • Step 3 Persona Q&A → chat-like bubbles for answers.
  • Step 4 Insights → collapsible sections with checklist and icons.
  • Step 5 Next Steps → two buttons (primary + secondary).

⸻

This design system is minimal but scalable — easy to expand if we add themes, PDF exports, or multi-language UI.