# Aivy Workspace: AI-Powered Document Collaboration in Google Workspace

Aivy Workspace is an intelligent, AI-powered productivity platform designed to streamline professional document creation and management. It is tightly integrated with Google Workspace (Docs, Drive, Calendar) and leverages the OpenAI API to help users generate and refine high-quality documents without extensive manual writing or formatting.

This project was built to showcase a modern, full-stack application that solves a real-world problem: automating the tedious aspects of document creation. It demonstrates expertise in frontend and backend development, API integration, and building a seamless user experience.

## Key Features

*   **AI-Powered Document Generation**: Users can generate complete, multi-page documents by simply providing a topic, tone, desired length, and language. The AI handles the rest, from planning the structure to writing the content.
*   **Dynamic Document Planning**: Before content is written, the AI generates a page-by-page plan (titles, summaries, key elements). Users can review and edit this plan, giving them full control over the final output.
*   **Rich Text Editor & In-App Editing**: Generated documents are displayed in a beautiful, in-app rich-text editor (built with TipTap). This allows for a seamless editing experience without leaving the application.
*   **Google Drive Integration**: The application authenticates with users' Google accounts (via OAuth 2.0) to browse, display, and manage their existing Google Docs. All newly generated documents are saved directly to the user's Google Drive.
*   **Advanced Formatting**: The backend features a sophisticated translation layer that converts AI-generated Markdown into properly formatted Google Docs content, including headings, lists, and other styles.
*   **Modern Frontend**: A responsive and intuitive user interface built with Next.js, React, and TypeScript, featuring infinite scrolling for document lists and real-time previews.

## Tech Stack

| Category      | Technologies                                                              |
|---------------|---------------------------------------------------------------------------|
| **Frontend**  | Next.js, React, TypeScript, Tailwind CSS, TipTap (Rich Text Editor)       |
| **Backend**   | Node.js, Express.js                                                       |
| **APIs**      | Google Workspace (Docs, Drive), OpenAI API                                |
| **Auth**      | Google OAuth 2.0                                                          |

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   Google Cloud Platform project with OAuth 2.0 credentials
*   OpenAI API key

### Backend Setup (`google-api-program`)

1.  **Navigate to the backend directory:**
    ```bash
    cd google-api-program
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create a `.env` file** in the `google-api-program` directory and add your API credentials:
    ```
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    GOOGLE_REDIRECT_URI=http://localhost:8080/auth/google/callback
    OPENAI_API_KEY=your_openai_api_key
    SESSION_SECRET=a_secure_random_string
    ```

4.  **Configure Google OAuth:** In your Google Cloud Console, ensure that `http://localhost:8080/auth/google/callback` is added to the "Authorized redirect URIs" for your OAuth 2.0 client.

5.  **Start the backend server:**
    ```bash
    node index.js
    ```
    The server will run on `http://localhost:8080`.

6.  **Authenticate with Google:** Open your browser and navigate to `http://localhost:8080/auth/google` to link your Google account.

### Frontend Setup (`aivy-web`)

1.  **Navigate to the frontend directory:**
    ```bash
    cd aivy-web
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the frontend development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

---

This project demonstrates a full-circle development process, from ideation and architectural design to implementation, debugging, and deployment readiness. It is a testament to building complex, AI-driven applications with a focus on user experience and robust backend services.
