# Booth Utility Planner — Project Notes

## Project name

Booth Utility Planner

## Purpose

A lightweight web app for SourceOne Events that lets exhibitors and internal project managers create a clear booth utility layout plan. The primary use case is showing where electrical and WiFi drops should be placed inside an exhibit booth.

This is a layout generator, not an ordering or payment system. The final output is a clean SourceOne-branded PDF that users can download and email.

## Primary users

1. Exhibitors filling out their booth utility layout
2. SourceOne Events project managers using it onsite or during planning

## Design direction

- Clean canvas workspace
- Floating right-side panel
- Bottom toolbar for selecting placement tools
- Feels like a technical layout editor, not a 3D configurator
- SourceOne-branded throughout

---

## Core workflow

1. User opens the app.
2. Welcome/setup screen asks for contact, show, and booth details.
3. User selects booth width and depth.
4. App creates a rectangular 1-foot grid canvas.
5. User labels all four sides of the booth with adjacent booth numbers or aisle names.
6. User places electrical and WiFi drops using the bottom toolbar.
7. User selects placed drops to edit details in the right-side panel.
8. User can draw extension-cord lines from existing drops using the Line tool.
9. User optionally uploads a top-down booth reference image.
10. User exports a SourceOne-branded letter-size PDF.

---

## Setup screen fields

The opening modal collects:

- Name
- Company Name
- Email
- Phone Number
- Booth Number
- Show Name
- Show Date
- Show Location
- Booth Width (preset 10–100 ft or custom)
- Booth Depth (preset 10–100 ft or custom)
- Booth Type (Inline, Corner, Peninsula, End Cap, Island)

---

## Booth size and grid rules

- Grid unit: 1 ft squares
- Placement snapping: 0.5 ft increments
- Maximum booth size: 100 ft × 100 ft
- Minimum practical size: 10 ft × 10 ft
- Coordinates stored in feet (x from left edge, y from front edge)
- Large booths support zoom and pan

---

## Booth orientation

Users label all four sides:

- Front
- Back
- Left
- Right

Each side can have an adjacent booth number or aisle name.

---

## Canvas

The main workspace is a 2D grid:

- Rectangular booth footprint based on width × depth
- 1-foot grid lines
- 0.5-foot snap placement
- Side labels on all four sides
- Optional low-opacity booth reference image under the grid (PNG/JPG, max 5 MB)
- Utility markers placed on the grid
- Marker icons and type-name display
- Zoom controls, pan tool
- Selected marker state with distance guide lines
- Drag-to-move markers

Grid helper text ("Grid: 1 ft squares. Placement snaps to 0.5 ft.") appears below the grid, aligned to the grid's left edge.

---

## Bottom toolbar

Tools available in order:

| Tool | Behavior |
|---|---|
| Pointer / Select | Select and drag markers; select lines |
| Pan | Pan the canvas |
| 120 V | Place a 120 V electrical drop |
| 208 V Single Phase | Place a 208 V single-phase electrical drop |
| 208 V Three Phase | Place a 208 V three-phase electrical drop |
| 480 V Three Phase | Place a 480 V three-phase electrical drop |
| WiFi | Place a WiFi drop |
| Line | Draw a utility run from an existing drop to a grid point |
| Zoom out | Step zoom out |
| Zoom % | Read-only current zoom level |
| Zoom in | Step zoom in |
| Fit | Reset zoom and pan to default |

Pointer, Pan, and Fit are icon-only buttons with accessible labels. Electrical tool buttons show a shape icon and the voltage label.

---

## Drop icons

Electrical drops use geometric shape icons. Toolbar buttons show the shape only (no number). Placed markers on the grid show the shape with the marker's **instance number within its own type** — the first 120 V drop shows 1, the second shows 2; the first 208 SP drop also shows 1, and so on.

