# Construction workspace — 2026-10-02

The editor now previews complete product modules before placement. A pointer target near 7 m with a 2.5 m Vega panel proposes three panels across 7.5 m; that proposed endpoint is what gets committed. Existing projects are preserved, and their leftover gaps remain explicitly visible. This is still envelope planning: installed post pitch, foundations, connectors and unverified joins are not certified by a seamless drawing.

## User loop

1. Browse and configure a product. The primary placement action is directly below its name, with the placement limitation next to it when unavailable.
2. Start with a line, L, U or rectangle, or choose a start point on the plan.
3. Move the pointer for the proposed direction, quantity and realized length. Green previews can be confirmed with click/Enter. Click–click and press–drag–release both place a side. Numeric length shows the actual module length before placement.
4. Continue from the endpoint, or press Escape to select. The + handles explicitly continue an existing product, loading its parameters. Joining an existing endpoint ends drawing.
5. Drag an orthogonal corner to resize the linked aligned sides. Module lengths remain real. Invalid crossings, partial modules and incompatible joins are rejected atomically.
6. Select a side in either view to inspect/configure it. Product changes apply explicitly to a connected run by default. Undo uses the existing shared history manager.

The SVG footprints and Three.js viewport consume the same derived assembly. In plan mode the 3D viewport remains visible; full 3D is available without changing the project. Ghost placement does not enter history, storage or quantities. Decorative scenery has been removed from the dedicated viewer to keep the fence readable.

## Reuse

Retains shared shell, project actions, controls, history, surface geometry/materials/resource lifecycle, renderer, lighting and camera. New placement.js plans module endpoints and orthogonal moves over the existing graph validation. No new renderer, material system, catalog or backend is introduced. Catalog version and persistence schema remain unchanged.

## Verification

- 46 automated tests pass, including all 93 currently placeable panel models (13 mobile models): closed rectangles preserve product widths and have no remainder parts.
- Reject closure onto an endpoint at a non-module distance; reject crossing through a panel; allow crossing at module boundaries with one shared node.
- Preserve legacy gap positions while adding an independent zone.
- Corner move 10 × 5 m → 12.5 × 7.5 m yields 16 Vega panels and 40 m; original snapshot unchanged.
- Browser interaction: rectangle creation, corner drag, single undo restoring both sides, deletion and endpoint continuation, drag to close the perimeter.
- Browser mobile 390 × 844: select an endpoint of Deco Standard, request 6.99 m, see 6.90 m / 2 panels before confirming, then observe the new side in plan and shared scene.
- Browser product change: Vega 1.73 m / RAL6005 applied to connected run. Displayed example: 12 Vega panels, 6 Deco Standard panels, 12 OMEGA posts, 36 fixing sets, total 50.70 m.
- Reload restores the test project. Browser download-event capture timed out in the in-app browser; a fresh downloaded JSON/CSV roundtrip is not claimed for this revision. Existing serializer/unit roundtrip tests remain passing.
- Tests used a separate local origin on port 4174, preserving the user's drafts on port 4173.

## Boundaries

Only products with implemented parameters and an active reconstructed visual can be placed. Other products remain in the catalog with an explicit reason. This change does not claim the entire catalog is placeable. Unverified mixed-system joins and gates remain subject to existing documented compatibility. Free-angle vertex changes must satisfy real module lengths; orthogonal resizing propagates aligned nodes. Assemblies remain preliminary. Cloud provisioning/deployment was not changed.
