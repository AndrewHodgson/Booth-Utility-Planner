# Booth Utility Planner — Project Notes

## Project Name

Booth Utility Planner

## Purpose

Build a lightweight web app for SourceOne Events that lets exhibitors and internal project managers create a clear booth utility layout plan. The primary use case is showing where electrical and WiFi drops should be placed inside an exhibit booth.

This is currently a layout generator, not a full ordering/payment system. The layout may support an electrical or WiFi order request, but it should not replace show-specific electrical order forms because SourceOne Events does not always provide electrical directly.

The final output should be a clean SourceOne-branded PDF that users can download and email.

## Primary Users

1. Exhibitors filling out their booth utility layout
2. SourceOne Events project managers using it onsite or during planning

The app should be simple enough for exhibitors but structured enough to create a usable layout for SourceOne staff.

## Design Direction

The UI should visually relate to the existing SourceOne “Build a Booth” and “Build an Exhibit” web apps.

Important design notes:

* Use a clean canvas workspace.
* Use a floating right-side panel similar to the existing apps.
* Use a bottom toolbar for selecting placement tools.
* Do not use the 3D canvas background gradient.
* Do not use decorative 3D grid styling.
* This should feel more like a technical layout editor than a 3D configurator.
* Keep the interface lightweight, clean, and SourceOne-branded.

## Core Workflow

1. User opens the app.
2. Welcome/setup screen asks for booth and contact details.
3. User selects booth width and booth depth.
4. App creates a rectangular 1-foot grid canvas.
5. User labels all four sides of the booth with adjacent booth numbers or aisle names.
6. Main Drop tool is selected first by default.
7. User places the Main Drop on the grid.
8. User places electrical and/or WiFi drops using the bottom toolbar.
9. User selects placed drops to edit details in the right-side panel.
10. User optionally uploads a top-down booth rendering/reference image.
11. User exports a SourceOne-branded letter-size PDF.

## Welcome / Setup Screen Fields

The opening screen should collect:

* Name
* Company Name
* Email
* Phone Number
* Booth Number
* Show Name
* Show Date
* Show Location
* Booth Width
* Booth Depth

Booth width means left-to-right across the front of the booth.

Booth depth means front-to-back.

Width and depth should each have dropdowns from 10 feet to 100 feet, plus a Custom option. Custom should allow dimensions like 25 x 35.

## Booth Size / Grid Rules

* Grid should support square or rectangular booths.
* Maximum booth size: 100 ft x 100 ft.
* Minimum likely booth size: 10 ft x 10 ft.
* Grid unit: 1 ft squares.
* Placement snapping should support 0.5 ft increments.
* Marker coordinates should be stored in feet, not pixels.
* A marker at x=5, y=3 means 5 ft from the left edge and 3 ft from the front edge.
* The app should display marker location while dragging or selecting a marker.
* For readability, large booths should support zoom and pan.
* The grid should have measurement labels so users can understand position on large layouts.

## Orientation

The user must label all four sides of the booth:

* Front
* Back
* Left
* Right

Each side should allow the user to enter an adjacent booth number or aisle name.

The top of the screen can be marked as North with a simple compass indicator.

The app should make orientation clear, but it does not need to force true geographic north. The key need is helping the user and SourceOne understand which side is which.

## Canvas Requirements

The main workspace is a 2D canvas/grid.

The canvas should include:

* Rectangular booth footprint based on width/depth
* 1-foot grid
* 0.5-foot snap placement
* Side labels on all four sides
* Optional low-opacity booth reference image under the grid
* Utility markers placed above the grid
* Marker labels/text
* Zoom controls
* Pan tool or pan behavior
* Selected marker state
* Drag-to-move markers

The booth outline should be automatically rendered based on the booth dimensions. Users do not need to draw the booth outline manually.

## Booth Reference Image Upload

Users should be able to upload a top-down booth image as a reference layer.

Requirements:

* Supported formats: PNG and JPG
* Maximum file size: 5MB
* Image is stretched to fit the booth footprint
* Image appears under the grid
* Image should be low opacity by default
* Right panel should allow upload, remove, and opacity adjustment
* Uploaded image should appear in the exported PDF if present

This is only a visual reference. No image calibration is needed for MVP.

## Bottom Toolbar Tools

Initial toolbar tools:

* Main Drop
* 120 V
* 208 V Single Phase
* 208 V Three Phase
* 480 V Three Phase
* WiFi

