# Booth Utility Planner

Booth Utility Planner is a SourceOne Events web app for creating 2D booth utility layout plans. It helps exhibitors and project managers define booth details, place power drops and other utilities on a scaled grid, add extension cords, optionally add a booth image background, and export SourceOne-branded PDF pages by utility category.

The app is a layout and communication tool. It is not an ordering, pricing, payment, approval, or email submission system.

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Icons | lucide-react |
| Image crop | react-easy-crop + canvas helpers |
| PDF export | jsPDF |

Most app code lives in `src/App.tsx` and `src/App.css`. Image crop helpers live in `src/utils/cropImage.ts`.

## Running Locally

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run lint
npm run build
npm run preview
```

## User Workflow

1. Confirm event, exhibitor, and booth information in setup or Booth Details.
2. Confirm booth width, depth, and booth type.
3. Add neighboring booth or aisle labels for Front, Back, Left, and Right in Booth Position or directly on the grid.
4. Choose a tool from the bottom toolbar.
5. Place and edit drops/markers on the grid.
6. Add extension cords where needed.
7. Optionally upload, crop, rotate, and fade a top-down booth image behind the grid.
8. Export a SourceOne-branded PDF and send it to `exhibitorservices@sourceoneevents.com`.

## State And Persistence

The planner stores one `PlannerState` object in `localStorage` under:

```txt
sourceone-booth-utility-planner
```

Progress is saved automatically and restored on refresh.

```ts
type PlannerState = {
  booth: BoothDetails
  markers: UtilityMarker[]
  lines: UtilityLine[]
  selectedTool: MarkerType
  renderImage?: RenderImage
  hasCompletedSetup: boolean
}
```

Saved data includes booth details, side labels, markers, extension cord data, selected tool, setup completion state, and the cropped booth image. Reset planner returns to defaults and clears the uploaded image.

Compatibility notes:

- Legacy saved `main_drop` markers migrate to `120v`.
- Legacy saved `custom_marker` markers migrate to `custom_drop`.
- The internal extension cord data model still uses `UtilityLine`, `lines`, `fromLineId`, and related names for compatibility. User-facing copy calls these Extension Cords.
- `UtilityMarker.label` still exists for auto-labeling/internal compatibility, but grid marker text now uses utility display labels instead of internal labels like `E1` or `W1`.
- Saved amp values are validated on load and reset to a valid default if needed.

## Booth Details And Side Labels

The setup modal and Booth Details panel collect:

- Name
- Company
- Email
- Phone
- Booth #
- Show
- Date
- Location
- Width
- Depth
- Booth Type

Width and depth support preset 10 ft increments from 10 ft to 100 ft plus custom values clamped between 1 ft and 100 ft. The default booth is 20 ft x 20 ft.

Booth types:

- Inline
- Corner
- Peninsula
- End Cap
- Island

Booth Position stores editable labels for Front, Back, Left, and Right. Side labels can also be edited on the web grid by double-clicking them. They persist in `booth.sideLabels` and appear in PDF export.

## Grid Behavior

- 1 ft grid squares
- 0.5 ft snap placement and dragging
- Coordinates stored as feet from left and feet from front
- Front of booth is the visual bottom side
- Zoom in/out, pan, and fit screen controls
- Minimum zoom is 100%
- Large booths can exceed the visible viewport so squares remain usable; users pan around the larger canvas
- Optional booth image renders behind grid, markers, extension cords, labels, and measurement guides

## Bottom Toolbar

The bottom toolbar is grouped into three labeled sections.

### Canvas Tools

- Pointer
- Pan
- Zoom controls
- Fit Screen

Canvas tools keep keyboard shortcut labels and shortcut behavior.

### Power & Cords

- 120 Volt Single Phase
- 208 Volt Single Phase
- 208 Volt Three Phase
- 480 Volt Three Phase
- Extension Cord

Toolbar labels are compact two-line labels:

| Tool | Toolbar label |
|---|---|
| 120 Volt Single Phase | `120 V` / `1 Phase` |
| 208 Volt Single Phase | `208 V` / `1 Phase` |
| 208 Volt Three Phase | `208 V` / `3 Phase` |
| 480 Volt Three Phase | `480 V` / `3 Phase` |
| Extension Cord | `Extension` / `Cord` |

Power and extension cord tools do not have utility keyboard shortcut labels.

### Additional Utilities

- WiFi
- Hanging Sign
- Custom Marker

Toolbar labels:

| Tool | Toolbar label |
|---|---|
| WiFi | `WiFi` |
| Hanging Sign | `Hanging` / `Sign` |
| Custom Marker | `Custom` / `Marker` |

## Tool Types, Grid Labels, And Shapes

| Tool | Internal type | Web toolbar shape/icon | Grid marker label | PDF marker shape | Color |
|---|---|---|---|---|---|
| 120 Volt Single Phase | `120v` | Triangle | `120 V 1P` | Triangle | Blue |
| 208 Volt Single Phase | `208v_single_phase` | Square | `208 V 1P` | Square | Purple |
| 208 Volt Three Phase | `208v_three_phase` | Diamond | `208 V 3P` | Diamond | Orange |
| 480 Volt Three Phase | `480v_three_phase` | Pentagon | `480 V 3P` | Pentagon | Red |
| WiFi | `wifi` | WiFi icon | `WiFi` | Circle/WiFi category marker ID in PDF grid | Green |
| Hanging Sign | `hanging_sign` | Circle | `Hanging` | Circle | Cyan |
| Custom Marker | `custom_drop` | Hexagon | `Custom` | Hexagon | Gray |

Grid labels are user-facing utility labels only. Internal labels like `E1`, `W1`, `S1`, and `C1` are not shown as the grid text. Numbered marker IDs still appear inside applicable marker shapes and are used for selected items, extension cord connections, and PDF tables.

## Amp Options

Amp options are filtered by selected power drop type.

| Tool | Valid amps | Default |
|---|---|---|
| 120 Volt Single Phase | 10 AMP, 20 AMP | 10 AMP |
| 208 Volt Single Phase | 30 AMP, 60 AMP | 30 AMP |
| 208 Volt Three Phase | 20 AMP, 30 AMP, 60 AMP, 100 AMP, 200 AMP, 400 AMP | 20 AMP |
| 480 Volt Three Phase | 30 AMP, 60 AMP, 100 AMP, 200 AMP, 400 AMP | 30 AMP |

If a marker changes type and its current amp is invalid for the new type, the app resets the amp to the new type default. Existing saved data is sanitized the same way on load.

## Selected Item Panel

The Selected Item section edits the currently selected marker or extension cord.

Power drops:

- Show full type name
- Show nearest-edge coordinate readout
- Type dropdown
- Amp dropdown filtered by power type
- 24-hour power checkbox
- Notes
- Delete marker button

WiFi:

- Show full type name
- Show nearest-edge coordinate readout
- Type dropdown
- Speed dropdown: Basic, Standard, High Speed, Custom
- Notes
- Delete marker button

Hanging Sign:

- Show full type name
- Show nearest-edge coordinate readout
- Height text field labeled "How far is the hanging sign from the ground?"
- "Sign is rotating" checkbox
- Notes
- Delete marker button
- No Type field and no amp/speed field

Custom Marker:

- Show full type name
- Show nearest-edge coordinate readout
- Notes only
- Delete marker button
- No Type, amp/speed, or 24-hour power fields

Extension Cord:

- Extension Cord Label
- Connected drop readout
- Endpoint location
- Notes
- Delete extension cord button

The Delete key removes the selected marker or extension cord unless the user is typing in an input, textarea, select, or contenteditable field.

## Extension Cords

The Extension Cord tool represents a utility run from an existing point.

1. Select Extension Cord from the bottom toolbar.
2. Click a power drop or existing extension cord endpoint to start.
3. Click a grid point to place the endpoint.
4. The endpoint snaps to 0.5 ft.
5. The new extension cord is selected and the app returns to pointer mode.

Extension cords can start from either:

```ts
type UtilityLine = {
  id: string
  fromMarkerId?: string
  fromLineId?: string
  toX: number
  toY: number
  label?: string
  notes?: string
}
```

The internal type name remains `UtilityLine` for compatibility with existing saved layouts.

## Booth Image Upload

The Booth Image Upload panel supports a top-down booth plan or render behind the grid.

- Formats: PNG, JPG, JPEG
- Max file size: 5 MB
- Crop aspect ratio follows current booth width/depth ratio
- Crop modal supports drag/pan, zoom, and 90-degree rotate left/right
- Apply Crop bakes crop, zoom, pan, and rotation into a saved data URL
- If the uploaded image already matches the booth aspect ratio within tolerance, it is resized and saved directly
- Image opacity defaults low and is adjustable in the right panel
- The image renders behind the grid, markers, extension cords, labels, and measurement guides
- Remove image clears it from planner state
- Reset planner clears the image

## Help / How To Use

The right panel includes a `Help / How to Use` section near the top. It starts expanded by default and can be collapsed like the other panel sections.

The section gives first-time users a compact numbered workflow:

1. Confirm Booth Details.
2. Add Front/Back/Left/Right booth position labels.
3. Select a power drop from the toolbar.
4. Place it on the grid.
5. Update Selected Item details.
6. Add extension cords if needed.
7. Optionally upload a booth layout image.
8. Export the layout PDF and email SourceOne.

## PDF Export

PDF export uses jsPDF and generates portrait letter-size SourceOne-branded pages. Pages are created by category and blank categories are skipped.

Page categories:

1. Electrical + Extension Cords: all power drops and extension cords
2. WiFi: WiFi markers only
3. Hanging Sign: Hanging Sign markers only
4. Custom Marker: Custom Marker markers only

Every generated category page includes:

- SourceOne logo
- Booth Utility Planner title
- Show, location, date, booth number, booth size, and booth type
- Same booth grid and optional booth image/background
- Same Front, Back, Left, and Right side labels
- Relevant markers and extension cords only
- Relevant legend and details tables
- Footer contact info

Electrical + Extension Cords page:

- Legend for power drops and Extension Cord if present
- Drop Details table: `ID | Type | Location | Details | Option | Notes`
- Extension Cord Details table: `ID | Connected To | Connected Type | End Location | Notes`

WiFi page:

- WiFi legend/details only
- Table: `ID | Location | Speed | Notes`

Hanging Sign page:

- Hanging Sign legend/details only
- Table: `ID | Location | Height From Ground | Rotating | Notes`

Custom Marker page:

- Custom Marker legend/details only
- Table: `ID | Location | Notes`

PDF marker IDs match detail table IDs. Internal labels like `E1` are not used as table IDs. Extension cord rows describe connected markers by PDF marker number and visible type; branches from another extension cord describe the source endpoint.

PDF side labels are anchored from stable centers so custom side-label text does not change the visual gap from the grid. Left and Right labels account for jsPDF rotated text baseline behavior.

## SourceOne Contact

| | |
|---|---|
| Email | exhibitorservices@sourceoneevents.com |
| Phone | 708.344.3050 |
| Fax | 708.344.4111 |

## Known Constraints

- Browser-only persistence through localStorage; no accounts or cloud sync
- Rectangular booth footprints only
- No pricing, ordering, or payment workflow
- No CAD/DXF export
- No direct email submission
- Large production bundle currently triggers Vite's chunk-size warning

## Possible Future Improvements

- Submit layout directly to SourceOne
- Email confirmation to exhibitor and SourceOne
- Save/share layout link
- Show-specific templates and event prefill
- Equipment served field
- Hardline internet/static IP options
- Import/export JSON layout
- Better mobile editing experience
- Booth furniture/object reference layer
- Image calibration against known booth dimensions
