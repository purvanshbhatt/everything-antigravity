---
name: web-components
disable-model-invocation: true
description: >-
  Builds framework-agnostic UI with custom elements: lifecycle callbacks,
  attributes vs properties, shadow DOM styling with parts and custom
  properties, slots, declarative shadow DOM, form-associated elements via
  ElementInternals, Lit components, events that cross shadow boundaries, and
  interop with React, Vue, Angular and Svelte. Use when building a
  cross-framework widget or design-system layer, or embedding custom elements
  in an app.
---

# Web Components

Custom elements are a public contract: tag name, attributes, properties,
events, slots, CSS parts and custom properties. Design that contract first,
implement it with Lit or plain classes, and test it in real browsers and in
every framework that will host it.

## When to use

- One component library must serve several frameworks, or plain HTML pages.
- Shipping an embeddable widget for third-party sites.
- Making a custom control participate in native `<form>` submission and validation.
- Integrating someone else's custom elements into React, Vue or Angular.

## When not to use

- Components used only inside a single-framework app: use that framework's components (`react-patterns`, `vue-nuxt`, `angular`, `svelte-kit`).
- Token and documentation strategy: use `design-systems`.
- Browser extension content scripts: use `browser-extensions`.

## Workflow

1. **Write the element contract.** Tag names must contain a hyphen; prefix them (`acme-`). Attributes are strings for configuration and styling hooks; properties carry rich data; events use `CustomEvent` with lowercase names; slots, `part` names and `--acme-*` custom properties form the styling API. Generate a Custom Elements Manifest so tools and docs can read it.

   ```bash
   npx @custom-elements-manifest/analyzer analyze
   ```

   **Check:** `custom-elements.json` lists every public attribute, property, event, slot, part and CSS property.

2. **Implement with Lit** (or a plain `HTMLElement` subclass for tiny elements).

   ```ts
   import { LitElement, css, html } from 'lit';
   import { customElement, property } from 'lit/decorators.js';

   @customElement('acme-counter')
   export class AcmeCounter extends LitElement {
     static styles = css`
       :host { display: inline-flex; align-items: center; gap: var(--acme-counter-gap, 0.5rem); }
       :host([disabled]) { opacity: 0.5; }
     `;

     // TS experimentalDecorators + useDefineForClassFields: false. With standard decorators write `accessor value = 0`.
     @property({ type: Number, reflect: true }) value = 0;
     @property({ type: Boolean, reflect: true }) disabled = false;

     private step(delta: number) {
       this.value += delta;
       this.dispatchEvent(new CustomEvent('acme-change', { detail: { value: this.value }, bubbles: true, composed: true }));
     }

     render() {
       return html`
         <button part="button" aria-label="Decrease" ?disabled=${this.disabled} @click=${() => this.step(-1)}>-</button>
         <output aria-live="polite">${this.value}</output>
         <button part="button" aria-label="Increase" ?disabled=${this.disabled} @click=${() => this.step(1)}>+</button>
       `;
     }
   }

   declare global { interface HTMLElementTagNameMap { 'acme-counter': AcmeCounter } }
   ```

   Plain classes use `connectedCallback`, `disconnectedCallback` (remove listeners and observers there), and `attributeChangedCallback` with `static observedAttributes`.

   **Check:** Setting the attribute, setting the property, and removing then re-adding the element all behave correctly with no leaked listeners.

3. **Expose a styling API.** Inside: `:host`, `:host([attr])`, `::slotted(...)`. Outside: `acme-counter::part(button)` and `--acme-*` custom properties, which pierce the shadow root. Inherited properties (`font`, `color`) flow in automatically.

   **Check:** A consumer can restyle buttons via `::part` and spacing via custom properties without touching internals.