Main Drop should be selected first by default. A bold note should tell users they must place the Main Drop first.

Only one Main Drop is allowed for now.

## Utility Marker Behavior

When a user selects a tool and clicks the grid:

1. Marker is placed at the nearest valid snap point.
2. Marker receives an auto-generated label.
3. Marker becomes selected.
4. Right panel opens the Selected Drop editing section.
5. Required details are highlighted until completed.

Avoid relying only on popup editing. The right-side panel should be the primary editing location.

## Marker Labels

Markers should show both an icon and a short label.

Suggested labels:

* MDL-1 for Main Drop
* E1, E2, E3 for electrical drops
* W1, W2, W3 for WiFi drops

If multiple drops of the same type have different settings, the labels help identify which is which in the right panel and PDF export.

## Electrical Drop Fields

For each electrical drop:

* Drop type
* Amps
* 24-hour power toggle
* Notes

Amp options for MVP:

* 5A
* 10A
* 20A

The app can expand later to include 30A, 50A, 100A, custom values, dedicated circuits, quantity, or equipment served.

## Main Drop Fields

For Main Drop:

* Label: MDL-1
* Location coordinates
* Notes

Main Drop does not need amps for MVP unless added later.

## WiFi Drop Fields

For each WiFi drop:

* Type: WiFi
* Speed
* Notes

Speed can be a simple text or dropdown field for MVP. Example values could be:

* Basic
* Standard
* High Speed
* Custom

Exact WiFi packages can be refined later.

## Right Floating Panel

The right panel should match the general style of the existing SourceOne web apps.

Suggested panel sections:

1. Booth Details
2. Grid Layout
3. Selected Drop
4. Booth Render Upload
5. Export

### Booth Details

Display and allow editing of:

* Name
* Company Name
* Email
* Phone Number
* Booth Number
* Show Name
* Show Date
* Show Location
* Booth Width
* Booth Depth

### Grid Layout

Allow editing of:

* Front side label
* Back side label
* Left side label
* Right side label
* Zoom controls
* Snap setting, if needed

Snap can remain fixed to 0.5 ft for MVP.

### Selected Drop

Appears when a marker is selected.

Allow editing of:

* Drop label
* Drop type
* Amps or speed, depending on type
* 24-hour power toggle for electrical
* Notes
* Delete marker

Changing a drop type should update the marker icon and export details.

### Booth Render Upload

Allow:

* Upload PNG/JPG
* Remove uploaded image
* Adjust opacity

### Export

Allow the user to export the PDF.

Optional checklist items can be shown here, but hard validation can remain minimal for MVP.

## Collision / Shared Point Behavior

Multiple utility markers can exist at the same coordinate.

Use case: electrical and WiFi may be needed in the same location.

Rules:

* Allow up to 6 icons on one point.
* Do not stack icons directly on top of each other visually.
* If multiple markers share one point, offset them slightly around the same coordinate.
* All markers must remain individually selectable.
* Do not allow placement outside the booth footprint.

## Validation

For MVP, keep validation helpful but not overly restrictive.

Recommended required items before export:

* Booth size exists
* Contact/show information exists
* All four side labels are filled in
* One Main Drop is placed
* Each electrical drop has an amp value
* Each WiFi drop has a speed value or note

The app should not become frustrating. Use warnings more than hard blocks unless the data is essential.

Suggested bold note near top of app:

“Place the Main Drop Location first, then add electrical and WiFi drops as needed.”

## Browser Save

The app should save progress in the browser so refresh does not erase the layout.

Use localStorage or IndexedDB.

Save:

* Contact/show/booth details
* Booth width/depth
* Side labels
* Placed markers
* Marker details
* Uploaded image data or reference, if practical
* Image opacity
* Current canvas view settings, if useful

No user accounts are needed for MVP.

## Export Requirements

Export should generate a letter-size PDF.

PDF should include:

* SourceOne Events logo at top left
* Title: Booth Utility Layout Plan
* Show details
* Exhibitor/contact details
* Booth number
* Booth dimensions
* Main grid layout with placed markers
* Adjacent booth/aisle labels on all four sides
* Optional uploaded booth reference image under the grid
* Legend
* Drop schedule/table
* SourceOne contact information at bottom left

The export should be clean, readable, and useful when emailed.

## PDF Layout

Suggested letter-size PDF structure:

Top:

* SourceOne Events logo
* “Booth Utility Layout Plan”
* Show Name
* Show Date
* Show Location
* Booth Number
* Booth Dimensions

Main area:

* Booth grid
* Side labels
* Utility markers
* Marker labels
* Optional low-opacity reference image

Below or beside grid:

* Legend
* Drop schedule

Bottom:

* SourceOne Events contact information
* Email
* Phone
* Fax

Contact information is static for MVP.

## Drop Schedule Table

The PDF should include a structured table listing all placed markers.

Suggested columns:

* ID
* Type
* Location
* Amps / Speed
* 24 Hour
* Notes

Example:

| ID    | Type      | Location                        | Amps / Speed | 24 Hour | Notes                 |
| ----- | --------- | ------------------------------- | ------------ | ------- | --------------------- |
| MDL-1 | Main Drop | 5 ft from left, 3 ft from front | —            | —       | Main service location |
| E1    | 120V      | 8 ft from left, 4 ft from front | 10A          | No      | Reception counter     |
| W1    | WiFi      | 8 ft from left, 4 ft from front | Standard     | —       | Lead retrieval        |

Location should be based on grid coordinates in feet.

## Coordinate Display

The app should show marker positions in a human-readable way.

Primary coordinate format:

* X ft from left
* Y ft from front

Optional improved format:

* Show nearest edges for clarity.
* Example: “5 ft from left, 3 ft from front”
* If closer to right/back, optionally show: “4 ft from right, 6 ft from back”

For MVP, use x from left and y from front consistently.

## Mobile / Responsive Behavior

The app should be built desktop-first, with mobile in mind.

Requirements:

* Desktop should be the best experience.
* Tablet should be usable.
* Mobile should not break.
* On small screens, the right panel may collapse into a drawer.
* Bottom toolbar should remain accessible.
* Canvas should support pinch/zoom or simple zoom controls if practical.

Do not over-optimize for mobile during MVP.

## Static SourceOne Contact Info

For MVP, SourceOne contact info is static.

Include in PDF bottom left:

* SourceOne Events
* Email
* Phone
* Fax

Exact email, phone, and fax values can be filled in later.

## Technical Notes

Build as a lightweight web app.

Data model should be clean enough to support future submit/save features even if MVP only exports PDF.

Suggested marker object structure:

```ts
type UtilityMarker = {
  id: string;
  label: string;
  type: 'main_drop' | '120v' | '208v_single_phase' | '208v_three_phase' | '480v_three_phase' | 'wifi';
  x: number; // feet from left edge
  y: number; // feet from front edge
  amps?: '5A' | '10A' | '20A' | string;
  speed?: string;
  is24Hour?: boolean;
  notes?: string;
};
```

Suggested booth details structure:

```ts
type BoothDetails = {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  boothNumber: string;
  showName: string;
  showDate: string;
  showLocation: string;
  width: number;
  depth: number;
  sideLabels: {
    front: string;
    back: string;
    left: string;
    right: string;
  };
};
```

## Out of Scope for MVP

Do not build these yet:

* Payment
* Pricing
* Full order form replacement
* User accounts
* Admin dashboard
* Show-specific templates
* CAD export
* Non-rectangular booth drawing
* Manual image calibration
* Multiple Main Drops
* Complex electrical validation
* Vendor-specific electrical rules
* Direct email submission
* Database storage
* Approval workflow

## Future Enhancements

Possible later features:

* Submit layout directly to SourceOne
* Email confirmation to user and SourceOne
* Save/share layout link
* Admin review dashboard
* Show-specific templates
* Pre-filled SourceOne event data
* CAD/DXF export
* Multiple Main Drops
* More amp options
* Custom electrical symbols
* Hardline internet option
* Static IP option
* Equipment served field
* Approval status
* Revision history
* Internal notes
* Import/export JSON
* Better mobile editing
* Booth furniture/object reference layer

## MVP Definition

The MVP is complete when a user can:

1. Enter contact, show, and booth details.
2. Choose a custom booth size up to 100 ft x 100 ft.
3. See a 1-foot grid.
4. Label all four booth sides.
5. Place one Main Drop.
6. Place electrical and WiFi markers.
7. Snap markers to 0.5-foot increments.
8. Move, select, edit, and delete markers.
9. Upload a PNG/JPG top-view booth image under the grid.
10. Save progress in browser after refresh.
11. Export a clean SourceOne-branded PDF with the grid, markers, side labels, legend, drop schedule, and contact information.
