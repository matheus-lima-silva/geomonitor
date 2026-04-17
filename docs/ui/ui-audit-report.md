# UI Audit Report - Active Flows

Date: 2026-03-05
Scope: auth, app shell, dashboard and lazy-loaded active tabs.
Method: `ui-standardization` + iterative `ralph-loops`.

## Baseline Summary

- `InspectionFormWizardModal.jsx` raw controls: `51`
- Token gate matches (`focus:ring-blue|focus:border-blue|bg-[#eef3fb]` in `src/views src/layout src/features`): `>0`
- Hardcoded app background (`bg-[#eef3fb]`): present in `AppShell` and `AuthView`
- UI test baseline (target suite): 4 failing tests

## Implemented Changes

1. Foundation and primitives
- Added semantic color aliases in `tailwind.config.js` (`app`, `neutral`, `info`, expanded `brand` scale).
- Added app background token in `src/styles.css` via `--app-bg`.
- Added visible keyboard focus ring to `src/components/ui/Button.jsx`.
- Added `src/components/ui/Textarea.jsx`.
- Added `src/components/ui/IconButton.jsx`.
- Updated `src/components/ui/index.js` exports.

2. Critical hotspot (inspection wizard)
- Refactored `src/features/inspections/components/InspectionFormWizardModal.jsx`.
- Replaced multiple ad-hoc controls with `Button`, `IconButton`, `Input`, `Select`, `Textarea`.
- Removed blue hardcoded focus/background classes and converged to brand/info tokens.

3. Secondary hotspots
- Refactored key actions in `src/features/projects/components/ProjectsView.jsx` to `Button`/`IconButton`.
- Refactored parts of `src/features/projects/components/KmlReviewModal.jsx` to use `Input`.
- Refactored report/work follow-up form controls in `src/features/followups/components/FollowupsView.jsx` to `Input/Select/Textarea`.
- Refactored JSON editor field in `src/features/admin/components/AdminView.jsx` to `Textarea`.

4. Global consistency
- Replaced `bg-[#eef3fb]` with `bg-app-bg` in:
  - `src/layout/AppShell.jsx`
  - `src/views/AuthView.jsx`
- Extracted dashboard chart colors to semantic map:
  - Added `src/features/monitoring/utils/monitoringColors.js`
  - Updated `src/views/DashboardView.jsx` to consume semantic color helpers.

5. Test hardening
- Fixed prior failing tests:
  - `KmlReviewModal.test.jsx` accent expectation (`Válidas`).
  - `FollowupsView.test.jsx` selection logic by semantic row lookup and heading.
  - `DashboardView.monitoring.test.jsx` header expectation alignment (`Status op.`).
- Added new primitive regression tests:
  - `src/components/ui/__tests__/Button.test.jsx`
  - `src/components/ui/__tests__/Textarea.test.jsx`

## After Metrics

- `InspectionFormWizardModal.jsx` raw controls: `10` (from `51`)
- Token gate matches (`focus:ring-blue|focus:border-blue|bg-[#eef3fb]`): `0`
- Hardcoded app background matches (`bg-[#eef3fb]`): `0`
- `Button` focus-visible rule present: `1` (enforced in base class)

## Validation Evidence

- Target UI suite:
  - `npm run test -- src/components/ui/__tests__/Button.test.jsx src/components/ui/__tests__/Textarea.test.jsx src/layout/__tests__/AppShell.test.jsx src/features/projects/components/__tests__/ProjectsView.test.jsx src/features/projects/components/__tests__/KmlReviewModal.test.jsx src/features/followups/components/__tests__/FollowupsView.test.jsx src/features/inspections/components/__tests__/InspectionsView.wizard.test.jsx src/views/__tests__/DashboardView.monitoring.test.jsx`
  - Result: all tests passed.
- Build:
  - `npm run build`
  - Result: success.

## Remaining P3/P4 Items

