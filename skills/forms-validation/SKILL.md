---
name: forms-validation
description: >-
  Builds robust web forms: one zod (or Standard Schema) schema shared by client
  and server, progressive enhancement that works without JavaScript, accessible
  labels, hints and error messages, focus management and error summaries,
  validation timing, React Hook Form and framework actions, double-submit
  protection, and secure file inputs. Use when creating or reviewing a form,
  a validation schema, error UX, or an upload field.
---

# Forms and Validation

The server decides what is valid; the client only makes it pleasant. Start
from a native HTML form that works without JavaScript, validate with one
shared schema, and make every error reachable by keyboard and screen reader.

## When to use

- Building sign-up, checkout, settings, search or any multi-field form.
- Writing or sharing a validation schema between client and server.
- Errors are confusing, inaccessible, or appear while the user is still typing.
- Adding a file input or preventing duplicate submissions.

## When not to use

- Upload pipelines, storage and scanning: use `file-storage-uploads`.
- Authentication flows and password storage: use `auth-patterns`.
- API request validation in general: use `api-design` or `api-security`.

## Workflow

1. **Define the schema once** in a module both client and server import.

   ```ts
   // shared/schemas/signup.ts (zod 4 syntax; zod 3 uses z.string().email() and { message })
   import { z } from 'zod';

   export const Signup = z.object({
     email: z.email({ error: 'Enter an email address like name@example.com' }),
     name: z.string().trim().min(1, { error: 'Enter your name' }).max(100),
     password: z.string().min(12, { error: 'Use at least 12 characters' }),
     terms: z.literal('on', { error: 'Accept the terms to continue' }),
   });
   export type SignupInput = z.infer<typeof Signup>;
   ```

   **Check:** Unit tests cover a table of valid and invalid inputs, including whitespace-only and over-long values.

2. **Validate authoritatively on the server.** Parse `FormData` with `safeParse`, return field errors and the submitted values (never echo passwords) with status 400 or 422, and re-check business rules (uniqueness, permissions) there.

   **Check:** A request that bypasses the UI (curl or a test) with invalid data is rejected.

3. **Write markup that works without JavaScript.**

   ```html
   <form method="post" action="/signup" novalidate>
     <div class="field">
       <label for="email">Email</label>
       <p id="email-hint">We send your receipt here.</p>
       <input id="email" name="email" type="email" autocomplete="email" required
              aria-describedby="email-hint email-error" aria-invalid="true" />
       <p id="email-error">Enter an email address like name@example.com</p>
     </div>
     <button type="submit">Create account</button>
   </form>
   ```

   Every input has a visible `<label>`, a `name`, the right `type`, `autocomplete` and `inputmode`. Keep `required` and `type` for semantics even when `novalidate` hands error display to your UI. Group radios and checkboxes in `<fieldset>` with `<legend>`.

   **Check:** With JavaScript disabled, the form submits and the server re-renders errors next to fields.

4. **Time client validation for the user.** Validate on submit first; after a field has been touched or submitted with an error, re-validate it on blur and then on input so the error clears as soon as it is fixed ("reward early, punish late"). Never show errors on a field the user has not reached.

   **Check:** Typing the first character of an email shows no error.

5. **Manage focus after a failed submit.** Render an error summary at the top (heading plus links to each invalid field), move focus to it (`tabindex="-1"` on the container) or to the first invalid field, and set `aria-invalid` and `aria-describedby` on each field. Do not disable the submit button to signal invalidity.

   **Check:** A keyboard user submitting an empty form lands on the summary and can jump to each field; a screen reader announces each error with its field.

6. **Wire the library.** Use framework actions for progressive enhancement (Next.js server actions, React Router actions, SvelteKit form actions, Nuxt server routes), Conform for progressive enhancement in React, or React Hook Form for client-heavy forms:

   ```tsx
   const { register, handleSubmit, formState: { errors, isSubmitting } } =
     useForm<SignupInput>({ resolver: zodResolver(Signup), mode: 'onTouched' });
   ```

   Vue: VeeValidate. Angular: Reactive Forms validators. TanStack Form and others accept Standard Schema validators (zod, Valibot, ArkType).

   **Check:** Client and server report the same message for the same invalid input.

7. **Prevent duplicate and abusive submits.** Ignore re-submits while pending (`aria-disabled` plus a pending label), send an idempotency key for orders and payments, rely on the framework's CSRF protection or SameSite cookies with a token, rate-limit by account and IP, and consider a honeypot field for public forms.

   **Check:** Double-clicking submit creates one record.

8. **Handle file inputs safely.** `accept` is only a hint. On the server, enforce size limits before buffering, verify type by content (magic bytes), not extension or client MIME, scan, strip image metadata, and store outside the web root with generated names. Large files go direct to storage with signed URLs. Use `enctype="multipart/form-data"` for native posts; show progress with `XMLHttpRequest` `upload.onprogress`.

   **Check:** Renaming an executable to `.png` is rejected; an over-limit file is rejected with a clear message.

9. **Test the whole loop.** Schema unit tests, a component test of the error flow (see `react-testing`), and a Playwright test in a context with `javaScriptEnabled: false`.

   **Check:** All pass.

## Patterns

### Error message rules

| Rule | Example |
| :--- | :--- |
| Say what to do, not what went wrong | "Enter a date after today" not "Invalid date" |
| Match the label wording | Label "Postcode" means the error says "postcode" |
| Keep examples in hints | "For example, 12 March 2026" |
| Same message client and server | Both come from the shared schema |

### Input attributes that matter

| Field | Attributes |
| :--- | :--- |
| Email | `type="email" autocomplete="email"` |
| New password | `type="password" autocomplete="new-password"`, show-password toggle |
| One-time code | `inputmode="numeric" autocomplete="one-time-code"` |
| Phone | `type="tel" autocomplete="tel"` |
| Numbers that are not quantities (card, account) | `inputmode="numeric"`, not `type="number"` |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Placeholder as label | Visible `<label>` | Placeholders vanish and fail contrast |
| Client-only validation | Server validation with the shared schema | Requests can skip the UI |
| Validate on every keystroke from the start | Submit first, then blur, then input | Premature errors frustrate users |
| Disabled submit until valid | Enabled submit plus an error summary | Users cannot discover what is wrong |
| Trust `accept` or file extensions | Check content and size on the server | Trivially spoofed |
| Clear the whole form on error | Preserve entered values (except secrets) | Retyping causes abandonment |

## Verification checklist

- [ ] One schema shared by client and server, with unit tests.
- [ ] Form works without JavaScript; server is authoritative.
- [ ] Labels, hints, `aria-invalid`, `aria-describedby` and an error summary are present.
- [ ] Focus moves to the summary or first invalid field on failed submit.
- [ ] Duplicate submits are harmless; file inputs are validated by content and size.
- [ ] Playwright passes with JavaScript disabled.

## Related

- Knowledge: `accessibility-a11y`, `react-testing`, `react-router-remix`, `svelte-kit`, `frontend-react-nextjs`, `file-storage-uploads`, `api-security`, `auth-patterns`.
- Workflows: `/a11y-audit`, `/e2e`.
- Agents: `accessibility-auditor`, `frontend-engineer`, `security-guard`.