4. **Make form controls real form controls.**

   ```js
   class AcmeRating extends HTMLElement {
     static formAssociated = true;
     #internals = this.attachInternals();
     #value = '';
     set value(v) {
       this.#value = String(v);
       this.#internals.setFormValue(this.#value);
       this.#internals.setValidity(this.#value ? {} : { valueMissing: true }, 'Choose a rating');
     }
     get value() { return this.#value; }
     formResetCallback() { this.value = ''; }
   }
   customElements.define('acme-rating', AcmeRating);
   ```

   **Check:** The value appears in `new FormData(form)`, `form.reportValidity()` flags it, and form reset clears it.

5. **Keep accessibility intact across the shadow boundary.** ID references (`aria-labelledby`, `for`) cannot cross shadow roots, so keep labels inside the component or accept a `label` attribute. Use `delegatesFocus: true` (in Lit: `static shadowRootOptions = { ...LitElement.shadowRootOptions, delegatesFocus: true }`) for composite controls.

   **Check:** Keyboard-only and screen-reader passes announce the control's name, role and value.

6. **Avoid flashes and support SSR where needed.** Style `:not(:defined)` to reserve space before upgrade. Declarative shadow DOM (`<template shadowrootmode="open">`) renders shadow content from HTML; Lit's SSR packages are labs-stage, so verify their status first.

   **Check:** No layout shift when the element definitions load late (throttle the network).

7. **Integrate with frameworks** (table below), then test in real browsers with `@web/test-runner` plus `@open-wc/testing`, Vitest browser mode or Playwright. jsdom lacks parts of shadow DOM and form-association behaviour.

   **Check:** A smoke test per host framework sets a property, listens for the event and submits a form.

## Patterns

### Framework interop

| Host | What to do |
| :--- | :--- |
| React 19 | Custom elements are supported: props matching element properties are set as properties. Check the React docs for custom event prop naming, or attach listeners via a ref |
| React 18 and earlier | Wrap with `@lit/react` `createComponent({ tagName, elementClass, react: React, events: { onAcmeChange: 'acme-change' } })` |
| Vue | Mark tags as custom: `vue({ template: { compilerOptions: { isCustomElement: (t) => t.startsWith('acme-') } } })`; bind properties with `.prop` when needed |
| Angular | Add `CUSTOM_ELEMENTS_SCHEMA` to the standalone component's `schemas` |
| Svelte | Works directly; Svelte sets properties when they exist on the element |

### Attribute vs property

| Data | Use |
| :--- | :--- |
| Strings, numbers, booleans for config and CSS hooks | Attribute (reflect when styling depends on it) |
| Arrays, objects, functions | Property only |
| Values that change at high frequency | Property, no reflection |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Events without `composed: true` | `bubbles: true, composed: true` for public events | Events stop at the shadow root |
| Pass objects through attributes as JSON | Set properties | Parsing cost and lost identity |
| Hide every style behind closed shadow roots | Document `::part`s and custom properties | Consumers fork the component to restyle it |
| `aria-labelledby` pointing outside the shadow root | Internal labels or a `label` attribute | IDREFs do not cross shadow boundaries |
| Test only in jsdom | Real-browser test runners | Shadow DOM and ElementInternals gaps hide bugs |
| Unprefixed tag names | Namespaced prefix | Collisions with other libraries |

## Verification checklist

- [ ] Contract documented in a Custom Elements Manifest.
- [ ] Attributes, properties and events behave as documented; no listener leaks.
- [ ] Styling API (parts, custom properties) works from outside.
- [ ] Form-associated controls submit, validate and reset.
- [ ] Accessible name, role and focus are correct across the shadow boundary.
- [ ] Real-browser tests pass, plus a smoke test in each host framework.

## Related

- Knowledge: `design-systems`, `css-architecture`, `react-patterns`, `vue-nuxt`, `angular`, `svelte-kit`, `accessibility-a11y`, `forms-validation`, `browser-extensions`.
- Workflows: `/a11y-audit`, `/e2e`.
- Agents: `frontend-engineer`, `accessibility-auditor`, `typescript-reviewer`.
