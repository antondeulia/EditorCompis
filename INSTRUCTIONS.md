IMPORTANT!
Dont use gradients, backgrounds for elements (unless I didnt ask to). Make minimalistic, useful UI without any extra useless infos, tags and similar, keep small font size and small font weight.

# AI Video Editor Project Instructions

## Mission

This project is not a throwaway prototype.
It is the foundation of a scalable AI Video Editor.
Every change must improve the codebase in a way that supports long-term development, maintainability, and future growth.

## Core Rules

1. Write clean, deterministic, production-grade code.
2. Prefer clear architecture over quick hacks.
3. Build scalable systems, not temporary implementations.
4. Use proper folder structure, proper naming, and proper separation of responsibilities.
5. Use all needed libraries for the best output, but only when those libraries are the correct long-term choice.
6. Do not create code that will obviously need to be rewritten soon.
7. Treat every meaningful feature as part of a real product, not a demo.

## Clean Code Standards

1. Code must be readable, maintainable, and easy to extend.
2. Keep modules focused and cohesive.
3. Avoid giant files with mixed responsibilities.
4. Prefer explicit code over hidden behavior and magic abstractions.
5. Use TypeScript properly and avoid `any` unless absolutely necessary and justified.
6. Favor simple, strong patterns over clever but fragile code.
7. Remove duplication when it creates maintenance cost, but do not abstract too early.
8. Leave the codebase cleaner after every task.
9. Comments should explain intent or non-obvious reasoning, not restate the code.
10. Do not leave placeholder code, dead code, fake abstractions, or misleading TODOs.

## Architecture Rules

1. Organize code by domain and responsibility.
2. Separate UI, business logic, state, services, infrastructure, and shared utilities.
3. Do not bury business logic inside page files or simple presentational components.
4. Prefer composition over monolithic structures.
5. Framework-specific code must not leak into core editor logic without a good reason.
6. Core editor systems should be designed so they can grow without major rewrites.
7. Each subsystem should have clear boundaries and predictable ownership.

## Component Rules

1. Break UI into meaningful, reusable components.
2. Components should have a single clear responsibility whenever possible.
3. Do not mix rendering, business logic, networking, and editor state handling in one component unless there is a strong reason.
4. Keep route files and page files thin.
5. Use shared UI components only for real reuse, not as dumping grounds.
6. Prefer feature-specific components for feature-specific behavior.
7. Component names must be intentional and professional from the start.

Good examples:

- `TimelinePanel`
- `ProjectSidebar`
- `ClipInspector`
- `RenderQueueStatus`
- `AssetUploadDialog`

Bad examples:

- `TempComponent`
- `NewSection`
- `Block`
- `Thing`
- `VideoStuff`

## Naming Rules

1. Use descriptive, domain-accurate names.
2. Every file, variable, type, component, hook, service, and folder must have a clear purpose reflected in its name.
3. Do not use vague names like `data`, `item`, `helper`, `utils`, `temp`, `common`, `misc`, or `stuff` unless the context is truly generic.
4. File names should match the main concept they contain.
5. Use consistent naming conventions across the whole project.

Recommended conventions:

- Components: `PascalCase`
- Hooks: `useSomething`
- Service modules: purpose-based names
- Domain files: concept-based names
- Folders: lowercase and meaningful

## File and Folder Structure

Do not dump most code into `app/`.
Use a scalable structure with clear ownership.

Recommended direction:

```text
app/
  (routing, layouts, route-level composition only)

components/
  ui/
  layout/
  editor/
  project/
  media/

features/
  timeline/
    components/
    hooks/
    state/
    services/
    types/
  assets/
    components/
    services/
    types/
  playback/
    components/
    state/
    services/
  rendering/
    components/
    services/
    state/
    types/
  ai-editing/
    components/
    services/
    prompts/
    types/

lib/
  domain/
  services/
  api/
  state/
  validations/
  utils/

types/

constants/
```

Rules:

1. `app/` should mostly contain route composition and app shell concerns.
2. Shared UI primitives should be separated from feature UI.
3. Feature logic should live close to the feature that owns it.
4. Shared code should move to global folders only when it is truly shared.
5. Avoid random file placement.

## Feature Architecture Rules

1. Prefer feature-oriented modules for non-trivial functionality.
2. A feature may own its components, hooks, state, services, types, and internal helpers.
3. Features should remain understandable in isolation.
4. Avoid large generic folders with unclear ownership.
5. Extract cross-feature code only when the reuse is real and stable.

## Domain Modeling Rules

1. Model real editor concepts explicitly.
2. Use strong domain types for concepts such as:
   - `EditorProject`
   - `Sequence`
   - `TimelineTrack`
   - `TimelineClip`
   - `MediaAsset`
   - `Transition`
   - `EffectStack`
   - `RenderJob`
   - `AiEditTask`
