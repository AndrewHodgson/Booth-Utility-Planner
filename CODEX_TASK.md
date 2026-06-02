# Codex Task — Booth Utility Planner Initial Build

> Historical note: this file describes the original MVP build request and is no
> longer the current product specification. For current behavior, implementation
> notes, amp options, image upload/crop/rotate behavior, line details, PDF export,
> and persistence, use `README.md` and `Project Notes.md`.

We are building a new React + TypeScript + Vite web app called Booth Utility Planner for SourceOne Events.

Use the existing `build-an-exhibit` project in the VS Code workspace as visual reference only. Do not modify the build-an-exhibit project. This new app should live only inside the `Booth Utility Planner` folder.

Read `PROJECT_NOTES.md` first for the full product direction.

## Goal for this first task

Build the initial working app shell and MVP structure.

Do not build every feature yet. Focus on the layout, data model, basic grid, marker placement, right panel, and bottom toolbar.

## App Requirements for this first pass

Create a clean SourceOne-style interface with:

1. Welcome/setup modal
2. Main 2D grid canvas
3. Floating right-side panel
4. Bottom toolbar
5. Basic marker placement
6. Marker selection/editing
7. Browser localStorage save
8. Placeholder export button

## Welcome/setup modal fields

Collect:

* Name
* Company Name
* Email
* Phone
* Booth Number
* Show Name
* Show Date
* Show Location
* Booth Width
* Booth Depth

Booth width and depth should support dropdown values from 10 to 100 feet, plus a Custom option.

For now, default to 20 ft wide x 20 ft deep.

## Grid Canvas

Create a 2D rectangular booth grid.

Rules:

* 1 square = 1 foot
* Support booth sizes up to 100 ft x 100 ft
* Snap marker placement to 0.5 ft increments
* Store marker coordinates in feet, not pixels
* x = feet from left
* y = feet from front
* Front of booth should visually be the bottom side of the grid
* Show a basic compass indicator that says North at top
* Show side labels around all four sides: Front, Back, Left, Right
* Allow users to enter adjacent booth number or aisle name for all four sides

## Bottom Toolbar

Create tools for:

* Main Drop
* 120 V
* 208 V Single Phase
* 208 V Three Phase
* 480 V Three Phase
* WiFi

Main Drop should be selected by default.

Only one Main Drop is allowed for now.

When the user clicks a tool and then clicks the grid, place a marker at the snapped grid location.

## Marker Behavior

Each marker should have:

* id
* label
* type
* x
* y
* amps
* speed
* is24Hour
* notes

Suggested labels:

* MDL-1 for Main Drop
* E1, E2, E3 for electrical
* W1, W2, W3 for WiFi

Markers should show both an icon and short label on the grid.

Markers should be selectable.

Selected markers should be editable in the right panel.

User should be able to:

* Move marker by dragging
* Delete marker
* Change marker type
* Edit amps/speed
* Edit notes
* Toggle 24-hour power for electrical markers

## Right Floating Panel

Create sections:

1. Booth Details
2. Grid Layout
3. Selected Drop
4. Booth Render Upload
5. Export

The panel should visually resemble the right floating panel style from the existing build-an-exhibit app, but adapted for this 2D utility planner.

### Booth Details

Show and edit:

* Name
* Company Name
* Email
* Phone
* Booth Number
* Show Name
* Show Date
* Show Location
* Width
* Depth

### Grid Layout

Show and edit:

* Front side label
* Back side label
* Left side label
* Right side label

### Selected Drop

If a marker is selected, show editable fields:

* Label
* Type
* Coordinate display
* Amps dropdown for electrical drops: 5A, 10A, 20A
* Speed field/dropdown for WiFi
* 24-hour toggle for electrical drops
* Notes
* Delete button

### Booth Render Upload

For this first pass, create the UI section but upload functionality can be basic or placeholder.

Eventually it should support PNG/JPG under 5MB, stretched under the grid at low opacity.

### Export

For this first pass, create the export section and button.

PDF export can be placeholder initially unless simple to implement.

## Browser Save

Save progress to localStorage.

Save:

* Booth details
* Booth dimensions
* Side labels
* Markers
* Selected tool if useful

Refresh should not wipe the layout.

## Styling

Use clean CSS or Tailwind if already installed.

Visual direction:

* White/light gray workspace
* Floating right panel
* Floating bottom toolbar
* Clean buttons
* SourceOne-style professional event planning tool
* No 3D gradient background
* No decorative 3D grid
* Technical, clean, readable

## Important Constraints

Do not build:

* Payment
* User accounts
* Database
* Email submission
* CAD export
* Admin dashboard
* Complex validation
* Non-rectangular booth drawing
* Multiple Main Drops

## Completion Criteria

This first pass is complete when:

* App runs with `npm run dev`
* User can fill setup modal
* Grid renders based on booth size
* User can place Main Drop, electrical drops, and WiFi drops
* Markers snap to 0.5 ft increments
* User can select/edit/delete markers in the right panel
* Side labels can be edited
* Data persists after refresh
* Interface has right panel and bottom toolbar structure
