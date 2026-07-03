# Parcel Locker Angular 2.0

Angular migration workspace for the Parcel Locker Service frontend.

Styling is Tailwind-first. Global design tokens live in `src/styles.css`, and component templates should use utility classes by default.

## Local Development

Install dependencies from this directory:

```bash
npm install
```

Run the Angular frontend only:

```bash
npm start
```

Run the full local stack from the repository root:

```bash
npm run dev:angular
```

Angular runs on `http://localhost:4200` and proxies `/api` to the backend on `http://localhost:3000`.

## Build

```bash
npm run build
```

## Angular 2.0 Conventions

- Prefer `signal`, `computed`, and local signal state for component UI state.
- Prefer `input()` / `input.required()` and `output()` for component boundaries.
- Use RxJS only at framework or IO boundaries, such as router data, HTTP streams, and cancellation-heavy flows.
- Convert router streams to signals with `toSignal()` when templates need reactive route data.
- Keep presentational components small, standalone, and `OnPush`.
- Prefer Tailwind utility classes in templates; add component SCSS only for complex selectors, animations, or browser-specific styling that utilities cannot express cleanly.