| Drop type | Shape | Color |
|---|---|---|
| 120 V | Triangle | Blue (#2563eb) |
| 208 V Single Phase | Circle | Purple (#7c3aed) |
| 208 V Three Phase | Square | Orange (#f97316) |
| 480 V Three Phase | Diamond | Red (#be123c) |
| WiFi | WiFi icon | Green (#047857) |

Grid markers display the drop type name (`120V`, `208 1P`, `208 3P`, `480 3P`, `WiFi`) with amps below for electrical drops, or speed below for WiFi if set.

---

## Electrical drops

Fields per electrical drop:

- Drop type (editable via dropdown in Selected Item panel)
- Amps (5A, 10A, 20A)
- 24-hour power toggle
- Notes

After placing an electrical drop, a small on-grid popup asks for amps. Amps can also be changed from the right panel.

---

## WiFi drops

Fields per WiFi drop:

- Speed (Basic, Standard, High Speed, Custom)
- Notes

---

## Line tool

The Line tool represents an extension cord or utility run coming off an existing drop.

Behavior:

1. User selects the Line tool.
2. User clicks an existing drop to start the line.
3. User clicks a grid point to end the line (snaps to 0.5 ft).
4. Line is created. Tool returns to Pointer mode.
5. Lines can be selected, labeled, and deleted.
6. Moving a connected drop updates the line's start point.
7. Deleting a drop deletes its connected lines.
8. Lines persist in localStorage.
9. Lines appear in the PDF grid and Line Details table.

Line data model:

```ts
type UtilityLine = {
  id: string
  fromMarkerId: string
  toX: number
  toY: number
  label?: string
  notes?: string
}
```

---

## Marker distance guides

When a marker is selected, dotted guide lines extend from the marker to the nearest edges of the booth. Distance labels appear on the guides showing how far the drop is from each edge.

---

## Booth reference image upload

Users can upload a top-down booth image as a reference layer.

- Supported formats: PNG, JPG
- Maximum file size: 5 MB
- Image is stretched to fill the booth footprint
- Image appears under the grid at low opacity
- Right panel allows upload, remove, and opacity adjustment
- Uploaded image appears in the exported PDF if present

---

## Right panel

Single-open accordion with six sections:

### Booth Details

Display and edit:
- Name, Company Name, Email, Phone
- Booth Number, Show Name, Show Date, Show Location
- Booth Width, Booth Depth
- Booth Type (Inline, Corner, Peninsula, End Cap, Island)

### Booth Position

Edit the four side labels:
- Front, Back, Left, Right

### Selected Item

Shown when a drop or line is selected.

- If nothing is selected: `Please select a drop or line on the grid to edit its details.`
- If a drop is selected: type dropdown, coordinate readout, amps/speed fields, 24-hour toggle (electrical), notes, delete button
- If a line is selected: line label, connected drop readout, endpoint readout, notes, delete button

### Booth Render Upload

- Upload a PNG/JPG reference image
- Adjust opacity
- Remove image

### Export

- Export PDF button

### Help

- Email: exhibitorservices@sourceoneevents.com
- Phone: 708.344.3050
- Fax: 708.344.4111

### Reset planner

A **Reset planner** button sits at the bottom of the right panel, below all accordion sections. Resetting clears all state including markers, lines, and booth details.

---

## Browser persistence

State saves automatically to `localStorage` on every change under the key `sourceone-booth-utility-planner`.

Saved data:
- Contact/show/booth details
- Booth width, depth, booth type
- Side labels
- Placed markers and all marker fields
- Lines and all line fields
- Uploaded reference image and opacity
- Selected tool

No user accounts needed.

Old sessions that stored a `main_drop` marker type are automatically migrated to `120v` on load.

---

## PDF export

Generates a letter-size portrait PDF.

Structure:

**Header**
- SourceOne logo (top left)
- Title: Booth Utility Planner
- Show info: `Show: [name] | Location: [location] | Date: [date]`
- Booth info: `Booth #: [number] | Booth Size: [W]ft x [D]ft | Booth Type: [type]`

**Grid section**
- Full booth grid (not cropped to current zoom/pan)
- Optional reference image under the grid
- Placed markers with instance numbers and amps/speed
- Colored dotted distance guide lines with labels
- Side labels on all four sides
- Utility lines

**Below grid**
- Legend (only types present in the layout)
- Drop Details table: Type, Location, Amps/Speed, 24 Hour, Notes
- Line Details table (if lines exist): ID, Connected Drop, End Location, Notes

**Footer (every page)**
- `Email: exhibitorservices@sourceoneevents.com | Phone: 708.344.3050 | Fax: 708.344.4111`

PDF is not cropped to the current zoom or pan state — always shows the full booth.

---

## Marker data model

```ts
type UtilityMarker = {
  id: string
  label: string        // auto-generated (e.g. E1, W1); kept for internal use
  type: '120v' | '208v_single_phase' | '208v_three_phase' | '480v_three_phase' | 'wifi'
  x: number            // feet from left edge
  y: number            // feet from front edge
  amps?: '5A' | '10A' | '20A' | ''
  speed?: string
  is24Hour?: boolean
  notes?: string
}
```

The `label` field is auto-generated and used internally (e.g. the "Connected Drop" column in the PDF line table). It is not exposed as an editable field in the UI.

---

## Booth details data model

```ts
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

---

## Out of scope

- Payment or pricing
- User accounts or authentication
- Admin dashboard
- CAD/DXF export
- Non-rectangular booth shapes
- Manual image calibration
- Multiple service entry points
- Complex electrical validation
- Direct email submission
- Database storage
- Approval workflow

## Possible future enhancements

- Submit layout directly to SourceOne
- Email confirmation to user and SourceOne
- Save/share layout link
- Show-specific templates
- Pre-filled event data
- More amp options (30A, 50A, 100A)
- Equipment served field
- Hardline internet / static IP option
- Import/export JSON layout
- Better mobile editing experience
- Booth furniture / object reference layer
