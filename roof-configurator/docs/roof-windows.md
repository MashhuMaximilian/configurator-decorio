# Roof windows

Open **Edit roof layout** for any preset or drawn roof, choose **Add roof window**,
then click the slope to position its centre. Set width and height (both measured
in the slope plane), review the plan and isometric preview, and choose **Add
window**, followed by **Apply roof**.

Click an existing blue window or choose it from the window selector to resize,
reposition or delete it. Add, update and delete are single Undo/Redo steps.
Windows are stored inside the roof layout and included in saved/shared state.

The tool supports up to 30 closed, rectangular, uphill-aligned roof windows.
It checks the complete opening plus an 8 cm editing margin against one roof
plane, including concave outlines. It rejects overlaps, edge crossings and
folds through an opening. This geometric margin is not a manufacturer-specific
installation requirement. Roof edits that invalidate a window are rejected;
move or delete the window before making those edits.

The renderer cuts the covering and underlay and adds a generic frame and glazed
panel. The sheet planner subtracts openings from net covering area and shows
their cut lines; sheets crossing an opening may still need cutting. Window
supply, installation, flashing quantities and prices are not calculated.

Validation: `npm run check:roof` and `tests/roof-windows-browser.cjs` (port 8080).
Set `ROOF_TEST_BROWSER` for Chromium and optionally `ROOF_TEST_THREE` for local
Three.js modules to exercise all three coverings and verify clear roof openings.
