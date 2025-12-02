# GEMINI.md

## Project Overview

Aivy Workspace is an AI-powered productivity platform tightly integrated with Google Workspace tools (Docs, Sheets, Slides, Drive, Calendar). Its main goal is to help users generate and improve professional documents quickly and intelligently, without manual writing or formatting of large amounts of text.

The application is structured as a monorepo with two main components:

1.  **`aivy-web`**: A modern frontend application built with Next.js, React, and TypeScript. It provides the user interface for interacting with the AI document generation features and Google Workspace files.
2.  **`google-api-program`**: A Node.js backend server built with Express. This server handles the core business logic, including:
    *   Authenticating users with Google OAuth.
    *   Interacting with Google Workspace APIs (Docs, Sheets, Drive, etc.).
    *   Orchestrating the AI-powered document creation process using the OpenAI API.

**User Workflow for Document Generation:**
Users interact through a guided workflow:
*   Users can create a new document by filling out form fields (Topic, Document Type, Tone, Details level, Language, Number of pages).
*   The application then automatically coordinates AI planning and writing steps.
*   The AI first plans the document's layout and flow (per page), presenting this structure to the user for potential edits.
*   After planning, content is generated page-by-page.
*   Users can refine or regenerate any section later.
*   All AI-generated content is stored in Google Drive under the user’s account, and edits in Aivy Workspace can be synced to the corresponding Google Doc.

**Current State & Recent Updates:**
*   The `aivy-web` frontend now successfully fetches and displays a list of real Google Drive documents from the user's account via the `google-api-program` backend.
*   The Google OAuth authentication flow has been successfully configured, resolving the `redirect_uri_mismatch` error by adding `http://localhost:8080/auth/google/callback` to the Authorized redirect URIs in the Google Cloud Console.
*   The backend (`google-api-program`) has been updated to filter Google Drive files to only include Google Docs (`mimeType='application/vnd.google-apps.document'`) and supports pagination for efficient loading.
*   The frontend (`aivy-web`) has been enhanced to implement infinite scrolling for Google Docs. This includes:
    *   Modifying `DocumentCard.tsx` to accept a `ref` for proper integration with the Intersection Observer.
    *   Updating `DocumentGrid.tsx` to pass the `lastDocumentElementRef` to the last `DocumentCard` to trigger loading of additional documents upon scrolling.
    *   Adjusting `page.tsx` to correctly utilize the `lastDocumentElementRef` with `DocumentGrid`.
    *   Resolving a scrolling issue by removing `overflow-hidden` from the main content container in `layout.tsx`, ensuring the document grid is properly scrollable.
*   **Image Previews and Caching:** Document cards now display image previews of the first page of Google Docs, fetched using the `thumbnailLink` from the Google Drive API. The backend (`google-api-program`) implements a file-based caching mechanism for these thumbnails, using `fileId` and `modifiedTime` for efficient storage and invalidation. This significantly improves loading performance after the initial fetch.
*   **Frontend Design Refinements:** The `DocumentCard.tsx` component has undergone several design updates for a cleaner, more modern look:
    *   Document icons are now smaller and aligned with the title and date.
    *   Card borders and shadows have been refined, with a subtle border replacing the previous shadow.
    *   A thin separator line now divides the document preview from its information section.
    *   The preview image now extends from edge-to-edge within the card, and the text section's vertical padding has been reduced for a more compact layout.

## Recent Progress: AI Plan Generation

Significant progress has been made on the AI document generation feature.

*   **Backend Endpoint for AI Planner:** A new `/api/generate-plan` endpoint was created in the `google-api-program` backend. This endpoint receives form data and utilizes the `aiPlanner.js` module to generate a structured document plan using the OpenAI API.
*   **Dynamic Plan Preview:** The frontend (`aivy-web/app/generate/page.tsx`) has been successfully connected to this new backend endpoint. The static mock data has been replaced with a live `fetch` call. The plan preview on the right side of the page is now dynamically updated with real-time suggestions from the AI as the user fills out the form.
*   **Font Selection Feature:** Based on user feedback, the "Theme" selector in the generation form was replaced with a more functional "Font" selector.
    *   **UI/UX:** Users can now choose between three distinct fonts (Merriweather, Lato, Montserrat), with buttons that provide a visual preview of each font.
    *   **Implementation:** This required updating Tailwind CSS v4's configuration in `globals.css` (`@theme` directive), making the fonts globally available via utility classes (`font-merriweather`, etc.), and applying them in the React components.
    *   **Live Preview:** The chosen font is now applied to the dynamic plan preview, giving the user an immediate sense of the document's final look and feel.
*   **Debugging:**
    *   Resolved a `GaxiosError: invalid_grant` error by instructing the user to re-authenticate with Google via the `/auth/google` endpoint.
    *   Fixed an issue where font styles were not being applied correctly by properly configuring Tailwind's theme and updating the React components to use the correct CSS classes.

