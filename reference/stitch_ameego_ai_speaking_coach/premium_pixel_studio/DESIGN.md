---
name: Premium Pixel Studio
colors:
  surface: '#fff8f4'
  surface-dim: '#f5d5ad'
  surface-bright: '#fff8f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1e4'
  surface-container: '#ffebd4'
  surface-container-high: '#ffe4c3'
  surface-container-highest: '#fedeb5'
  on-surface: '#281801'
  on-surface-variant: '#4f4538'
  inverse-surface: '#3f2d11'
  inverse-on-surface: '#ffeedc'
  outline: '#817566'
  outline-variant: '#d3c4b3'
  surface-tint: '#7d5710'
  primary: '#7d5710'
  on-primary: '#ffffff'
  primary-container: '#e9b869'
  on-primary-container: '#6a4800'
  inverse-primary: '#f0be6f'
  secondary: '#8f4d2d'
  on-secondary: '#ffffff'
  secondary-container: '#ffaa83'
  on-secondary-container: '#793c1d'
  tertiary: '#546349'
  on-tertiary: '#ffffff'
  tertiary-container: '#b5c5a6'
  on-tertiary-container: '#44523a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdead'
  primary-fixed-dim: '#f0be6f'
  on-primary-fixed: '#281900'
  on-primary-fixed-variant: '#604100'
  secondary-fixed: '#ffdbcc'
  secondary-fixed-dim: '#ffb595'
  on-secondary-fixed: '#351000'
  on-secondary-fixed-variant: '#713618'
  tertiary-fixed: '#d7e8c7'
  tertiary-fixed-dim: '#bbccac'
  on-tertiary-fixed: '#121f0b'
  on-tertiary-fixed-variant: '#3d4b33'
  background: '#fff8f4'
  on-background: '#281801'
  surface-variant: '#fedeb5'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1200px
  gutter: 24px
  margin: 32px
  stack-sm: 16px
  stack-md: 32px
  stack-lg: 64px
---

## Brand & Style

The design system for this AI speaking coach blends the high-stakes environment of a professional recording studio with the nostalgic, tactile warmth of the "Señor Duck" pixel aesthetic. The brand personality is encouraging yet precise, acting as a sophisticated "sensei" for public speaking. 

The visual style is a hybrid of **Minimalism** and **Retro-Tactile**. It utilizes clean, high-fidelity layouts to ensure professional credibility, while integrating subtle pixel-art accents—such as character avatars, waveform visualizations, and "stepped" corner treatments—to inject personality and reduce the anxiety often associated with speech training. The goal is to evoke "cozy performance"—a space where users feel safe to fail and empowered to grow.

## Colors

This design system uses a "Warmer, Easier-on-the-Eyes" palette that avoids the clinical blues and whites of traditional AI platforms. 

- **Primary (Soft Gold):** Used for focal points, progress highlights, and key interactive elements. It represents the "spotlight" and success.
- **Secondary (Deep Peach):** Used for supportive actions and accentuating the "rhythm" of the interface.
- **Tertiary (Warm Sage Green):** Reserved exclusively for positive feedback, successful completion states, and "Go" signals.
- **Action/Warning (Muted Terracotta):** A softer take on red, used for critical alerts and stopping points without causing alarm.
- **Neutral/Background (Earthy Beige-Brown & Cream):** The earthy brown provides a grounded frame, while the Cream surface ensures high readability for content cards and work areas.
- **Text (Dusty Charcoal):** A softened black that maintains high contrast against cream surfaces while remaining gentle on the eyes during long practice sessions.

## Typography

The typography strategy balances character with utility. 

**Space Grotesk** serves as the display font. Its geometric, slightly technical construction echoes the pixelated aesthetic of the "Señor Duck" reference while remaining crisp and modern. It should be used for all headers and performance metrics to reinforce the "Studio Tool" feel.

**Inter** is the workhorse for body text, feedback transcripts, and instructional tooltips. Its neutrality ensures that long-form feedback is easy to digest. Use a slightly tighter tracking for Space Grotesk headers and generous line-height for Inter body text to maintain a premium, editorial feel.

## Layout & Spacing

This design system employs a **Fixed Grid** philosophy to create the feeling of a "contained" studio console. Central content should be housed in structured containers that conform to a 12-column grid.

The spacing rhythm is based on an 8px base unit. To maintain the "Specialized Studio" aesthetic, use generous outer margins to frame the UI, making the application feel like a tool sitting on a desk rather than a full-screen website. Use "Inner Spacing" (padding) within cards to create distinct functional zones for the AI coach avatar, the real-time transcript, and the performance analytics.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Bold Borders** rather than traditional soft shadows.

1.  **Level 0 (The Floor):** The Earthy Beige-Brown background acts as the canvas.
2.  **Level 1 (The Console):** Cream-colored cards with 2px Dusty Charcoal borders. 
3.  **Level 2 (Active Elements):** Buttons and active input fields use a subtle "Pixel-Shadow"—a solid 4px offset of the Dusty Charcoal color—to create a tactile, pressable look.

Avoid gradients and blurs. Depth should feel physical and "stamped," consistent with the retro-pixel inspiration. Use the primary Soft Gold as a highlight "glow" (a solid color fill) behind the active coach avatar or selected metrics.

## Shapes

The shape language is "Softly Geometric." While the pixel-art influence suggests sharp corners, this design system uses **Soft (0.25rem)** roundedness to maintain a premium, modern feel. 

Large containers (cards) should use a unique "Pixel-Notch" corner—where the corners appear slightly "stepped" or chamfered—to reference the pixel aesthetic without looking low-resolution. Buttons and chips remain consistently soft-rectangular to ensure they feel like physical toggles on a piece of high-end audio equipment.

## Components

- **The "Coach Buddy" Container:** A dedicated square card for the AI avatar. It should feature a secondary border in Soft Gold when the AI is "listening" or "analyzing."
- **Studio Buttons:** Primary buttons use a Soft Gold fill with a 2px Dusty Charcoal border. Upon hover, they shift 2px down and right to "hide" their solid shadow, simulating a physical click.
- **Rhythm Chips:** Small, pill-shaped labels used for speech attributes (e.g., "Pace," "Tone"). Use the Earthy Beige-Brown for inactive and the Deep Peach for active states.
- **Waveform Inputs:** A custom component representing the user's voice. This should be rendered in a blocky, pixelated style using the Warm Sage Green to indicate healthy volume/rhythm.
- **Feedback Cards:** Use the Cream surface with a Dusty Charcoal "stepped" border. Headlines within these cards should use the `label-caps` style for a technical, documented feel.
- **Performance Meter:** A vertical or horizontal bar graph using a "segmented" block style (resembling old MIDI level meters) to show confidence levels.