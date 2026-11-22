---
name: web-animation
description: >-
  Adds purposeful web motion: CSS transitions and keyframes on
  compositor-friendly properties, the Web Animations API, View Transitions,
  scroll-driven animations, @starting-style entry effects, Motion (formerly
  Framer Motion) and GSAP, prefers-reduced-motion handling, WCAG motion
  criteria, and jank profiling. Use when animating UI state changes, page
  transitions or scroll effects, or fixing janky or inaccessible motion.
---

# Web Animation

Motion should explain change: where something came from, where it went, and
what the interface is doing. Use the lightest tool that works, animate only
cheap properties, and honour reduced-motion preferences.

## When to use

- Adding transitions to menus, dialogs, toasts, tabs, lists or route changes.
- Building scroll-linked effects or page transitions.
- Animations stutter, block input or cause layout shift.
- Auditing motion for accessibility.

## When not to use

- Programmatic video and motion graphics: use `remotion-motion-graphics`.
- 3D scenes and shaders: use `threejs-webgl`.
- SVG authoring itself: use `svg-graphics`. Page-load speed: use `web-performance`.

## Workflow

1. **Give each animation a job and a budget.** Feedback (press, toggle), orientation (where a panel came from), continuity (shared element between views) or attention (a new notification). Drop decorative motion that has no job.

   **Check:** Each planned animation has a stated purpose, duration and trigger.

2. **Pick the lightest tool** from the decision table below. Prefer CSS, then the Web Animations API, then a library.

   **Check:** No library is added for something CSS or WAAPI does.

3. **Animate compositor-friendly properties.** `transform` (or the individual `translate`, `scale`, `rotate` properties) and `opacity`. Avoid animating `width`, `height`, `top`, `left`, `margin` and `box-shadow`; for layout changes use the FLIP technique or a library's layout animation. Apply `will-change` only for the duration of an animation.

   **Check:** DevTools Rendering > Paint flashing shows no repaint of large areas during the animation.

4. **Respect reduced motion by design.** Author movement inside a no-preference query and replace motion with fades or instant changes otherwise.

   ```css
   .panel { transition: opacity 150ms ease-out; }
   @media (prefers-reduced-motion: no-preference) {
     .panel { transition: opacity 200ms ease-out, translate 200ms ease-out; }
   }
   ```

   In Motion use `<MotionConfig reducedMotion="user">`; in GSAP wrap timelines in `gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => { ... })`.

   **Check:** With the OS reduce-motion setting on (or DevTools rendering emulation), nothing slides, zooms or parallaxes.

5. **Implement the pattern** (examples below) and keep it interruptible: a second click mid-animation should reverse or retarget, not queue.

   **Check:** Rapid repeated toggling never leaves the element stuck half-way or invisible.

6. **Meet the WCAG motion criteria.** Auto-playing motion that lasts more than five seconds needs a pause, stop or hide control (2.2.2). Nothing flashes more than three times per second (2.3.1). Motion triggered by interaction can be disabled (2.3.3, AAA, met by step 4). Do not move focus or content away while the user is reading.

   **Check:** The `accessibility-auditor` agent or a manual pass confirms these.

7. **Profile on a slow device.** Record the interaction in the DevTools Performance panel with 4x CPU throttling. Look for long tasks, layout and paint inside animation frames, and dropped frames; check Interaction to Next Paint for animations triggered by input.

   **Check:** The trace shows no long tasks or layout work during the animation on the throttled profile.

## Patterns

### Tool decision table

| Need | Tool |
| :--- | :--- |
| Hover, focus, open/close state | CSS transition |
| Loops, spinners, attention pulses | CSS `@keyframes` |
| Entry animation from `display: none` | `@starting-style` plus `transition-behavior: allow-discrete` |
| JS-driven, cancellable, awaitable | Web Animations API (`element.animate`) |
| DOM swap or route change with continuity | View Transitions API |
| Progress tied to scroll | CSS scroll-driven animations (`animation-timeline: scroll()` or `view()`; check support) |
| React or Vue exit and layout animations, gestures | Motion (`motion/react`, `motion-v` for Vue) |
| Complex timelines, SVG morphing, scroll storytelling | GSAP with ScrollTrigger |
| Designer-made vector animation | Lottie or Rive |

### Durations and easing

| Interaction | Duration | Easing |
| :--- | :--- | :--- |
| Press or toggle feedback | 80-150 ms | `ease-out` |
| Small element enter/exit (tooltip, toast) | 150-250 ms | `ease-out` in, `ease-in` out |
| Panel, drawer, dialog | 200-300 ms | `cubic-bezier(0.2, 0, 0, 1)` or similar |
| Page or shared-element transition | 250-400 ms | ease-in-out |

### Popover entry and exit in CSS

```css
[popover] {
  transition: opacity 200ms, translate 200ms, overlay 200ms allow-discrete, display 200ms allow-discrete;
  opacity: 0;
  translate: 0 0.5rem;
}
[popover]:popover-open { opacity: 1; translate: 0 0; }
@starting-style { [popover]:popover-open { opacity: 0; translate: 0 0.5rem; } }
```

### View transition with fallback

```js
export function swap(update) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce) return update();
  return document.startViewTransition(update).finished;
}
```

Name shared elements with `view-transition-name` (unique per page) and tune with `::view-transition-old(...)` and `::view-transition-new(...)`. Multi-page apps opt in with `@view-transition { navigation: auto; }` where supported.

### Web Animations API

```js
const anim = button.animate(
  [{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1)' }],
  { duration: 150, easing: 'ease-out' },
);
await anim.finished;
```

### Motion exit animation (React)

```tsx
import { AnimatePresence, motion } from 'motion/react';

<AnimatePresence>
  {open && (
    <motion.div key="panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }} />
  )}
</AnimatePresence>
```

With GSAP in React, use `useGSAP` from `@gsap/react` with a `scope` so animations are cleaned up on unmount. Check GSAP's current license terms before shipping.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Animate `width`, `height`, `top`, `left` | `transform` and FLIP | Layout every frame causes jank |
| Permanent `will-change` on many elements | Set it only while animating | Wastes GPU memory |
| Remove all motion for reduced-motion users | Replace movement with fades | Feedback still matters |
| Long entrance animations before content is usable | Under 300 ms, content readable mid-animation | Users wait for decoration |
| Scroll-jacking | Native scroll with scroll-driven effects | Breaks expectations and accessibility |
| JS `setInterval` animation loops | CSS, WAAPI or `requestAnimationFrame` | Timer loops drift and drop frames |

## Verification checklist

- [ ] Every animation has a purpose and a duration within the table's ranges.
- [ ] Only compositor-friendly properties animate (or FLIP is used).
- [ ] Reduced-motion users get fades or no motion.
- [ ] WCAG 2.2.2 and 2.3.1 satisfied; 2.3.3 supported.
- [ ] Throttled Performance trace shows no long tasks during animations.
- [ ] Rapid toggling leaves no stuck states.

## Related

- Knowledge: `css-architecture`, `tailwind-css`, `react-patterns`, `accessibility-a11y`, `web-performance`, `svg-graphics`, `remotion-motion-graphics`, `threejs-webgl`.
- Workflows: `/ui-polish`, `/perf-audit`, `/a11y-audit`.
- Agents: `ux-designer`, `frontend-engineer`, `accessibility-auditor`, `performance-optimizer`.
