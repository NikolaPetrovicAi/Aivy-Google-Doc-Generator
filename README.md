# 🚀 Aivy Workspace  
### AI-Powered Document Automation for Google Workspace

Aivy Workspace is a modern AI-powered platform designed to automate the creation, formatting, and management of documents inside Google Workspace. It combines Google Docs/Drive integrations with OpenAI-powered content generation to deliver a seamless, end-to-end document workflow.

This project demonstrates my ability to build full-stack, production-ready features including OAuth authentication, cloud integrations, AI generation pipelines, and a professional frontend user experience.

---

## ⭐ Key Highlights (Recruiter-Friendly)

- **Full AI writing pipeline** — from document planning to complete multi-page content generation.  
- **Google Drive + Google Docs Integration** — browsing, reading, and creating Docs directly through the app.  
- **Intelligent Markdown → Google Docs conversion** — headings, lists, structure, and formatting.  
- **Professional UI/UX** — built with Next.js, React, Tailwind, and a TipTap rich-text editor.  
- **Secure OAuth flow** — Google authentication with token/session management.  
- **Real SaaS architecture** — clearly separated frontend/backend and consistent API design.

---

## 💡 What Aivy Workspace Does

Aivy Workspace removes the manual work from document creation:

1. The user enters a topic, tone, language, and length.  
2. AI generates a **page-by-page document outline**.  
3. The user edits or approves the structure.  
4. AI generates a complete document with consistent style and tone.  
5. The final formatted content is saved directly to **Google Drive**.  
6. Users can edit the output through an in-app **rich text editor**.

---

## 🔧 Tech Stack Overview

| Category | Technologies |
|---------|--------------|
| **Frontend** | Next.js, React, TypeScript, Tailwind CSS, TipTap Editor |
| **Backend** | Node.js, Express.js |
| **AI** | OpenAI API (content + outline generation) |
| **Cloud & Auth** | Google OAuth 2.0, Google Docs API, Google Drive API |
| **Other** | REST API architecture, cookie sessions, responsive UI design |

---

## 🧠 Core Features

### 1. **AI Document Generator**  
Generate fully written documents based on customizable inputs (topic, tone, length, etc.).

### 2. **Dynamic AI Outline Planner**  
AI produces a detailed page-by-page structure before writing begins.

### 3. **Rich Text Editing Experience**  
TipTap editor with clean formatting and live preview.

### 4. **Google Drive Integration**  
- Browse user files  
- Display Google Docs  
- Create new Docs with AI-generated content

### 5. **Advanced Formatting Logic**  
Backend engine translates AI Markdown into fully styled Google Docs elements.

### 6. **Modern, Responsive Frontend**  
Clean layout, fast rendering, and intuitive user experience.

---

## 🚀 Running the Project

### Backend

```bash
cd backend
npm install
```

Create `.env`:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8080/auth/google/callback
OPENAI_API_KEY=...
SESSION_SECRET=...
```

Start server:

```bash
node index.js
```

### 🔑 Logging In (Important)

To authenticate with your Google account, open:

```
http://localhost:8080/auth/google
```

This will start the OAuth flow and give the app permission to read/create Google Docs on your Drive.

---

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Available at:  
`http://localhost:3000`

---

## 🔐 Guest Access (Planned)

Aivy Workspace currently does **not** support guest or anonymous access.  
All features require signing in with a Google account due to Drive/Docs integration.

A guest mode will be added in the future, allowing users to try core AI features without authentication.

---

## 🔮 Future Improvements


* **Full-Featured Editing Toolbar**  
  Implement a complete WYSIWYG toolbar for the in-app editor, giving users advanced formatting options such as bold, italics, headings, lists, font styles, and colors.

* **Real-Time Collaborative Editing**  
  Add real-time collaboration so multiple users can edit the same document simultaneously, similar to Google Docs.

* **In-Editor AI Assistant**  
  Integrate contextual AI actions directly inside the editor. Users will be able to select text and apply actions like *Improve writing*, *Change tone*, *Summarize*, or *Check grammar*.

* **Two-Way Sync with Google Docs**  
  Upgrade from a one-direction “overwrite” model to full two-way synchronization. Any changes in Aivy Workspace would sync to Google Docs—and edits in Google Docs would sync back.

* **Template Library**  
  Create a library of ready-to-use document templates (resumes, reports, proposals, essays, etc.) to accelerate the document creation process.

---