## Next Steps

With the AI planning phase now fully functional, the next logical step is to build out the subsequent stages of the document creation workflow:

1.  **User Plan Approval:** Implement a mechanism for the user to approve or edit the AI-generated plan.
2.  **Content Generation:** Create a new backend endpoint and frontend logic to trigger `aiWriter.js` based on the approved plan, generating the full text content for each page.
3.  **Final Document Creation:** Use the Google Docs API to create a new document in the user's Drive, populate it with the AI-generated content, and apply the user's selected font.

### Checkpoint Note

The user will create a copy of the entire `WebGoogle01` folder, including this `GEMINI.md` file, as a checkpoint before proceeding with further development. No further work should be initiated until the user provides explicit instructions.

**Core AI Modules:**

*   **`aiPlanner.js`**:
    *   **Purpose:** Creates a detailed page-by-page plan for the document.
    *   **Process:** When a user submits the input form, the backend calls `generatePlan()` from `aiPlanner.js`. It constructs a structured prompt for the AI model to create a JSON plan describing each page's number, title, summary, and optional elements (list, table, quote, etc.). This module acts as the "brainstorming and structuring engine."

*   **`aiWriter.js`**:
    *   **Purpose:** Generates the actual text content for each page of the document, based on the plan created by `aiPlanner.js`.
    *   **Process:** Once the plan is finalized, the backend loops through each page object and calls `generatePage()` from `aiWriter.js`. It sends parameters like page number, title, summary, elements, tone, and language. It constructs a precise prompt for the AI to write only the content for that specific page, using Markdown formatting. This modular approach ensures focus and consistency, acting as the “execution layer” that transforms the conceptual plan into professional text.

The generated documents are stored in the user's Google Drive and can be edited within the Aivy Workspace application, with changes synced back to Google Docs.

## Building and Running

### `aivy-web` (Frontend)

To run the frontend application in development mode:

```bash
cd aivy-web
npm install
npm run dev
```

The application will be available at `http://localhost:3000`.

Other available scripts:

*   `npm run build`: Builds the application for production.
*   `npm run start`: Starts a production server.
*   `npm run lint`: Lints the codebase.

### `google-api-program` (Backend)

To run the backend server:

```bash
cd google-api-program
npm install
node index.js
```

**Note:** The backend requires API credentials for Google Workspace and OpenAI. These should be stored in a `.env` file in the `google-api-program` directory.
**Authentication:** After starting the backend, navigate to `http://localhost:8080/auth/google` in your browser to authenticate with your Google account. Ensure `http://localhost:8080/auth/google/callback` is added to the "Authorized redirect URIs" in your Google Cloud Console project.

## Development Conventions

*   **Frontend:** The `aivy-web` application is built with TypeScript, and all new code should be written in TypeScript. The project uses ESLint for code linting, and all code should adhere to the rules defined in the ESLint configuration.
*   **Backend:** The `google-api-program` is a CommonJS Node.js application. It follows a modular architecture, with separate modules for interacting with different Google APIs and for the AI planner and writer.
*   **AI Pipeline:** The separation of concerns between the `aiPlanner.js` and `aiWriter.js` modules is a core architectural convention. The planner should only be responsible for creating the document structure, and the writer should only be responsible for generating the content for a single page at a time.

## Frontend Component Structure

The frontend is built using a modular, component-based architecture. All reusable components are located in `aivy-web/app/components/`.

*   **`Sidebar.tsx`**: The main left-hand navigation bar. It is a fixed component that provides global navigation across the application (e.g., Docs, Drive, Settings).
*   **`Header.tsx`**: The top bar within the main content area. It contains the global search input and the user's avatar.
*   **`ActionToolbar.tsx`**: A contextual toolbar that displays actions relevant to the current page. For the "Docs" page, this includes buttons like "Generate new Doc" and "Sort".
*   **`DocumentGrid.tsx`**: A component responsible for arranging and displaying multiple `DocumentCard` components in a responsive grid layout.
*   **`DocumentCard.tsx`**: A single card component used to display an individual document, including its icon and title. It is the basic building block for the `DocumentGrid`.

---

## Full Document Generation and Future Vision

Building on the AI plan generation, the application now supports the full end-to-end creation of a Google Doc.

### Implemented Features:

*   **End-to-End Document Creation:**
    *   A new backend endpoint, `/api/create-google-doc`, was created to orchestrate the final document generation.
    *   This process uses the AI-generated plan to call `aiWriter.js` for each page, generating the complete text content.
    *   A new Google Doc is created in the user's Drive, and the generated content is inserted.
    *   The frontend was updated with a "Generate Document" button, which calls this endpoint and opens the newly created document in a new tab.