3. Do not let raw API response shapes dictate internal domain design.
4. Make important relationships explicit.
5. Avoid generic objects for critical editor data.

## State Management Rules

1. Keep state where it belongs, but do not trap important editor state inside fragile UI trees.
2. Separate transient UI state from persistent editor state.
3. State design must support future complexity.
4. Keep data flow understandable and predictable.
5. Prefer structures that can support:
   - undo and redo
   - timeline selection
   - playback state
   - asset processing
   - render pipelines
   - background AI jobs
   - project save/load behavior
6. Do not choose a state solution only because it is the quickest to wire up.

## Service and API Layer Rules

1. Put networking, persistence, background jobs, and external integrations behind service boundaries.
2. UI components should not manually own low-level request logic everywhere.
3. Separate concerns such as:
   - project persistence
   - asset ingestion
   - AI task submission
   - AI job polling
   - export/render execution
4. Validate and normalize important data at system boundaries.
5. Keep route handlers, server actions, and service modules clearly separated by responsibility.

## Validation Rules

1. Validate important external input.
2. Validate API payloads, form payloads, persisted data, and editor commands when appropriate.
3. Prefer schema validation for critical boundaries.
4. Never blindly trust serialized or external data inside core systems.

## Technology Selection Rules

1. Choose technologies that are mature, stable, and production-appropriate.
2. Do not choose tools only because they are trendy.
3. Prefer fewer strong dependencies over many weak ones.
4. Add libraries only when they clearly improve correctness, maintainability, performance, scalability, or developer experience.
5. Avoid temporary technologies that will likely need replacement later.
6. If a strong library is the right tool, use it instead of reinventing a weak internal version.
7. Every dependency should have a clear architectural reason to exist.
8. Prefer best-fit technologies for a serious AI editor platform, not short-term convenience.

Technology mindset:

- TypeScript first
- production-grade state management
- strong validation at boundaries
- reliable data fetching and persistence patterns
- architecture that can support heavy editor workflows

## Performance Rules

1. Be performance-aware, especially for editor-like interfaces.
2. Avoid unnecessary rerenders and oversized client components.
3. Do not place expensive derived logic directly in render paths without reason.
4. Design for responsiveness as complexity grows.
5. Do not prematurely micro-optimize, but do not ignore obvious scaling risks.

## Testing and Reliability Rules

1. Write code that is testable by design.
2. Keep pure logic separate where possible.
3. Important logic should not depend on UI rendering details.
4. Critical behavior should have deterministic contracts.
5. Structure code so future unit and integration testing is straightforward.

## Error Handling Rules

1. Error handling must be intentional.
2. Distinguish between user-facing errors, validation errors, system failures, and background job failures.
3. Do not silently swallow important failures.
4. Recoverable states should be represented clearly.
5. Error paths should be as understandable as success paths.

## Documentation Rules

1. Prefer self-explanatory structure and naming first.
2. Document important architectural decisions when they are not obvious.
3. If a tradeoff matters, record the reasoning briefly.
4. Keep documentation aligned with the actual codebase.

## AI Agent Behavior

When working in this repository, the AI must:

1. Think long-term, not just about the current task.
2. Put code in the correct files and folders from the beginning.
3. Use professional names from the first implementation.
4. Break large logic into proper modules and components.
5. Avoid temporary solutions unless explicitly requested.
6. Prefer scalable architecture over quick patchwork.
7. Suggest or use better technologies when the current approach is too weak for the product direction.
8. Keep pages, layouts, and route files clean and focused.
9. Build subsystems like real subsystems, not like one-off patches.
10. Make decisions that reduce future rewrites.

## What To Avoid

Do not:

1. Create giant components or giant files.
2. Put complex logic directly into pages without reason.
3. Use weak names, placeholder names, or fake abstractions.
4. Scatter related logic across random files.
5. Introduce libraries without strong justification.
6. Build tightly coupled systems that are hard to extend.
7. Optimize only for speed of implementation.
8. Hardcode structures that should be modeled properly.
9. Choose temporary solutions when a better scalable option is reasonable.
10. Treat long-term features like short-lived demos.

## Definition of Done

A task is not done unless:

1. The code is clean and understandable.
2. Responsibilities are split correctly.
3. Naming is intentional and professional.
4. Files and folders are organized logically.
5. The solution is scalable.
6. The technology choices are appropriate.
7. The implementation supports future growth of the AI Video Editor.

P.s. dont use landing page templates, font sizes should be small (16px, including titles, same for font-weight), the code should be clean, DRY, best practices, most important - scalable, dont use gradients, backgrounds for elements (unless I didnt ask to)
