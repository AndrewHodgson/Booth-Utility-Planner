# Booth Utility Planner - Project Notes

## Purpose

Booth Utility Planner is a lightweight 2D utility layout tool for SourceOne Events. It helps exhibitors and SourceOne project managers communicate where power drops, WiFi, hanging signs, custom markers, and extension cords should be placed inside an event booth.

The app produces a SourceOne-branded PDF. It is not an ordering, pricing, payment, approval, account, or submission system.

## Current Workflow

1. User opens the app.
2. Setup modal collects contact, show, and booth details.
3. App creates a scaled 1 ft grid from booth width and depth.
4. User edits Front, Back, Left, and Right side labels from Booth Position or directly on the grid.
5. User chooses a tool from the grouped bottom toolbar.
6. User places power drops, WiFi, Hanging Sign, or Custom Marker items on the grid.
7. User edits selected item details in the right panel.
8. User draws Extension Cords from a drop or another extension cord endpoint.
9. User optionally uploads, crops, rotates, and fades a top-down booth image behind the grid.
10. User exports a category-based SourceOne PDF.
11. Browser localStorage preserves progress after refresh.

## Setup And Booth Details

Setup and Booth Details collect:

- Name
- Company
- Email
- Phone
- Booth #
- Show
- Date
- Location
- Booth Width
- Booth Depth
- Booth Type
- Flooring

Booth dimensions support preset 10 ft increments from 10 ft to 100 ft plus custom values. Width and depth are clamped between 1 ft and 100 ft. Default booth size is 20 ft x 20 ft.

Booth types:

- Inline
- Corner
- Peninsula
- End Cap
- Island

Flooring options:

- Choose Flooring (default; also used for planners saved before the field existed)
- Flooring Ordered
- No Flooring Ordered
- Unknown / Not Provided

Planners saved with the earlier option names are mapped on load: `Carpeted` → `Flooring Ordered`, `Not Carpeted` → `No Flooring Ordered`, `Unknown / Not Provided` is unchanged.

## Grid Rules

- Grid unit: 1 ft squares
- Placement and endpoint snapping: 0.5 ft
- Coordinates: x from left edge, y from front edge
- Front of booth is the visual bottom side of the grid
- Canvas supports pointer mode, pan mode, zoom in, zoom out, and fit screen
- Minimum zoom is 100%
- Large booths can render larger than the visible viewport; users pan instead of shrinking all tiles too small
- Optional booth image renders behind grid, markers, extension cords, labels, and measurement guides

## Editable Side Labels

Side labels exist for:

- Front
- Back
- Left
- Right

They can be edited from the Booth Position panel and by double-clicking labels around the grid. Custom text persists in `booth.sideLabels`.

