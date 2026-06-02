# Booth Utility Planner - Project Notes

## Purpose

Booth Utility Planner is a lightweight 2D utility layout tool for SourceOne Events. It helps exhibitors and SourceOne project managers communicate where electrical drops, WiFi drops, and utility runs should be placed inside a booth.

The app is a layout generator. It is not an ordering, pricing, payment, or approval system. The main deliverable is a SourceOne-branded PDF that can be downloaded and shared.

## Current Workflow

1. User opens the app.
2. Setup modal collects contact, show, and booth details.
3. App creates a 1 ft booth grid based on width and depth.
4. User edits side labels for Front, Back, Left, and Right.
5. User places electrical and WiFi drops from the bottom toolbar.
6. User edits selected drop details in the right panel.
7. User draws utility runs with the Line tool.
8. User optionally uploads, crops, rotates, and fades a booth image behind the grid.
9. User exports a SourceOne-branded PDF.
10. Browser localStorage preserves progress after refresh.

## Setup Details

The setup modal collects:

- Name
- Company Name
- Email
- Phone Number
- Booth Number
- Show Name
- Show Date
- Show Location
- Booth Width
- Booth Depth
- Booth Type

Booth dimensions support preset 10 ft increments from 10 ft to 100 ft plus custom values. Internally, width and depth are clamped between 1 ft and 100 ft. Default booth size is 20 ft x 20 ft.

Booth types:

- Inline
- Corner
- Peninsula
- End Cap
- Island

## Grid Rules

- Grid unit: 1 ft squares
- Placement snapping: 0.5 ft
- Coordinates: x from left edge, y from front edge
- Front of booth is the visual bottom side of the grid
- Canvas supports zoom and pan
- The Fit button resets zoom to 1 and pan to origin
- Side labels sit around the four grid sides
- Optional booth image renders under the grid and all markers/lines/guides

## Editable Side Labels

Side labels exist for:

- Front
- Back
- Left
- Right

They can be edited from the Booth Position panel and directly on the grid via double-click. Custom text persists in `booth.sideLabels`.

PDF export draws side labels from the same state. PDF side labels are measured and anchored from stable centers so custom text should not shift the visual gap from the grid.

## Drop Types

| Type | Internal value | Shape/icon | Color |
|---|---|---|---|
| 120 V | `120v` | Triangle | Blue |
| 208 V Single Phase | `208v_single_phase` | Circle | Purple |
| 208 V Three Phase | `208v_three_phase` | Square | Orange |
| 480 V Three Phase | `480v_three_phase` | Diamond | Red |
| WiFi | `wifi` | WiFi icon | Green |

Placed electrical markers show type and amp information on the web grid. WiFi markers show speed when set. PDF marker circles use a simplified numeric ID.

## Amp Options

Amp options are type-specific.

| Drop type | Valid amps | Default |
|---|---|---|
| 120 V | 10 AMP, 20 AMP | 10 AMP |
| 208 V Single Phase | 30 AMP, 60 AMP | 30 AMP |
| 208 V Three Phase | 20 AMP, 30 AMP, 60 AMP, 100 AMP, 200 AMP, 400 AMP | 20 AMP |
| 480 V Three Phase | 30 AMP, 60 AMP, 100 AMP, 200 AMP, 400 AMP | 30 AMP |

The quick on-grid amp prompt and the Selected Item panel both use the same option map.

If a marker changes type and its current amp is invalid for the new type, the app resets to the new type's default. Saved planner data is sanitized the same way during load.

## WiFi Options

WiFi markers use speed instead of amps:

- Basic
- Standard
- High Speed
- Custom

WiFi drops do not use 24-hour power.

## Marker Selection And Guides

Users can select and drag markers. When selected, dotted measurement guides show the nearest horizontal and vertical booth-edge distances. The same nearest-edge logic is used in the Selected Item panel readout.

Deleting a marker also removes lines that start from that marker and line branches that depend on removed lines.

## Line Tool

The Line tool represents a utility run or extension from an existing point.

Behavior:

1. User selects Line.
2. User clicks a drop or existing line endpoint to start.
3. User clicks a grid point to end.
4. Endpoint snaps to 0.5 ft.
5. New line is selected and the app returns to pointer mode.
6. Users can edit line label and notes in the Selected Item panel.
7. Line endpoints can be dragged.
8. Lines persist in localStorage and are exported to PDF.

Lines can start from either:

- A marker (`fromMarkerId`)
- Another line endpoint (`fromLineId`)

Line Details in PDF describes drop connections by PDF marker ID and visible drop type. For line-to-line branches, it shows the source line endpoint rather than pretending it is a drop.

## Booth Image Upload, Crop, And Rotate

The Booth Image Upload panel lets the user add a top-down booth plan or render behind the grid.

Supported formats:

- PNG
- JPG
- JPEG

Rules:

- Maximum size: 5 MB
- Crop aspect ratio follows current booth width/depth
- Cropped image fits the booth grid area, not the browser window
- Image renders behind grid, markers, lines, labels, and measurement guides
- Default opacity is low so the grid remains readable
- Opacity can be adjusted from the right panel
- Remove image clears it from state
- Reset planner clears the image

Crop modal behavior:

- Drag/pan image
- Zoom slider
- Rotate Left and Rotate Right in 90-degree increments
- Apply Crop bakes crop, zoom, pan, and rotation into the saved image data URL

If the uploaded image already matches the booth ratio within tolerance, it is resized and saved directly without forcing the crop modal.

## Right Panel

Single-open accordion sections:

| Section | Contents |
|---|---|
| Booth Details | Contact/show fields, booth dimensions, booth type |
| Booth Position | Front, Back, Left, Right labels |
| Selected Item | Drop or line editing |
| Booth Image Upload | Upload/change/remove image and opacity |
| Export | PDF export button |
| Help | SourceOne contact info |

The panel footer contains the Reset planner button and a note that progress saves automatically in the browser.

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
- Lines and line details
- Selected tool
- Cropped booth image data URL, opacity, filename, output size, and crop status
- Setup completion state

No server, database, user account, or cloud sync is involved.

Legacy behavior:

- Old `main_drop` markers migrate to `120v`.
- Old invalid amp values are replaced with the default amp for that marker's type.

## PDF Export

PDF export uses jsPDF and produces a portrait letter-size PDF.

Header:

- SourceOne logo, fit proportionally so it is not distorted
- Title
- Show info line
- Booth info line

Grid:

- Full booth footprint regardless of current zoom/pan
- Optional booth image behind the grid
- Neutral black/gray grid lines over the image
- Strong booth border
- Utility markers with numeric IDs only
- Utility lines with endpoint chips and length labels
- Measurement guides from markers to nearest booth edges
- Stable measured side labels around the grid

Tables:

- Legend includes only marker types present in the plan
- Drop Details: `ID | Type | Location | Amps / Speed | 24 Hour | Notes`
- Line Details: `ID | Connected Drop ID | Connected Drop Type | End Location | Notes`

PDF marker IDs, Drop Details IDs, and Line Details connected drop IDs use the same numbering helper. Internal labels like `E1` are not shown in PDF tables.

Footer:

- Email, phone, and fax on every page

## Current Data Models

```ts
type MarkerType =
  | '120v'
  | '208v_single_phase'
  | '208v_three_phase'
  | '480v_three_phase'
  | 'wifi'

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
  sideLabels: {
    front: string
    back: string
    left: string
    right: string
  }
}
```

`UtilityMarker.label` still exists for internal compatibility and auto-labeling, but it is not shown as the primary identifier in the PDF.

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