*   **Backend Refactoring and Debugging:**
    *   Fixed a bug that caused the server to crash and return HTML instead of JSON on error. This was resolved by refactoring the module exports in `google/docs.js` and `index.js` for better stability.
    *   Resolved a `SyntaxError` caused by a duplicate import of `generatePlan` in `index.js`.
    *   Addressed an `OpenAIError: Missing credentials` crash by implementing a more robust path configuration for `dotenv` in `index.js`, ensuring the `.env` file is always found.

### Future Vision and Agreed-Upon Plan:

The next major goal is to transform the application from a document generator into a full-featured, AI-assisted document editor.

1.  **Rich Document Styling:**
    *   **Problem:** Currently, AI-generated Markdown (e.g., `# Title`) is inserted as plain text into Google Docs, without proper formatting.
    *   **Solution:** A "translator" will be built on the backend to parse the Markdown content and convert it into a series of specific Google Docs API requests (e.g., `updateParagraphStyle` for headings, `createParagraphBullets` for lists). This will result in professionally formatted documents.

2.  **In-App Rich-Text Editor:**
    *   **Vision:** Instead of redirecting users to Google Docs, the generated document will be displayed and editable within the Aivy Workspace application itself. This provides a seamless user experience and a foundation for custom AI editing tools.
    *   **Phased Implementation Plan:**
        *   **Phase 1: Integrate Editor & Display Document:** A modern rich-text editor library (e.g., **TipTap**) will be integrated into the frontend. A data transformer will be built to convert the fetched Google Doc content (from Google's JSON format) into a format the editor can display.
        *   **Phase 2: In-Editor AI Features:** With the document content now "live" in our editor, we will add custom UI (e.g., buttons) to perform AI actions like "Improve this paragraph" or "Change tone" on selected text.
        *   **Phase 3: Saving Changes:** Implement a save mechanism. The initial version will be a "full overwrite" where the content from the in-app editor is used to replace the entire content of the corresponding Google Doc. This is simpler than a true two-way sync and provides the core "save" functionality.

---

## Editor Integration Progress

Building on the future vision, significant progress has been made on transforming the application into a document editor. The work was completed in two main phases during this session.

### Phase 1: Rich Document Styling

The first goal was to solve the problem of AI-generated Markdown appearing as plain text in Google Docs.

*   **Backend Markdown-to-Docs Translator:**
    *   The `google-api-program` was enhanced with a translation layer.
    *   The `marked` library was added to parse Markdown content.
    *   A new `markdownTranslator.js` module was created. Its `markdownToGoogleDocsRequests` function converts Markdown tokens (headings, paragraphs, lists) into specific Google Docs API requests.
    *   The `createGoogleDocFromPlan` function in `docs.js` was refactored to use this translator, sending a batch of formatting requests to the Google Docs API instead of a single plain text block.
*   **Outcome:** Newly generated documents are now properly formatted in Google Docs, with correct headings and bullet points.

### Phase 2: In-App Editor (Display Only)

The second goal was to create the foundation for the in-app editor by displaying Google Doc content within Aivy Workspace.

*   **Frontend Editor Setup (`aivy-web`):**
    *   The **TipTap** rich-text editor library (`@tiptap/react`, `@tiptap/starter-kit`) was installed.
    *   A new dynamic page was created at `app/doc/[id]/page.tsx` to host the editor.
    *   A reusable `RichTextEditor.tsx` component was created to encapsulate the TipTap editor instance.
*   **Backend Content Conversion (`google-api-program`):**
    *   A new `formatConverter.js` module was created with a `googleDocsToHtml` function. This function translates the JSON structure of a Google Doc's content into HTML.
    *   A new API endpoint, `GET /docs/doc/:id`, was added. This endpoint fetches a Google Doc by its ID, converts its content to HTML using the new converter, and returns it to the client.
*   **Full-Stack Integration:**
    *   The frontend editor page (`DocEditorPage`) was connected to the new `/docs/doc/:id` backend endpoint. It now fetches the document's HTML content and renders it within the TipTap editor.
*   **Debugging:**
    *   A 404 error on the new endpoint was resolved by instructing the user to restart the backend Node.js server, which was necessary to load the newly created API route.

### Next Steps: Making the Editor Functional

The editor currently provides a "read-only" view. The following plan was agreed upon to make it fully functional:

1.  **Implement Editor Toolbar (Priority #1):**
    *   Create a new `EditorToolbar.tsx` component.
    *   Add controls for basic formatting (e.g., Bold, Italic, Headings, Lists) that interact with the TipTap editor instance.
    *   This is the most critical next step to make the editor usable.
2.  **Implement Font Persistence and Application:**
    *   **Backend:** The document creation process will be updated to save the user's chosen font as a custom property on the Google Drive file.
    *   **Backend:** The `/docs/doc/:id` endpoint will be updated to fetch this font property.
    *   **Frontend:** The editor page will use the fetched font information to apply the correct styles to the document content.
3.  **Investigate Pagination (Future Goal):**
    *   Simulating pages like in Google Docs or Word is technically complex in a web editor. This will be investigated as an advanced feature after the core editor functionality is complete.
---

## Editor Styling and Build Debugging

Following the plan to make the editor functional, work began on implementing the `EditorToolbar`. However, this led to a complex debugging session to resolve build errors and styling issues.

*   **Initial Problem:** After adding toolbar controls for headings and lists, a build error `Can't resolve '@tailwindcss/typography'` began crashing the `aivy-web` application. Additionally, even when the build was temporarily fixed, the editor's formatting buttons (e.g., H1, H2) did not produce any visual changes in the text.

*   **Build Error Resolution:** The build error was traced to a misconfiguration of the Tailwind CSS environment. The resolution involved several steps:
    1.  An incorrect `@import` statement for `@tailwindcss/typography` was removed from `globals.css`.
    2.  It was discovered that the `tailwind.config.mjs` file was missing entirely.
    3.  A new `tailwind.config.mjs` file was created with the correct `content` paths and, crucially, the `require('@tailwindcss/typography')` plugin was added.
    4.  The `@tailwindcss/typography` npm package was explicitly installed to ensure it was present in `node_modules`.

*   **Styling Issue Debugging:** With the build error resolved, the original problem of missing visual styles for headings and lists remained. The investigation included:
    1.  Verifying that the TipTap editor component (`RichTextEditor.tsx`) was applying the necessary `.prose` class to enable the typography styles. It was, but the styles were still not appearing.
    2.  Clearing the Next.js cache by deleting the `.next` directory to rule out stale build artifacts.
    3.  Refactoring `RichTextEditor.tsx` to apply the `.prose` classes to a wrapper `div` around the editor content, and adding the important `max-w-none` class to ensure styles could span the full width of the container.
    4.  Performing a final sanity check of `layout.tsx` to confirm the global stylesheet was being imported.

*   **Outcome and Next Steps:** After exhausting all code and configuration-based solutions, the application's code is now in a correct and robust state. However, the styling issue persisted, leading to the conclusion that the problem lies within the local development environment (e.g., a deeply cached file or a faulty file-watcher process).

The immediate next step is for the user to **restart their computer** to completely reset the development environment. After the restart, the editor's styling functionality should be re-verified.
---

## Full-Stack Debugging and Final Fixes

Even after a system restart, the application remained non-functional, triggering an extensive end-to-end debugging session that uncovered and resolved multiple, cascading issues across the stack.

*   **React "Duplicate Key" Error:**
    *   **Problem:** A new error, `Encountered two children with the same key`, appeared on the main document grid.
    *   **Root Cause:** The infinite scroll logic in `aivy-web/app/page.tsx` was appending new pages of documents without checking for duplicates.
    *   **Fix:** The state update logic was refactored to use a `Map` to guarantee the uniqueness of each document by its `id`, resolving the crash.

*   **Bizarre `ReferenceError`:**
    *   **Problem:** A `ReferenceError: initialLoad is not defined` began occurring in `page.tsx` for a state variable that was correctly declared.
    *   **Root Cause:** This was attributed to a likely bug within the Next.js/Turbopack build toolchain.
    *   **Fix:** To eliminate the error and simplify the component, the non-critical `initialLoad` state and all its associated logic were completely removed from the component.

*   **Network `CONNECTION_REFUSED` Error:**
    *   **Problem:** The most critical issue was that the frontend was unable to fetch any documents, with the browser console showing a `net::ERR_CONNECTION_REFUSED` error.
    *   **Investigation:**
        1.  The backend API route was discovered to be incorrect. The frontend was calling `/api/google-docs`, but the actual logic resided at `/drive/list`. This was fixed by creating a proper adapter route at `/api/google-docs` in the backend's `index.js`.
        2.  Authentication was suspected. The `google-api-program` was found to be losing its authentication tokens on every restart. The token persistence mechanism in `auth.js` was verified, and the problem was traced to a potentially corrupt `tokens.json` file. The file was deleted to force a clean re-authentication.
        3.  After all code fixes, the network error persisted. A final diagnostic test was performed by changing the frontend to call a public API (`jsonplaceholder.typicode.com`), which **succeeded**. This **definitively proved** the issue was not in the application code but in the user's local machine environment blocking requests to `localhost:8080`.

*   **Final Resolution:**
    *   After reverting the diagnostic test and restoring the code to its correct, final state, the user reported that the application **began working correctly**.
    *   Both document fetching and the in-editor styling (via the manual CSS workaround added previously) are now fully functional. The exact cause for the environmental network block resolving itself is unknown, but the application is now stable.
    *   All diagnostic `console.log` statements added during the session were removed from the codebase.