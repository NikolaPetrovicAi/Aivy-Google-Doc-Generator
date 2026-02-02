# 🚀 Aivy Workspace: High-Fidelity AI Document Engine

**Aivy Workspace** is an AI-powered document editor for Google Docs designed to solve a core limitation of LLM-based writing tools: lack of structure, control, and determinism in long-form documents.

Instead of generating free-form text, Aivy enforces a structured, schema-driven workflow where document layout is planned first and content is generated within strict architectural constraints. This enables reliable, high-fidelity document generation that integrates directly with real-world systems like the Google Docs API. 

---

## 🌟 Key Features

*   **Planner–Writer Architecture:** A two-stage generation workflow where document structure is defined before content generation, ensuring predictable long-form output and preventing structural drift.
*   **Schema-Constrained Generation:** All AI outputs are generated under strict structural constraints, guaranteeing valid document architecture and eliminating unreliable free-form text.
*   **Dynamic Document Blueprints:** Documents are generated from predefined structural building blocks, allowing flexible layouts while maintaining a consistent and enforceable document architecture.
*   **Context-Scoped In-Editor AI:** An embedded AI assistant that has full document awareness for style consistency, but is constrained to modify only the user-selected range—preventing unintended global edits.

---

## 🛠 Engineering Challenges & Solutions

### 1. Deterministic AI → Document Structure Mapping
**Problem:** Free-form AI outputs are difficult to reliably map onto the strictly hierarchical and index-sensitive Google Docs API, often resulting in malformed documents or fragile post-processing logic.

**Solution:** Introduced a schema-constrained intermediate representation between the LLM and the Google Docs API. Using OpenAI Structured Outputs, the model is forced to generate a strictly typed document blueprint, guaranteeing structural validity before any API-level rendering occurs. This enables deterministic conversion from AI output into complex Google Docs update sequences without heuristic parsing.

### 2. HTML ↔ Google Docs Rendering Parity
**Problem:** Achieving visual consistency between a browser-based rich-text editor and Google Docs is non-trivial due to fundamentally different rendering models and Google Docs’ implicit style inheritance behavior.

**Solution:** Built a custom style translation layer that explicitly controls formatting order and overrides default inheritance rules. The system enforces deterministic spacing, indentation, and line breaks. For advanced alignment scenarios, list markers are rendered via calculated visual counters rather than native HTML lists, enabling precise left, center, and right alignment that matches Google Docs’ layout behavior.

### 3. High-Performance AI Streaming in Rich-Text
**Problem:** Streaming AI-generated text directly into a rich-text editor caused excessive re-rendering and degraded performance, particularly during long generation sessions.

**Solution:** Implemented a state isolation strategy where streaming updates are applied directly to the editor’s internal ProseMirror state, while React-level state synchronization occurs only after the stream completes. This allows smooth real-time generation without blocking the UI or triggering unnecessary re-renders.

---

## 🏗 Architecture & Tech Stack

### Frontend
- **Framework:** Next.js (App Router) with React.
- **Editor:** Tiptap (ProseMirror) with custom extensions for structured content, alignment, and AI-assisted editing.
- **Styling:** Tailwind CSS for consistent, utility-driven UI composition.

### Backend
- **Runtime:** Node.js with Express.
- **AI Orchestration:** OpenAI API with streaming support and schema-constrained generation.
- **Integrations:** Google Workspace APIs (Docs, Drive, OAuth 2.0).
- **Session Management:** Secure multi-user session handling for OAuth tokens and editor state.

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js 20+
- Google Cloud Project with Docs/Drive APIs enabled.
- OpenAI API Key.

### Quick Start
1. **Clone & Install:**
   ```bash
   git clone https://github.com/your-username/aivy-workspace
   cd aivy-workspace
   npm install && cd frontend && npm install && cd ../backend && npm install
   ```
2. **Environment Setup:** Create a `.env` in the `backend/` folder (see `.env.example`).
3. **Run Locally:**
   - **Backend:** `cd backend && node index.js`
   - **Frontend:** `cd frontend && npm run dev`
4. **Authenticate:** Visit `http://localhost:3000`. The application will automatically redirect you to the Google login page to link your account.

---

## 🔮 Future Improvements
- **Project-Scoped Contextual Intelligence:** Introduce project-level context where related documents are grouped and indexed together, enabling the AI to perform cross-document reasoning, edits, and queries within a bounded knowledge space.
- **Automated Consistency & Quality Checks:** Add a secondary review phase that evaluates generated content for structural consistency, formatting correctness, and logical coherence before final insertion, reducing error propagation in long-form documents.
- **Automated Consistency & Quality Checks:** Add a secondary review phase that evaluates generated content for structural consistency, formatting correctness, and logical coherence before final insertion, reducing error propagation in long-form documents.
