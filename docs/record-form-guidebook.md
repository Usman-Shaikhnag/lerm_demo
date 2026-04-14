# Record Form Component Guidebook

This guidebook provides a detailed explanation of how the `record-form.tsx` component works, its architecture, and what each part of the code does. This component acts as the primary dynamic form renderer that mimics Odoo's frontend form views natively in React Native.

## Overview

The `RecordForm` component is designed to dynamically render ANY Odoo model's form view based on structural data provided by a custom backend API. Instead of hardcoding fields for every single module (like Sales, ELN, Contacts, etc.), the React Native app asks the backend: *"How should this form look, and what fields does it have?"* 

The component handles:
1. **Fetching the structure (Schema & Layout)**: Knowing what fields to plot and where to put them (tabs, groups, status bar).
2. **Fetching Data**: If editing an existing record, pre-filling it.
3. **Responsive UI**: Adjusting UI conditionally (e.g., hiding a field if another field changes) using dynamic domain evaluation.
4. **Interactivity**: Giving life to Many2one search fields, checkboxes, image uploads, and embedded lists.
5. **Actions & Buttons**: Connecting Odoo button clicks to backend Python functions and handling subsequent actions (like opening wizards, navigating, or downloading PDF reports).

---

## 1. Core Interfaces

```typescript
interface FieldSchema { ... }
interface LayoutNode { ... }
```
These interfaces map to the data structure that the backend Python server sends over.
*   **FieldSchema**: Describes a field's metadata (is it required? readonly? what are the selection options? is it a relation to another model?).
*   **LayoutNode**: Defines the UI tree. A node can be a `group`, `notebook` (tabs), `page` (individual tab), `field`, or `button`. It can also have nested `children`.

---

## 2. Dynamic Domain Evaluation (`evaluateInvisible`)

Odoo dynamically hides elements on the form based on other values (e.g., "Hide X if Y is true"). Odoo uses Python-like string expressions such as `state != 'draft'` or `["state", "=", "draft"]`.

The `evaluateInvisible(expr, values)` function acts as a mini-parser in JavaScript:
*   It takes the `invisible` expression from the `LayoutNode` and the current form `values`.
*   It supports array-based domains (`[["field", "=", "value"]]`).
*   It supports string-based domains (`field_name in ('a', 'b')` or `not field_name`).
*   **Result**: If it returns `true`, the `renderNode` function skips drawing that UI element, effectively hiding it in real-time as the user types or toggles switches.

---

## 3. Initialization & Data Fetching (`useEffect`)

