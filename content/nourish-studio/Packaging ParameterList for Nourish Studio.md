---
title: Packaging ParameterList for Nourish Studio
categories: decisions
---

Shipping a private npm package exporting a render-only `ParameterList` for use by [[Nourish Studio]]'s interaction builder preview. Studio supplies the parameters to display; the package only renders them.

Part of [[Nourish Studio]]. Source lives in `nourish-organisations`.

## Why A Package, Not A Source Move

The renderer lives inside the timeline parameter stack in `nourish-organisations` and is coupled to app stores, helpers, translations, and interaction state. Studio has none of that. Moving source would carry unstable internals across the boundary.

A private npm package preserves source ownership in `nourish-organisations` and gives Studio a normal dependency boundary.

## v1 Scope

Render-only preview. Studio passes explicit parameter args; the package renders them. No interaction-state dependencies.

The package exposes a narrow `PreviewParameter` contract rather than the full `Parameter` model. The full model imports app-specific types that would leak unstable internals into the consumer API.

## Open Questions

- Which parameter types must Studio preview in v1, and which fall back to a generic unsupported renderer?
- Should Studio supply already-resolved display values for dataset/person/event-derived parameters, or should the package eventually own that enrichment?

## Checklist
- [x] Identify where the current parameter rendering logic lives
- [x] Confirm Studio does not yet contain `ParameterList`
- [x] Evaluate packaging without moving source files — confirmed viable
- [x] Decide delivery model: private npm package
- [x] Decide v1 scope: render-only preview with explicit args
- [ ] Define the narrow `PreviewParameter` contract
- [ ] Identify which parameter types are supported in v1 preview
- [ ] Design the preview-safe base renderer and package entrypoint
- [ ] Define build, publish, and install steps for the first release
- [ ] Implement and validate local package consumption in Studio

## Links
- npm scopes: https://docs.npmjs.com/about-scopes
- npm private packages: https://docs.npmjs.com/creating-and-publishing-private-packages
- Vite library mode: https://vite.dev/guide/build.html
