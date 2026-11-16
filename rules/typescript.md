# TypeScript Engineering Standards

1. **Strict Mode**: Always enable `"strict": true` in `tsconfig.json`. Never resort to `any` when `unknown` or a generic type fits.
2. **Immutability & Const**: Favor `readonly` properties and `const` declarations.
3. **Module Resolution**: Use NodeNext or Bundler module resolution with explicit ESM imports.
4. **Error Handling**: Use discriminated unions or Result patterns for predictable error propagation.