PDF export draws side labels from the same state. Front/Back use centered horizontal anchors. Left/Right are rotated and their anchor is computed manually from `getTextWidth` (not jsPDF's `align: "center"`, which is unreliable with rotation) so custom text length never moves the visual gap from the grid.

## Bottom Toolbar

The bottom toolbar is visually grouped.

| Group | Tools |
|---|---|
| Canvas Tools | Pointer, Pan, Zoom controls, Fit Screen |
| Power & Cords | 120 Volt Single Phase, 208 Volt Single Phase, 208 Volt Three Phase, 480 Volt Three Phase, Extension Cord |
| Additional Utilities | WiFi, Hanging Sign, Custom Marker |

Canvas tools keep visible keyboard shortcut labels. Utility tools do not show shortcut labels and do not have utility keyboard shortcut behavior.

Toolbar display labels:

| Tool | Toolbar label |
|---|---|
| 120 Volt Single Phase | `120 V` / `1 Phase` |
| 208 Volt Single Phase | `208 V` / `1 Phase` |
| 208 Volt Three Phase | `208 V` / `3 Phase` |
| 480 Volt Three Phase | `480 V` / `3 Phase` |
| Extension Cord | `Extension` / `Cord` |
| WiFi | `WiFi` |
| Hanging Sign | `Hanging` / `Sign` |
| Custom Marker | `Custom` / `Marker` |

## Marker Types

| Tool | Internal value | Web toolbar shape/icon | PDF shape | Color |
|---|---|---|---|---|
| 120 Volt Single Phase | `120v` | Triangle | Triangle | Blue |
| 208 Volt Single Phase | `208v_single_phase` | Square | Square | Purple |
| 208 Volt Three Phase | `208v_three_phase` | Diamond | Diamond | Orange |
| 480 Volt Three Phase | `480v_three_phase` | Pentagon | Pentagon | Red |
| WiFi | `wifi` | WiFi icon | Circle marker ID on WiFi page | Green |
| Hanging Sign | `hanging_sign` | Circle | Circle | Cyan |
| Custom Marker | `custom_drop` | Hexagon | Hexagon | Gray |

Grid marker text is display-only and does not use internal labels:

| Tool | Grid label |
|---|---|
| 120 Volt Single Phase | `120 V 1P` |
| 208 Volt Single Phase | `208 V 1P` |
| 208 Volt Three Phase | `208 V 3P` |
| 480 Volt Three Phase | `480 V 3P` |
| WiFi | `WiFi` |
| Hanging Sign | `Hanging` |
| Custom Marker | `Custom` |

Numbered marker IDs appear inside applicable marker shapes and are used for PDF/table matching. These numbers use the same category-based counting as the PDF: all electrical drops share one sequence, Hanging Signs share one sequence, and Custom Markers share one sequence. The on-screen shape number matches the marker ID on the corresponding PDF page and in the detail tables. WiFi markers display the WiFi icon on the canvas rather than a numbered shape; they are still numbered sequentially in the PDF WiFi details table. Internal labels like `E1`, `W1`, `S1`, and `C1` remain in saved data for compatibility but are not shown to users.

## Amp Options

Amp options are type-specific.

| Drop type | Valid amps | Default |
|---|---|---|
| 120 Volt Single Phase | 10 AMP, 20 AMP | 10 AMP |
| 208 Volt Single Phase | 30 AMP, 60 AMP | 30 AMP |
| 208 Volt Three Phase | 20 AMP, 30 AMP, 60 AMP, 100 AMP, 200 AMP, 400 AMP | 20 AMP |
| 480 Volt Three Phase | 30 AMP, 60 AMP, 100 AMP, 200 AMP, 400 AMP | 30 AMP |

The quick on-grid amp prompt and Selected Item panel both use the same amp option map.

If a marker changes type and its current amp is invalid for the new type, the app resets to the new type's default. Saved planner data is sanitized the same way during load.

## Selected Item Behavior

The Selected Item panel changes by selected item type.

Power drops:

- Full type name
- Nearest-edge coordinate readout
- Type dropdown (lists power drops and WiFi; Hanging Sign and Custom Marker are not conversion targets and do not appear)
- Amp dropdown
- 24-hour power checkbox
- Notes
- Delete marker

WiFi:

- Full type name
- Nearest-edge coordinate readout
- Type dropdown (lists power drops and WiFi; Hanging Sign and Custom Marker are not conversion targets and do not appear)
- Speed dropdown: Basic, Standard, High Speed, Custom
- Notes
- Delete marker

Hanging Sign:

- Full type name
- Nearest-edge coordinate readout
- Height field: "How far is the hanging sign from the ground?"
- "Sign is rotating" checkbox
- Notes
- Delete marker
- No Type field, amps, speed, or 24-hour power controls

Custom Marker:

- Full type name
- Nearest-edge coordinate readout
- Notes
- Delete marker
- No Type field, amps, speed, or 24-hour power controls

Extension Cord:

- Extension Cord Label
- Connected source readout: shows "Marker N — Full Type Name" if connected to a marker, or "Extension Cord L1 endpoint" if connected to another cord's endpoint
- Endpoint location
- Notes
- Delete extension cord

The Delete key removes a selected marker or extension cord unless focus is in an input, textarea, select, or contenteditable field.

## Marker Selection And Guides

Users can select and drag markers. When selected, dotted measurement guides show the nearest horizontal and vertical booth-edge distances. The same nearest-edge logic is used in the Selected Item panel.

Deleting a marker removes all extension cords rooted at that marker and their entire descendant tree recursively (including cords branched from removed cords at any depth). Deleting an extension cord removes that cord and all its descendants recursively. Sibling cords branched from the same parent are not affected. No orphan endpoint chips or ghost PDF rows remain after deletion.

## Extension Cord Tool

The Extension Cord tool represents a utility run or cord from an existing point.

Behavior:

1. User selects Extension Cord.
2. User clicks a drop or existing extension cord endpoint to start.
3. User clicks a grid point to end.
4. Endpoint snaps to 0.5 ft.
5. New extension cord is selected and the app returns to pointer mode.
6. Users can edit extension cord label and notes in Selected Item.
7. Endpoints can be dragged.
8. Extension cords persist in localStorage and are exported to PDF.

Deletion cascade: deleting a marker removes all extension cords rooted at that marker and all their descendants recursively. Deleting an extension cord removes that cord and all cords branched from it at any depth. Sibling cords (branched from the same parent) are not affected.

Internal compatibility:

- Extension cord data is still stored as `UtilityLine`.
- Extension cords can start from a marker (`fromMarkerId`) or another extension cord endpoint (`fromLineId`).
- Existing saved `lines` arrays continue to load.

## Booth Image Upload, Crop, And Rotate

The Booth Image Upload panel lets the user add a top-down booth plan or render behind the grid.

Supported formats:

- PNG
- JPG
- JPEG

Rules:

- Maximum size: 5 MB
- Crop aspect ratio follows current booth width/depth
- Cropped image fits the booth grid area
- Image renders behind grid, markers, extension cords, labels, and measurement guides
- Default opacity is low so the grid remains readable
- Opacity can be adjusted from the right panel
- Remove image clears it from state
- Reset planner clears the image

Crop modal behavior:

- Drag/pan image
- Zoom slider
- Rotate Left and Rotate Right in 90-degree increments
- Apply Crop bakes crop, zoom, pan, and rotation into the saved data URL

If the uploaded image already matches the booth ratio within tolerance, it is resized and saved directly without forcing the crop modal.

If booth width/depth changes after an image is uploaded and the ratio no longer matches within tolerance, the Booth Image Upload panel shows a warning: "Booth dimensions changed. Re-upload or re-crop the booth image for the correct ratio." The image is not automatically deleted.

## Right Panel

Single-open accordion sections:

| Section | Contents |
|---|---|
| Help / How to Use | Compact numbered workflow, expanded by default |
| Booth Details | Contact/show fields, booth dimensions, booth type |
| Booth Position | Front, Back, Left, Right labels |
| Selected Item | Contextual marker or extension cord editing |
| Booth Image Upload | Upload/change/remove image and opacity |
| Export | PDF export button |

The panel footer contains the Reset planner button and a note that progress saves automatically in the browser.

## Help / How To Use

The Help / How to Use section is a simple collapsible right-panel section, not a modal or tour. It starts expanded by default and lists the main workflow:

1. Confirm event and booth info.
2. Add side labels.
3. Select a power drop.
4. Click the grid to place it.
5. Update Selected Item details.
6. Add extension cords if needed.
7. Optionally upload a booth image.
8. Export the PDF and email SourceOne.

## Persistence

The app saves one `PlannerState` object to:

```txt
sourceone-booth-utility-planner
```

Saved state includes:

- Contact/show/booth details
- Booth width, depth, and type
- Side labels
- Markers and marker details
- Extension cord data stored in `lines`
- Selected tool
- Cropped booth image data URL, opacity, filename, output size, and crop status
- Setup completion state

No server, database, user account, or cloud sync is involved.

If the localStorage write fails — typically because a large booth image data URL exceeds the storage quota — a non-blocking warning appears in the panel footer: "Could not save changes locally. The booth image may be too large." The planner remains fully usable and the warning clears on the next successful save.

Legacy behavior:

- Old `main_drop` markers migrate to `120v`.
- Old `custom_marker` markers migrate to `custom_drop`.
- Invalid amp values are replaced with the default amp for that marker type.

## PDF Export

PDF export uses jsPDF and produces portrait letter-size PDF pages. Export pages are category-based and blank categories are skipped.

Page order:

1. Electrical + Extension Cords
2. WiFi
3. Hanging Sign
4. Custom Marker

Common page content:

- SourceOne logo
- Title
- Show info line
- Booth info line (booth #, booth size, booth type, and flooring)
- Full booth footprint regardless of current zoom/pan
- Optional booth image behind the grid
- Neutral black/gray grid lines over the image
- Strong booth border
- Relevant utility markers with numeric IDs
- Relevant extension cords with endpoint chips and length labels
- Measurement guides from markers to nearest booth edges
- Stable side labels around the grid
- Footer with email, phone, and fax

Electrical + Extension Cords page:

- Includes all power drops and extension cords
- Legend for present power drop types and Extension Cord if applicable
- Drop Details: `ID | Type | Location | Details | Option | Notes`
- Extension Cord Details: `ID | Connected To | Connected Type | End Location | Notes`

WiFi page:

- Includes WiFi markers only
- Table: `ID | Location | Speed | Notes`

Hanging Sign page:

- Includes Hanging Sign markers only
- Table: `ID | Location | Height From Ground | Rotating | Notes`

Custom Marker page:

- Includes Custom Marker markers only
- Table: `ID | Location | Notes`

PDF marker IDs and table IDs use the same numbering helper. Internal labels like `E1` are not shown as table IDs. Extension cord rows describe source markers by PDF marker ID and visible type; extension-cord-to-extension-cord branches describe the source endpoint.

PDF side-label layout notes:

- `drawPdfSideLabels` draws all four labels.
- Front and Back use centered horizontal anchors (`align: "center"`, `baseline: "middle"`).
- Left and Right are rotated labels (angle 90 / 270) with manually computed anchors.
- jsPDF's `align: "center"` is NOT used for rotated text: its centering offset is applied in page-horizontal space before the rotation matrix, which shifts the label perpendicular to its reading direction by half the text width (so the gap from the grid would change with text length).
- Instead the rotated labels use `align: "left"` with the anchor computed manually from `getTextWidth`: half the text width offsets the anchor along the reading axis to vertically center on the grid, and `baselineToVisualCenter` offsets perpendicular to the baseline so the across-thickness center lands on a fixed line equidistant from the grid border. Left and Right share the same offset constant, so they are equidistant and text length never moves them.

## Current Data Models

```ts
type MarkerType =
  | '120v'
  | '208v_single_phase'
  | '208v_three_phase'
  | '480v_three_phase'
  | 'wifi'
  | 'hanging_sign'
  | 'custom_drop'

type AmpValue =
  | '10A'
  | '20A'
  | '30A'
  | '60A'
  | '100A'
  | '200A'
  | '400A'
  | ''

type UtilityMarker = {
  id: string
  label: string
  type: MarkerType
  x: number
  y: number
  amps?: AmpValue
  speed?: string
  is24Hour?: boolean
  hangingSignHeight?: string
  isRotating?: boolean
  notes?: string
}

type UtilityLine = {
  id: string
  fromMarkerId?: string
  fromLineId?: string
  toX: number
  toY: number
  label?: string
  notes?: string
}

type BoothDetails = {
  name: string
  companyName: string
  email: string
  phone: string
  boothNumber: string
  showName: string
  showDate: string
  showLocation: string
  width: number
  depth: number
  boothType: 'Inline' | 'Corner' | 'Peninsula' | 'End Cap' | 'Island'
  flooring: 'Choose Flooring' | 'Flooring Ordered' | 'No Flooring Ordered' | 'Unknown / Not Provided'
  sideLabels: {
    front: string
    back: string
    left: string
    right: string
  }
}
```

## Out Of Scope

- Pricing
- Payment
- User accounts
- Database storage
- Admin dashboard
- CAD/DXF export
- Non-rectangular booth shapes
- Direct email submission
- Approval workflow
- Shared cloud links

## Possible Future Enhancements

- Submit layout directly to SourceOne
- Email confirmation to exhibitor and SourceOne
- Save/share layout link
- Show-specific templates
- Event prefill
- Equipment served field
- Hardline internet/static IP options
- Import/export JSON layout
- Better mobile editing experience
- Booth furniture/object reference layer
- Image calibration against known booth dimensions
