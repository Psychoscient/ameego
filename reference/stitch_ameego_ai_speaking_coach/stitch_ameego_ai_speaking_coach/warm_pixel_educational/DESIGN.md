---
name: Warm Pixel Educational
colors:
  surface: '#fdfae7'
  surface-dim: '#dddbc8'
  surface-bright: '#fdfae7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f4e1'
  surface-container: '#f1eedb'
  surface-container-high: '#ece9d6'
  surface-container-highest: '#e6e3d0'
  on-surface: '#1c1c11'
  on-surface-variant: '#4d4638'
  inverse-surface: '#313124'
  inverse-on-surface: '#f4f1de'
  outline: '#7f7666'
  outline-variant: '#d0c5b2'
  surface-tint: '#765a05'
  primary: '#765a05'
  on-primary: '#ffffff'
  primary-container: '#e9c46a'
  on-primary-container: '#695000'
  inverse-primary: '#e7c268'
  secondary: '#44673a'
  on-secondary: '#ffffff'
  secondary-container: '#c2ebb2'
  on-secondary-container: '#486b3e'
  tertiary: '#a33d23'
  on-tertiary: '#ffffff'
  tertiary-container: '#ffb7a5'
  on-tertiary-container: '#95331a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdf96'
  primary-fixed-dim: '#e7c268'
  on-primary-fixed: '#251a00'
  on-primary-fixed-variant: '#5a4400'
  secondary-fixed: '#c5eeb5'
  secondary-fixed-dim: '#a9d29b'
  on-secondary-fixed: '#012201'
  on-secondary-fixed-variant: '#2d4f25'
  tertiary-fixed: '#ffdad2'
  tertiary-fixed-dim: '#ffb4a2'
  on-tertiary-fixed: '#3c0700'
  on-tertiary-fixed-variant: '#83260e'
  background: '#fdfae7'
  on-background: '#1c1c11'
  surface-variant: '#e6e3d0'
typography:
  display-xl:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-pixel:
    fontFamily: monospace
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 64px
  container-margin: 20px
  gutter: 16px
---

## Brand & Style

This design system establishes a personality that is encouraging, knowledgeable, and nostalgic. It bridges the gap between high-tech AI utility and the low-fi comfort of 8-bit aesthetics. The target audience includes professionals and students who find traditional learning apps clinical or intimidating; they seek an environment that feels like a "safe space" for public speaking practice.

The visual style is a **Modern-Retro Fusion**. It leverages the cozy, low-stakes emotional response of pixel art while utilizing modern layout principles—such as ample white space and clean sans-serif typography—to ensure the educational content remains the primary focus. The vibe is "high-fidelity comfort," ensuring that while the "AMEEGO Buddy" is playful, the coaching feedback is delivered with professional clarity.

## Colors

The color strategy uses a "Warmer, Easier-on-the-Eyes" approach. **Cream (#F4F1DE)** serves as the primary canvas color, replacing harsh whites to reduce eye strain during long practice sessions. **Soft Gold** is the primary brand color, used for success states and key highlights, while **Warm Sage Green** is used for "Go" actions and progress indicators. 

**Muted Terracotta** provides a soft contrast for warnings or secondary call-outs, avoiding the aggressive nature of pure red. **Dusty Charcoal** is reserved for typography and high-contrast borders to maintain legibility. The palette should be applied with high saturation for decorative elements (pixel art) and lower density for functional UI surfaces.

## Typography

This design system employs a tiered typography strategy. **Space Grotesk** is used for headlines; its geometric and slightly quirky construction mirrors the structured nature of pixels while remaining crisp. **Plus Jakarta Sans** is the workhorse for body copy, chosen for its friendly, open apertures and high readability.

For "AMEEGO Buddy" speech bubbles and specific decorative accents (like category tags), use a pixelated monospace font or all-caps bold weights to reinforce the retro theme. Line heights are generous to ensure the "educational" nature of the app feels approachable and never cramped.

## Layout & Spacing

The layout follows a **Fixed Grid** model for mobile-first consistency. Content is housed within card-based containers that use a 24px internal padding (md) to maintain a "breathable" feel. 

The rhythm is strictly 8px-based. Vertical spacing between different sections (e.g., Header to Progress Card) should use 48px (lg) to create clear visual separation. The AMEEGO Buddy character should often break the grid, overlapping container edges or "sitting" on top of UI elements to feel like a dynamic guide rather than a static asset.

## Elevation & Depth

Depth is conveyed through **Tonal Layers** and **Tactile Shadows**. Surfaces are not elevated via generic blurs; instead, they use a "Soft-Skeuomorphic" drop shadow:
1.  **Level 1 (Cards):** 0px Blur, 4px Y-offset, with a color tint of `Dusty Charcoal` at 10% opacity.
2.  **Level 2 (Active Buttons):** 0px Blur, 2px Y-offset (mimicking a "pressed" state).

Avoid pure gradients. Instead, use flat background colors with subtle, low-contrast 1px inner strokes to define edges. This creates a "stamped" or "printed" look that feels more physical and less digital.

## Shapes

The shape language balances the "blocky" nature of pixels with the "friendly" nature of the app. Containers use **Rounded (0.5rem)** corners. Larger cards or the main "Speech Lab" interface use **Rounded-XL (1.5rem)** to feel softer and more inviting.

A signature element of this design system is the "Pixel-Cut" corner—occasionally used for buttons where the corner is a stepped 45-degree angle rather than a smooth curve, specifically for the primary CTA to draw attention.

## Components

-   **Buttons:** Primary buttons use `Soft Gold` with a `Dusty Charcoal` 2px bottom-border (shadow). Text is bold and centered. Hover/Active states should involve a "press-down" animation where the shadow height decreases.
-   **Cards:** Use `Cream` or `Earthy Beige` surfaces with a 1px `Dusty Charcoal` border at 15% opacity. Headers within cards should be set in `Space Grotesk`.
-   **Input Fields:** Soft rounded rectangles with a `Cream` background and a thick 2px `Soft Gold` border when focused.
-   **AMEEGO Buddy (Character):** The character should be rendered in clear pixel-art style, framed in a circular `Deep Peach` badge during coaching sessions.
-   **Progress Bars:** Use a "Segmented" style where the progress is shown in blocks, mimicking a retro loading bar, using `Warm Sage Green`.
-   **Icons:** Custom 24x24 pixel icons. Lines should be 2px thick to ensure clarity on high-resolution displays. Avoid diagonal lines where possible to maintain the pixel-grid integrity.
-   **Chips/Tags:** Used for speech metrics (e.g., "Pace," "Clarity"). These have high `Pill-shaped` roundedness and use the `Muted Terracotta` or `Warm Sage` palette for categorical coding.