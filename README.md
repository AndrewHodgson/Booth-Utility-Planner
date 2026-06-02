# Booth Utility Planner

A web app for SourceOne Events that lets exhibitors and project managers create a booth utility layout plan — showing where electrical and WiFi drops should be placed inside an exhibit booth.

The final output is a SourceOne-branded PDF that users can download and share.

---

## Tech stack

| Layer | Library |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Icons | lucide-react |
| PDF export | jsPDF |

The entire app lives in two files: `src/App.tsx` (components, state, PDF logic) and `src/App.css`.

---

## Running locally

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build    # production build (tsc + vite build)
npm run preview  # preview the production build
npm run lint     # ESLint
```

---

## Architecture

### State

All state lives in a single `PlannerState` object persisted to `localStorage` under the key `sourceone-booth-utility-planner`.

```ts
type PlannerState = {
  booth: BoothDetails
  markers: UtilityMarker[]
  lines: UtilityLine[]
  selectedTool: MarkerType
  renderImage?: { dataUrl: string; fileName: string; opacity: number }
  hasCompletedSetup: boolean
}
```

### Data models

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
  width: number        // feet
  depth: number        // feet
  boothType: 'Inline' | 'Corner' | 'Peninsula' | 'End Cap' | 'Island'
  sideLabels: { front: string; back: string; left: string; right: string }
}

type UtilityMarker = {
  id: string
  label: string        // auto-generated, kept for internal references
  type: '120v' | '208v_single_phase' | '208v_three_phase' | '480v_three_phase' | 'wifi'
  x: number            // feet from left edge
  y: number            // feet from front edge
  amps?: '5A' | '10A' | '20A' | ''
  speed?: string       // WiFi only
  is24Hour?: boolean   // electrical only
  notes?: string
}

type UtilityLine = {
  id: string
  fromMarkerId: string  // must reference an existing marker
  toX: number           // feet from left edge
  toY: number           // feet from front edge
  label?: string
  notes?: string
}
```

### Components

| Component | Role |
|---|---|
| `App` | Root: state, grid interaction, pan/zoom, marker/line placement |
| `SetupModal` | Welcome modal with booth and contact form |
| `BottomToolbar` | Tool selection and zoom controls |
| `RightPanel` | Accordion panel: all editing sections |
| `PanelSection` | Single-open accordion wrapper |
| `MeasurementGuides` | Dotted distance guide lines per selected marker |
| `UtilityLineLayer` | SVG overlay for drawing utility lines |
| `AmpPrompt` | On-grid popup for selecting amps after placing an electrical drop |
| `NumberedShapeIcon` | SVG geometric shape icons (with optional instance number) |
| `MarkerTypeIcon` | Routes marker type → icon component |

---

## Features

### Setup

On first open the user fills a welcome modal with:
- Name, Company, Email, Phone
- Booth Number, Show Name, Show Date, Show Location
- Booth Width and Depth (10–100 ft; preset or custom)
- Booth Type (Inline, Corner, Peninsula, End Cap, Island)

### Grid

- Rectangular 1-foot grid based on booth dimensions
- Placement snaps to 0.5 ft increments
- Coordinates stored and displayed in feet (x from left, y from front)
- Zoom in/out, pan, fit-to-view
- Side labels on all four sides (front, back, left, right)
- Optional low-opacity booth reference image (PNG/JPG, max 5 MB) under the grid

### Toolbar tools

| Tool | Description |
|---|---|
| Pointer | Select and drag markers |
| Pan | Pan the canvas |
| 120 V | Place a 120 V electrical drop |
| 208 V Single Phase | Place a 208 V single-phase drop |
| 208 V Three Phase | Place a 208 V three-phase drop |
| 480 V Three Phase | Place a 480 V three-phase drop |
| WiFi | Place a WiFi drop |
| Line | Draw an extension cord / utility run from an existing drop |
| Zoom out / Zoom in | Step zoom |
| Zoom % display | Current zoom level |
| Fit | Reset zoom to 1× and pan to origin |

### Drop icons

Electrical drops use geometric shape icons. The toolbar shows the shape alone. Grid markers show the shape with the marker's **instance number** within its own drop type (first 120 V = 1, second 120 V = 2, first 208 SP = 1, etc.).

| Drop type | Shape |
|---|---|
| 120 V | Triangle |
| 208 V Single Phase | Circle |
| 208 V Three Phase | Square |
| 480 V Three Phase | Diamond |
| WiFi | WiFi wave icon |

Grid markers display the drop type name (`120 V`, `208 1P`, etc.) and amps below it for electrical drops.

### Amp selection

After placing an electrical drop a small popup appears on the grid to choose amps (5A, 10A, 20A). Amps can also be changed later in the Selected Item panel.

### Line tool

1. Select the Line tool.
2. Click an existing drop to anchor the start.
3. Click a grid point to set the endpoint (snaps to 0.5 ft).
4. Line is created and the tool returns to Pointer mode.
5. Select a line to view/edit its label and notes, or delete it.
6. Deleting a drop also deletes any lines attached to it.
7. Moving a drop updates its connected line's start point automatically.

### Right panel

Single-open accordion with six sections:

| Section | Contents |
|---|---|
| Booth Details | Contact, show, booth dimensions, booth type |
| Booth Position | Side labels for front, back, left, right |
| Selected Item | Edit or delete the selected drop or line |
| Booth Render Upload | Upload/remove a reference image; adjust opacity |
| Export | Export PDF button |
| Help | SourceOne contact info |

The **Reset planner** button is at the bottom of the panel, below all accordion sections.

### PDF export

Generates a letter-size PDF containing:
- SourceOne logo
- Title: Booth Utility Planner
- Show: name, location, date on one line
- Booth: number, size (ft × ft), booth type on one line
- Full booth grid (not cropped to current zoom/pan) with markers, distance guide lines, side labels
- Legend
- Drop Details table (Type, Location, Amps/Speed, 24 Hour, Notes)
- Line Details table (ID, Connected Drop, End Location, Notes) — if lines exist
- Footer on every page: email, phone, fax

### Browser persistence

Progress is saved automatically to `localStorage` on every state change. Refreshing the page restores the full layout including markers, lines, booth details, and the reference image.

Old sessions that contained a `main_drop` marker type are automatically migrated to `120v` on load.

---

## SourceOne contact information

| | |
|---|---|
| Email | exhibitorservices@sourceoneevents.com |
| Phone | 708.344.3050 |
| Fax | 708.344.4111 |

---

## Known issues / minor items

- The Export PDF button label in the UI reads "Export PDF placeholder" — the word "placeholder" should be removed before shipping.
- `marker.label` (e.g. `E1`, `W1`) is still stored in state and referenced in the Line Details table ("Connected Drop" column). It is not shown in the UI as an editable field for drops.
