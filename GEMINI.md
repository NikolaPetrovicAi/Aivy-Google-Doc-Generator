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

## Next Steps: AI Document Generation

Based on the current project status, the next logical step is to implement the core AI document generation functionality. The plan is as follows:

1.  **Create UI Form:** The `generate/page.tsx` has been updated to feature a two-column layout. The left column contains a redesigned form, split into two sections. Section 1 allows users to select document type (Doc, Presentation, Sheet), input a topic, and choose the number of pages (up to 10) and language (English, Serbian). Section 2, initially disabled, provides options for content detail level (Minimal, Concise, Detailed, Extensive) and decorative theme buttons. The plan preview on the right column is now dynamically updated (with debouncing) only after all fields in Section 1 are completed.
2.  **Connect to Backend:** Link the frontend form to the `google-api-program` backend to initiate the document planning process using `aiPlanner.js`.
3.  **Display Plan:** Implement a UI to display the AI-generated plan, allowing the user to review and potentially edit it.
4.  **Generate Content:** After plan approval, trigger `aiWriter.js` to generate the full document content.
5.  **Display Document:** Present the final generated document to the user.

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