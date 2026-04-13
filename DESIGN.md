# Design System Specification: Editorial Precision

## 1. Overview & Creative North Star

### Creative North Star: "The Digital Architect"
This design system is a manifestation of precision, depth, and cinematic minimalism. It rejects the clutter of traditional "boxed-in" web design in favor of an expansive, dark-mode environment where content is treated as a high-end editorial piece. We move beyond standard UI by treating the screen not as a flat canvas, but as a multi-dimensional space defined by light, texture, and structural intent.

**Visual Principles:**
*   **Intentional Asymmetry:** Break the predictable 12-column grid. Use whitespace as a functional element to pull the eye toward focal points.
*   **Tonal Depth:** Hierarchy is established through the subtle "glow" of surfaces rather than harsh outlines.
*   **The Grid as Texture:** A subtle dot-matrix background acts as the "connective tissue" of the interface, providing a sense of engineering precision.

---

## 2. Colors & Surface Philosophy

The color palette is built on a foundation of deep obsidians and crisp ivories, utilizing Material Design 3 tonal tokens to create sophisticated layering.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1-pixel solid borders to define sections. Layout boundaries must be established through:
1.  **Background Shifts:** Transitioning from `surface` (#121318) to `surface_container_low` (#1a1b20).
2.  **Negative Space:** Using a minimum of `xl` (3rem) spacing to separate conceptual blocks.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of materials. 
*   **Base:** `surface` (#121318) serves as the infinite floor.
*   **Sectioning:** Use `surface_container` (#1e1f24) for primary content areas.
*   **Nesting:** Place a `surface_container_high` (#292a2f) card inside a `surface_container` section to create a soft, natural lift.

### Glass & Gradient Rule
To achieve a premium "Stitch-like" feel, floating elements (modals, floating bars) must use **Glassmorphism**:
*   **Fill:** `surface_container_lowest` (#0d0e13) at 70% opacity.
*   **Effect:** `backdrop-blur: 20px`.
*   **Signature Gradients:** Main CTAs should avoid flat white. Use a subtle linear gradient from `primary` (#FFFFFF) to `secondary_fixed_dim` (#c4c7ca) at a 45-degree angle to give buttons a metallic, tactile sheen.

---

## 3. Typography: Editorial Authority

We use **Inter** exclusively. Its high x-height and geometric clarity provide the "modern-technical" aesthetic required.

*   **Display (The Statement):** `display-lg` (3.5rem) should be used for core value propositions. Tighten letter-spacing by -0.02em for a high-fashion look.
*   **Headline (The Narrative):** `headline-md` (1.75rem) handles section titles. 
*   **Body (The Utility):** `body-lg` (1rem) is the workhorse. Ensure a line-height of 1.6 to maintain readability against the dark background.
*   **Labels (The Metadata):** `label-md` (0.75rem) in `on_surface_variant` (#c4c7ca) should be used for secondary micro-copy, often in All Caps with +0.05em tracking for a technical, labeled feel.

---

## 4. Elevation & Depth

Forget drop shadows that look like "smudges." We use **Tonal Layering**.

*   **The Layering Principle:** Depth is achieved by "stacking." A `surface_container_highest` (#34343a) element sitting on `surface` (#121318) creates an immediate sense of elevation without a single shadow pixel.
*   **Ambient Shadows:** For floating elements (e.g., dropdowns), use a shadow with `blur: 40px`, `y: 20px`, and a color of `rgba(0, 0, 0, 0.4)`. 
*   **The Ghost Border Fallback:** If a container is placed on a background of the same tonal value, use a "Ghost Border": `outline_variant` (#444749) at **15% opacity**.
*   **Roundedness Scale:** 
    *   **Interactive Elements (Buttons/Chips):** `full` (9999px) for a soft, pill-shaped feel.
    *   **Content Containers (Cards/Inputs):** `DEFAULT` (1rem) to `lg` (2rem) for a modern, approachable structure.

---

## 5. Components

### Buttons
*   **Primary:** Pill-shaped, `primary` (#FFFFFF) background with `on_primary` (#2e3132) text.
*   **Secondary:** Pill-shaped, `secondary_container` (#464a4d) background with `on_secondary` (#2d3134) text.
*   **Tertiary:** Ghost style. No background, just `primary` text. Use a subtle `backdrop-blur` on hover.

### Input Fields
*   **Styling:** Large `xl` (3rem) height, `surface_container_low` background. 
*   **Interactions:** On focus, the background should shift to `surface_container` and the "Ghost Border" should increase to 40% opacity.
*   **Labels:** Floating or top-aligned using `label-md`.

### Cards & Lists
*   **Forbid Dividers:** Do not use lines to separate list items. Use a 12px vertical gap and a background shift (`surface_container_lowest`) on hover to indicate interactivity.
*   **Media:** Images inside cards must have a `0.5rem` inner padding from the card edge to feel "framed" rather than "pasted."

### Prompt/AI Input Bar (Signature Component)
*   A centered, wide `surface_container` bar with a high `xl` corner radius. 
*   Incorporate "Quick Action Chips" (e.g., App, Web) using the `full` roundedness scale.

---

## 6. Do's and Don'ts

### Do
*   **Do** use the dot-grid pattern (`#404040` dots at 10% opacity) to fill large "empty" areas of the background.
*   **Do** use extreme contrast in font weights—combine `SemiBold` headlines with `Regular` body text.
*   **Do** utilize `surface_bright` (#38393e) for hover states on dark components to create a "lighting up" effect.

### Don'ts
*   **Don't** use 100% black (#000000). Always use the `surface` token (#121318) to allow for subtle depth and shadow visibility.
*   **Don't** use standard blue for links. Use `primary` (white) with an underline that appears only on hover.
*   **Don't** crowd the interface. If an element doesn't have at least `md` (1.5rem) of breathing room, it needs more space.
*   **Don't** use vibrant, saturated colors for errors. Use the specified `error` (#ffb4ab) which is desaturated to fit the dark editorial aesthetic.