- Some table-heavy modules still keep native controls for dense editing grids where primitive wrappers can degrade table compactness.
- Optional next pass:
  - Introduce table-optimized field primitives (`InlineInput`, `InlineSelect`, `InlineTextarea`) without label wrapper.
  - Continue migrating remaining ad-hoc buttons in low-traffic areas.

---

## Components added after 2026-03-05 (reports module)

The `reports` feature area grew substantially in April 2026, adding five new modals/panels to support the workspace trash/archive pipeline and member management. All of them reuse the design primitives (`Button`, `Input`, `Textarea`, `Modal`, `Select`, `IconButton`, `SearchableSelect`) audited above — no new ad-hoc controls were introduced.

### `src/features/reports/components/TrashExpandedModal.jsx`

Large modal for the photo trash. Props: `open`, `onClose`, `photos`, `onRestore`, `onArchive`, `onEmpty`, `onArchiveOlder`.

- Sort options (`SORT_OPTIONS`): deleted desc/asc, caption A-Z, tower A-Z.
- Paginated list: `PAGE_SIZE = 24` default, selectable via `Select` (`[12, 24, 48, 96]`).
- Tower filter dropdown (`Select`) tied to `groupPhotosByTower()` output, letting operators apply bulk restore/archive to a single tower.
- Bulk archive uses `OLD_THRESHOLD_DAYS = 30` as the default retention horizon.
- Uses `Button` for primary actions and preserves focus ring tokens from the primitives.

### `src/features/reports/components/ArchivedDeliveriesPanel.jsx`

Panel embedded in the compound detail screen showing versioned deliveries. Props: `compoundId`, `compoundName`, `refreshToken`, `showToast`.

- Lists `report_archives` rows returned from `listArchives(compoundId)`.
- Two download variants per row (`generated`, `delivered`) via `Button`; disabled state when no `deliveredMediaId`.
- SHA256 rendered truncated (`shortSha` helper) for visual inspection.
- No bespoke styling — relies on `Button` primitive and existing brand tokens.

### `src/features/reports/components/UnclassifiedWorkspacesModal.jsx`

Global modal to retroactively link workspaces lacking `inspection_id`. Props: `open`, `unclassifiedWorkspaces`, `inspections`, `projectNamesById`, `busy`, `onAssign`, `onCreateInspection`.

- Fires independently of the active filter in `WorkspacesTab`, exposing every pending workspace regardless of UI state.
- Per-row `Select` with inspections indexed by project, sorted by `dataInicio` desc.
- Inline "create inspection" form (`Input` + `Button`) avoids a modal-in-modal pattern.
- Keyboard nav preserved via the primitives' focus ring.

### `src/features/reports/components/DeliveryUploadModal.jsx`

Upload wizard for final delivery files (`.pdf` or `.docx`). Props: `open`, `onClose`, `compoundId`, `compoundName`, `userEmail`, `onDelivered`, `showToast`.

- Step machine (`step` state: `idle → creating → uploading → attaching → done`) with `Button` primary disabled while step ≠ idle.
- File input accepts `application/pdf` and `.docx` via both `type` and extension whitelist.
- SHA256 computed client-side (`computeFileSha256`) before upload for integrity.
- Notes via `Textarea` primitive.

### `src/features/reports/components/WorkspaceMembersModal.jsx`

Member management for a workspace. Props: `open`, `onClose`, `workspaceId`, `workspaceName`, `canManage`.

- Role picker via `Select` with options `owner` / `editor` / `viewer`.
- User picker uses `SearchableSelect` for large user lists.
- Role badges use Tailwind color tokens (`amber`, `sky`, `slate`) consistent with existing status chips elsewhere.
- Delete uses `IconButton` with `canManage` gating; the API refuses to remove the last `owner`.

## Follow-up suggestions

- Add regression tests for the paginated trash modal (cover page boundaries, empty pages, filter + sort interaction). Existing tests cover `WorkspacesTab.lixeira` but not the modal's pagination edge cases.
- Consider extracting the "status machine button" pattern from `DeliveryUploadModal` into a primitive, as similar step state flows exist in the KMZ import UI.
