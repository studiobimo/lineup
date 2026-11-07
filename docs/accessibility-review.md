# Accessibility review: WCAG 2.2 AA

The review for SHL-8 and issue 44, against every Level A and AA criterion of WCAG 2.2. It was made
on 2026-11-02, on the planner as it stood with the fixes listed here.

**Result:** no criterion is known to fail. Each one either passes, does not apply, or was fixed in
the same stack of pull requests. That rests on the limits below, the largest being that no screen
reader was used.

## How it was checked

- **axe**, on the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` rules, in light and
  dark: the board, every tab of Help and Settings, the cell and sort menus, the selection bar, the
  lightbox, the phone preview, an album, the schedule form and its errors, a refused key, a
  connected key, the confirmation before clearing, the page shown when another tab has the board,
  the legal pages and a missing page. It also ran on the board and tray drawer at 360 × 740 with
  touch. `apps/web/e2e/accessibility.spec.ts` keeps the ones that matter most.
- **Scripted checks** for what axe cannot judge: the Tab order, where focus goes when a dialog
  closes or a cell leaves, whether a focused element is hidden, reflow at 320 × 256, 200% zoom as
  640 × 360, the text-spacing overrides of 1.4.12, and tooltips.
- **Contrast**, measured from the design tokens in both themes, since axe does not check
  non-text contrast and cannot read text over an image.
- **Reading the code**, for keyboard paths, shortcuts, errors and status messages.

## What was not checked

These are the limits of this review. A pass below means none of the above found a failure.

- **No screen reader was used.** Names, roles, states and live regions were read from the
  accessibility tree and the code. Nobody has heard a keyboard drag read aloud, which ARR-6 needs.
- **Chromium only.** Safari and Firefox were not tried, and no real phone. Phones are issue 21.
- **Colour was measured on the design tokens and a few surfaces.** A user's photos can be any
  colour, so a control over a photo keeps its own opaque fill or a second outline.

## Worth improving

These fail nothing:

- When the last cell in a container goes, or a focused button becomes disabled (Undo with nothing
  left to undo, "Move all"), focus falls to the page. Browsers carry on tabbing from the same place,
  so nothing is lost, but the place is not announced. This belongs with issue 61.
- A cell's selected state is on its Select button and not on the cell, so moving between cells does
  not say which are selected. The selection bar does announce the count.
- Undo and redo change the board without saying what changed.
- There is no skip link. Landmarks and headings meet 2.4.1, but a keyboard user tabs through the
  header on every load.

## Fixed in this review

| Criterion                  | What was wrong                                                                         | Now                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.4.3 Contrast             | White on a destructive button was 3.8:1, and 3.5:1 in dark                             | `--destructive` is red-600, 4.8:1                                                                                                                       |
| 1.4.11 Non-text Contrast   | The focus ring was 2.6:1 on a light page                                               | `--ring` is 7.8:1 in light and 11.6:1 in dark                                                                                                           |
| 1.4.11 Non-text Contrast   | A field's border and a switch's track were 1.3:1                                       | `--field-border`, at least 3.2:1 in both themes                                                                                                         |
| 2.1.1 Keyboard             | The phone preview's feed could not be scrolled                                         | It takes focus when the preview opens                                                                                                                   |
| 2.1.1 Keyboard             | A zoomed picture could not be panned                                                   | The arrow keys pan it, and step through pictures when not zoomed                                                                                        |
| 2.2.1 Timing Adjustable    | An error toast went after five seconds, and had no close button                        | Errors and warnings stay until dismissed                                                                                                                |
| 2.4.2 Page Titled          | A missing page had the site's title, and no heading                                    | Its own title, a heading and a way back, in both languages                                                                                              |
| 2.4.7 Focus Visible        | A cell's outline vanished on a photo of its own tone                                   | A second outline runs inside it, in the page's colour                                                                                                   |
| 2.4.7 Focus Visible        | Tab panels took focus and showed nothing                                               | They show the ring                                                                                                                                      |
| 2.4.7 Focus Visible        | Plain links had the browser's 1px outline at half strength                             | A 2px outline in `--ring`                                                                                                                               |
| 2.4.11 Focus Not Obscured  | What took focus could sit entirely under the sticky header                             | The page leaves room for the header and the bottom bar                                                                                                  |
| 2.5.7 Dragging Movements   | Reordering the grid, the tray or an album, and panning a zoomed picture, needed a drag | Move earlier and Move later, in the cell's menu and on an album's images, and pan buttons on a zoomed picture. The menu opens from a button on the cell |
| 3.3.1 Error Identification | A caption over the limit showed only as a red count                                    | It says how far over                                                                                                                                    |
| 4.1.3 Status Messages      | A bad key and a bad time were shown but not announced or tied to the field             | Announced, and the field's description                                                                                                                  |

The lightbox and the phone preview also opened on a button, whose tooltip took the first Escape.
That fails nothing, but it read as Escape not working, so they now open without one.

## Every criterion

### 1 Perceivable

| Criterion                        | Result         | Notes                                                                        |
| -------------------------------- | -------------- | ---------------------------------------------------------------------------- |
| 1.1.1 Non-text Content           | Pass           | Cells are named by position, icons by their button, the rest hidden          |
| 1.2.1 to 1.2.5 Time-based Media  | Does not apply | There is no audio or video                                                   |
| 1.3.1 Info and Relationships     | Pass           | Landmarks, headings, labelled groups and toolbars                            |
| 1.3.2 Meaningful Sequence        | Pass           | The DOM reads tray, then grid                                                |
| 1.3.3 Sensory Characteristics    | Pass           | Instructions name controls, not shapes or positions alone                    |
| 1.3.4 Orientation                | Pass           | Nothing locks it, in the app or its manifest                                 |
| 1.3.5 Identify Input Purpose     | Does not apply | The preview's name and handle are what to show, not the user's details       |
| 1.4.1 Use of Colour              | Pass           | Links are underlined; a selected cell has a check; errors are in words       |
| 1.4.2 Audio Control              | Does not apply | There is no audio                                                            |
| 1.4.3 Contrast (Minimum)         | Fixed          | See above                                                                    |
| 1.4.4 Resize Text                | Pass           | Checked at 200%                                                              |
| 1.4.5 Images of Text             | Pass           | The display type is a web font                                               |
| 1.4.10 Reflow                    | Pass           | No sideways scroll at 320 px; dialogs scroll inside                          |
| 1.4.11 Non-text Contrast         | Fixed          | See above. A select keeps its light border: its text and chevron identify it |
| 1.4.12 Text Spacing              | Pass           | The overrides clip no text                                                   |
| 1.4.13 Content on Hover or Focus | Pass           | A tooltip stays while hovered, and Escape dismisses it                       |

### 2 Operable

| Criterion                     | Result         | Notes                                                                                                      |
| ----------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------- |
| 2.1.1 Keyboard                | Fixed          | See above. Each cell's actions are also in its menu                                                        |
| 2.1.2 No Keyboard Trap        | Pass           | Dialogs hold focus by design, and Escape leaves them                                                       |
| 2.1.4 Character Key Shortcuts | Pass           | There are no single-character shortcuts                                                                    |
| 2.2.1 Timing Adjustable       | Fixed          | See above. Only a success goes by itself, and the sort's offer to undo, which repeats a button on the page |
| 2.2.2 Pause, Stop, Hide       | Pass           | Nothing moves by itself for more than five seconds                                                         |
| 2.3.1 Three Flashes           | Pass           | Nothing flashes                                                                                            |
| 2.4.1 Bypass Blocks           | Pass           | Landmarks and headings                                                                                     |
| 2.4.2 Page Titled             | Fixed          | See above                                                                                                  |
| 2.4.3 Focus Order             | Pass           | Focus returns to what opened a dialog or menu                                                              |
| 2.4.4 Link Purpose            | Pass           | Links say where they go                                                                                    |
| 2.4.5 Multiple Ways           | Pass           | A legal page is reached from Help on any page, and from the other one                                      |
| 2.4.6 Headings and Labels     | Pass           |                                                                                                            |
| 2.4.7 Focus Visible           | Fixed          | See above                                                                                                  |
| 2.4.11 Focus Not Obscured     | Fixed          | See above                                                                                                  |
| 2.5.1 Pointer Gestures        | Pass           | Pinch and swipe have buttons                                                                               |
| 2.5.2 Pointer Cancellation    | Pass           | Actions run on release, and Escape cancels a drag                                                          |
| 2.5.3 Label in Name           | Pass           |                                                                                                            |
| 2.5.4 Motion Actuation        | Does not apply | Nothing responds to motion                                                                                 |
| 2.5.7 Dragging Movements      | Fixed          | See above. A drag on the board has its match in the cell's menu                                            |
| 2.5.8 Target Size (Minimum)   | Pass           | Nothing is under 24 px, on a desktop or at 360 px with touch                                               |

### 3 Understandable

| Criterion                       | Result | Notes                                                         |
| ------------------------------- | ------ | ------------------------------------------------------------- |
| 3.1.1 Language of Page          | Pass   | `lang` follows the chosen language                            |
| 3.1.2 Language of Parts         | Pass   | Each language in the picker is marked with its own            |
| 3.2.1 On Focus                  | Pass   |                                                               |
| 3.2.2 On Input                  | Pass   | The language and theme change the page, as they say they will |
| 3.2.3 Consistent Navigation     | Pass   | The header is the same on every page                          |
| 3.2.4 Consistent Identification | Pass   |                                                               |
| 3.2.6 Consistent Help           | Pass   | Help is in the header on every page                           |
| 3.3.1 Error Identification      | Fixed  | See above                                                     |
| 3.3.2 Labels or Instructions    | Pass   |                                                               |
| 3.3.3 Error Suggestion          | Pass   | Errors say what to do                                         |
| 3.3.4 Error Prevention          | Pass   | Board changes undo; what cannot asks first                    |
| 3.3.7 Redundant Entry           | Pass   | Nothing is asked for twice                                    |
| 3.3.8 Accessible Authentication | Pass   | There are no accounts; a key can be pasted                    |

### 4 Robust

| Criterion               | Result | Notes                                                     |
| ----------------------- | ------ | --------------------------------------------------------- |
| 4.1.2 Name, Role, Value | Pass   | Not heard on a screen reader, as above                    |
| 4.1.3 Status Messages   | Fixed  | See above. Toasts, the selection count and drags are live |
