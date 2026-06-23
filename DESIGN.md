# Client Tracker CRM - Technical & Visual Design Document

This document outlines the visual identity, UI/UX tokens, and structural frontend guidelines for the **Client Tracker CRM**.

---

## 1. Visual Identity & Theme

The interface follows a **Modern Clean Enterprise** design system utilizing glassmorphism-inspired elements, soft cards, and high contrast navigation elements to ensure low eye strain during long-term operational use.

### A. Color Palette
The colors are harmoniously chosen to reflect professional enterprise software, departing from raw CSS base values:

| Palette | Token Name | Hex Value | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| **Primary Accent** | Indigo | `#4f46e5` | Primary buttons, active sidebar item indicators, focused border rings |
| **Secondary Accent** | Violet | `#7c3aed` | Secondary indicators, gradient highlights, special accents |
| **Main Surface** | Slate-50 | `#f8fafc` | Main application panel background, default page canvas |
| **Sidebar Canvas** | Slate-900 | `#0f172a` | Permanent left-hand sidebar navigation backdrop |
| **Borders / Separators** | Slate-100 | `#f1f5f9` | Cards, table row separators, inputs |
| **Text (Primary)** | Slate-800 | `#1e293b` | General text, form labels, header elements |
| **Text (Muted)** | Slate-500 | `#64748b` | Sub-titles, table columns headers, input placeholders |

### B. Dynamic Status Badges (CRM Stages)
To facilitate visual scanning in pipelines and tables, stages are coded with specialized contextual colors:
- **Lead**: `bg-blue-50 text-blue-700 border-blue-200`
- **Meeting Scheduled**: `bg-purple-50 text-purple-700 border-purple-200`
- **Proposal Sent**: `bg-amber-50 text-amber-700 border-amber-200`
- **In Progress**: `bg-indigo-50 text-indigo-700 border-indigo-200`
- **Closed Won**: `bg-emerald-50 text-emerald-700 border-emerald-200` (Success state)
- **Closed Lost**: `bg-rose-50 text-rose-700 border-rose-200` (Negative state)

---

## 2. Layout & Layout Guidelines

### A. Main App Layout Grid
The CRM uses a two-column responsive shell:
```
+-------------------------------------------------------------+
|  [Sidebar w-64] |  [Top Header: Current User / Settings]    |
|                 +-------------------------------------------+
|  Logo           |                                           |
|                 |  [Content Canvas]                         |
|  Nav Links:     |  Dynamic Views load here with             |
|  - Dashboard    |  fade-in animation                        |
|  - Companies    |                                           |
|  - Meetings     |                                           |
|  - Reminders    |                                           |
|  - Settings     |                                           |
+-----------------+-------------------------------------------+
```
- **Sidebar**: Fixed width `w-64` on desktop, shifting off-screen or collapses on tablet/mobile screens. Active options display an indigo left border and a glowing background.
- **Content Canvas**: Wrapped in modern padding (`p-6` to `p-8`) with an automatic `animate-fadeIn` opacity animation on change of view.

### B. Element Roundness and Shadows
- **Cards**: Large modern radius (`rounded-2xl` / `1rem`), simple thin borders (`border border-slate-100`), with an elevated shadow on hover (`transition-all duration-300 hover:shadow-md`).
- **Input Fields**: Standardized medium radius (`rounded-xl` / `0.75rem`) with high contrast focused ring states (`focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`).
- **Modals**: Centered overlays featuring a dynamic frosted glass background (`backdrop-blur-md` overlaying `bg-slate-900/50`). Inside contents are scrollable with capped `90vh` height.

---

## 3. Architecture & State Management

### A. View Routing (Single-Page App Flow)
To avoid unnecessary overhead, view routing is driven by React component state management in `App.jsx` (`view` and `auth` states):
- If the token is absent or invalid, the client forces render of `AuthViews.jsx` (providing Login or Registration toggles).
- If authenticated, the layout loads the main layout and renders:
  - `DashboardView.jsx`
  - `CompaniesView.jsx`
  - `MeetingsView.jsx`
  - `RemindersView.jsx`
  - `SettingsView.jsx`

### B. Axios API client (`api.js`)
An automated HTTP client interceptor system sits between the client UI and the server:
1. **Request Interceptor**: Automatically pulls the authentication JWT `token` from `localStorage` and injects it into the HTTP header:
   ```javascript
   Authorization: Bearer <token>
   ```
2. **Response Interceptor (Token Refresh)**: If the backend returns a `401` or `403` token expiration error, the interceptor intercepts the queue, calls the `/token` endpoint using the saved `refreshToken`, sets the new access token, and retries the original request seamlessly.

---

## 4. Typography System

The application uses clean, modern sans-serif typography (e.g., **Inter** or system UI fallbacks) to maximize datagrid legibility.
- **Document Titles**: Size `text-3xl` (`1.875rem`), weight `font-bold`, color `#1e293b`.
- **Section Headers**: Size `text-xl` (`1.25rem`), weight `font-semibold`.
- **Body & Labels**: Size `text-sm` (`0.875rem`) or `text-base` (`1rem`) to keep the table layout compact and informative.