When `RecordForm` loads, it triggers a `useEffect` to gather data.
1.  **Authentication details** (`session_id` and `server_url`) are pulled from Expo's `SecureStore`.
2.  **Schema Fetch (`/mobile/model_fields`)**: It sends the model name to the backend. The backend parses the XML form view of that model and provides `schema` and `layout` trees.
3.  **Data Fetch (`/mobile/record_read`)**: If a `record_id` is passed as a URL parameter (meaning we're editing an existing record), it makes a second call to fetch the actual database values and populates the `values` state.

---

## 4. Saving Data (`handleSave`)

When the user clicks "Save" in the top header:
1.  It checks if `record_id` exists.
2.  If yes, it triggers an Update (`/mobile/record_update`).
3.  If no, it triggers a Create (`/mobile/record_create`).
4.  If the form was opened as a modal/wizard, it also parses and passes the `wizard_context` so the backend knows where this wizard was called from.

---

## 5. Action Handlers (`handleButtonAction`)

This is one of the most critical parts of the component. When you click a native Odoo button (e.g., "Confirm", "Cancel", "Print PDF"), `handleButtonAction` kicks in:

1.  **Execute the Method**: Sends a JSON-RPC request to `/web/dataset/call_button` telling Odoo to run the button's Python logic for that specific record ID.
2.  **Evaluate Odoo's Response**:
    *   **`ir.actions.act_window` (Navigation)**: If the backend says "Open a wizard!" or "Open a list of matching records!", the app uses `expo-router` to push a new `<RecordForm>` or `<RecordList>` screen onto the stack with the respective context.
    *   **`ir.actions.report` (Downloading a File)**: If the button generates a PDF.
        *   It hits the custom endpoint `/mobile/render_pdf` to bypass standard browser download quirks.
        *   The backend returns the PDF in a base64 encoded string.
        *   `FileSystem.writeAsStringAsync` saves the PDF locally inside the app's document directory.
        *   Depending on the OS (`Platform.OS`), it uses `IntentLauncher` (Android) or `Sharing` (iOS/Android fallback) so the user can open, view, or share the generated PDF natively.
    *   **No specific action**: If it just transitions a state silently, the app just reloads or goes back.

---

## 6. Many2one Field Handling

Odoo forms rely heavily on relationships (e.g., picking a Customer for a Sale).
*   **State Setup**: Contains `m2oModalVisible`, `m2oSearchQuery`, `m2oResults`.
*   **The Flow**: When a user clicks a `Many2one` field on the form, `openM2oSearch` triggers a full-screen Modal.
*   **Searching (`doM2oSearch`)**: Characters typed in the modal trigger the custom `/mobile/name_search` API. This mimics Odoo's autocomplete dropdown.
*   **Selecting (`selectM2oRecord`)**: Clicking a result closes the modal and saves the tuple `[ID, Name]` into the form's `values` dictionary.

---

## 7. Rendering Fields (`renderField`)

This function transforms a specific data type into a React Native UI component:
*   **`binary`**: Expects base64 data. If present, it draws a `<Image>` component.
*   **`boolean`**: Renders a React Native `<Switch>`.
*   **`selection`**: Renders a dropdown list using `@react-native-picker/picker`.
*   **`char` / `integer` / `float` / `text`**: Renders a generic `<TextInput>`. It switches the keyboard to a number pad automatically if the field is numeric.
*   **`one2many` / `many2many`**: Renders a sub-list (embedded tree). 
    *   Displays a capped list (up to 20) with chevron navigation symbols.
    *   Clicking a row pushes a new form screen for that specific related record.
    *   Calculates and injects the parent's default ID contexts when clicking "+ Add".
    *   Looks for inline action buttons defined in the XML tree layout (like "Duplicate" or "Delete" row) and renders them beside the list items.

---

## 8. Recursive Layout Rendering (`renderNode`)

This function recursively iterates over the nested `LayoutNode` JSON array.
*   **Skip Evaluation**: Immediately checks `evaluateInvisible`. If invisible is true, it exits and doesn't paint the UI node.
*   **`header`**: Identifies the status bar container. Iterates its children to paint Action Buttons (left side usually) and the Status Pipeline / Badges (`status_field`). It includes complex logic to show the "chevrons" pipeline sequence of steps.
*   **`group`**: Renders a block section grouping fields together.
*   **`notebook` and `page`**: Renders a scrollable `<TabBar>` at the top. Selecting a tab changes `activeTab` state, causing the component below it to render the nested `children` belonging to that `page`.
*   **`button`**: Handles normal action buttons and "Stat Buttons" (the boxy buttons on the upper right in Odoo that show counts, like "5 Tasks").
*   **`field`**: Defers rendering to the `renderField` function mentioned in section 7.
*   **Containers**: For structural nesting (`container`, `page`), it recursively calls itself `renderNode(child)` to go continuously deeper.

---

## 9. Final UI Assembly

At the very bottom, inside the `return()`, everything is stitched together.
*   **Security wrap**: Enclosed in a `<KeyboardAvoidingView>` so elements don't get covered when user types on mobile.
*   **Custom Application Header**: The top title bar containing the Back button, the Title, and the explicit "Save" action wrapper. (It shows saving spinners during network requests).
*   **Split Rendering**: 
    ```javascript
    const headerNodes = layout.filter(n => n.type === 'header');
    const bodyNodes = layout.filter(n => n.type !== 'header');
    ```
    This ensures that Odoo's status bar / action buttons rest nicely anchored at the top below the navbar, while the standard form body (fields and tabs) can scroll inside the `<ScrollView>` below it.
*   **Modals**: The Many2one search overlay lives outside the scroll flow so it can overlap the whole screen when triggered.

## Summary 

The `record-form.tsx` is an engine. It takes an instruction set (Schema + View Architecture) generated live from an Odoo database, mixes it with live data, and uses recursive generation techniques to paint a fully interactive, rules-abiding, mobile application form capable of navigating relationships, executing remote Python methods, and downloading files.
