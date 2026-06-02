# Booth Utility Planner

Booth Utility Planner is a SourceOne Events web app for creating 2D booth utility layout plans. It lets exhibitors and project managers define booth details, place electrical and WiFi drops on a scaled grid, draw utility runs, add a booth background image, and export a SourceOne-branded PDF.

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

## State And Persistence

The planner stores one `PlannerState` object in `localStorage` under:

```txt
sourceone-booth-utility-planner
```

Progress is saved automatically on state changes and restored on refresh.

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

Saved data includes booth details, side labels, markers, lines, selected tool, and the cropped background image. Reset planner clears the planner back to defaults, including the uploaded image.

Legacy saved `main_drop` markers are migrated to `120v`. Saved amp values are validated on load and reset to a valid default if the saved value is no longer valid for the marker type.

## Booth Setup

The setup modal collects:

- Name
- Company name
- Email
- Phone
- Booth number
- Show name
- Show date
- Show location
- Booth width and depth
- Booth type

Width and depth support preset 10 ft increments from 10 ft to 100 ft, plus custom values clamped between 1 ft and 100 ft. The default booth is 20 ft x 20 ft.

Booth types:

- Inline
- Corner
- Peninsula
- End Cap
- Island

## Grid And Side Labels

The main workspace renders a 2D booth footprint:

- 1 ft grid squares
- 0.5 ft snap placement
- Coordinates stored as feet from left and feet from front
- Zoom, pan, and fit controls
- Editable side labels for Front, Back, Left, and Right
- Optional booth image behind the grid at low opacity

Side labels are editable from the Booth Position panel and directly on the grid via double-click. They persist with the booth details and are included in PDF export.

## Utility Drop Types

Supported marker types:

| Drop type | Toolbar label | Grid icon | Color |
|---|---|---|---|
| 120 V | 120 V | Triangle | Blue |
| 208 V Single Phase | 208 V Single Phase | Circle | Purple |
| 208 V Three Phase | 208 V Three Phase | Square | Orange |
| 480 V Three Phase | 480 V Three Phase | Diamond | Red |
| WiFi | WiFi | WiFi icon | Green |

Electrical grid markers show the type and selected amps. WiFi markers show the speed when set. PDF marker circles use simple numeric IDs that match the Drop Details table.

## Amp Options

Amp options are filtered by selected drop type.

| Drop type | Valid amps | Default |
|---|---|---|
| 120 V | 10 AMP, 20 AMP | 10 AMP |
| 208 V Single Phase | 30 AMP, 60 AMP | 30 AMP |
| 208 V Three Phase | 20 AMP, 30 AMP, 60 AMP, 100 AMP, 200 AMP, 400 AMP | 20 AMP |
| 480 V Three Phase | 30 AMP, 60 AMP, 100 AMP, 200 AMP, 400 AMP | 30 AMP |

If a user changes a marker type and the current amp is invalid for the new type, the app resets the amp to the new type's default. Existing saved planner data is sanitized the same way on load.

## WiFi Drops

WiFi drops have:

- Speed: Basic, Standard, High Speed, or Custom
- Notes

WiFi drops do not use amps or 24-hour power.

## Line Creation

The Line tool creates utility runs:

1. Select Line from the bottom toolbar.
2. Click a drop or existing line endpoint to start the line.
3. Click a grid point to place the endpoint.
4. The line is created and the app returns to pointer mode.

Lines snap to 0.5 ft endpoints. They can be selected, relabeled, moved by endpoint, edited with notes, and deleted. Deleting a drop deletes lines that start from that drop, and dependent line branches are also removed.

Line data supports starts from either a marker or another line endpoint:

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

## Booth Image Upload

The Booth Image Upload panel supports a top-down booth plan or render behind the grid.

- Formats: PNG, JPG, JPEG
- Max file size: 5 MB
- Crop aspect ratio follows the current booth width/depth ratio
- Crop modal supports drag, zoom, and 90-degree rotate left/right
- Final cropped image is saved as a data URL in planner state
- Image opacity defaults low and can be adjusted from the right panel
- Remove image clears it from state
- The saved cropped/rotated image persists after refresh

If the uploaded image already matches the booth aspect ratio within tolerance, it is resized and saved directly. Otherwise the crop modal opens.

## Right Panel

The right panel is a single-open accordion.

| Section | Purpose |
|---|---|
| Booth Details | Contact/show fields, booth dimensions, booth type |
| Booth Position | Front, Back, Left, Right side labels |
| Selected Item | Edit selected drop or line |
| Booth Image Upload | Upload, crop, rotate, remove, and set image opacity |
| Export | Download PDF |
| Help | SourceOne contact details |

The Reset planner button is in the panel footer.

## PDF Export

PDF export generates a portrait letter-size SourceOne-branded layout.

Header:

- SourceOne logo, scaled proportionally to preserve aspect ratio
- Title: Booth Utility Planner
- Show name, location, and date
- Booth number, size, and booth type

Grid section:

- Full booth grid, independent of current zoom/pan
- Optional cropped booth image behind the grid
- Neutral black/gray PDF grid lines over the image
- Strong booth border
- Markers with numeric IDs
- Utility lines and line length labels
- Distance guides from markers to nearest booth edges
- Centered, stable side labels around all four grid sides

Below grid:

- Legend for marker types present in the plan
- Drop Details table: `ID | Type | Location | Amps / Speed | 24 Hour | Notes`
- Line Details table: `ID | Connected Drop ID | Connected Drop Type | End Location | Notes`

Line Details does not use internal marker labels like `E1`. Connected drop IDs match the PDF marker IDs and Drop Details table. If a line starts from another line endpoint, the table describes it as a line endpoint.

Footer:

- `Email: exhibitorservices@sourceoneevents.com | Phone: 708.344.3050 | Fax: 708.344.4111`

## SourceOne Contact

| | |
|---|---|
| Email | exhibitorservices@sourceoneevents.com |
| Phone | 708.344.3050 |
| Fax | 708.344.4111 |

## Known Constraints

- Browser-only persistence through localStorage; no accounts or cloud sync.
- Rectangular booth footprints only.
- No pricing, ordering, or payment workflow.
- No CAD/DXF export.
- No direct email submission.
- Large production bundle currently triggers Vite's chunk-size warning.
