# WhatsApp Web Extensions — Desktop-Like Interactions

> **Author:** Muhammad Ali Zahid — Software Engineer & Developer  
> **Version:** 1.1 | **Status:** Production-Ready

A powerful Chrome extension that brings the intuitive desktop-like interactions of WhatsApp Desktop to WhatsApp Web. Enhanced left-click reactions, smart right-click menus, advanced file management, and a resizable chat sidebar.

---

## 🎯 Overview

WhatsApp Web lacks key features from the desktop application that improve productivity and user experience:

| Feature | Desktop | Web (Native) | With Extension ✓ |
|---------|---------|--------------|------------------|
| Left-click for emoji reactions | ✓ | ✗ | ✓ |
| Right-click message menu | ✓ | ✗| ✓ |
| Smart file downloads | ✓ | ✗ | ✓ |
| Resizable chat sidebar | ✓ | ✗ | ✓ |

This extension intelligently replicates desktop behavior while preserving all native WhatsApp Web functionality.

---

## ✨ Core Features

### 1. **Left-Click Emoji Reactions**
- **Single left-click** on any text message instantly opens the emoji reaction picker
- Supports emoji-only messages and mixed text+emoji
- Sophisticated click detection:
  - Distinguishes between single-click intent and text selection
  - Ignores accidental drags (>5px movement cancels the trigger)
  - Prevents double-click false positives (<280ms time gate)
- Smart text detection:
  - Works on plain text, emoji text, formatted messages
  - Skips media, links, buttons, and interactive elements
  - Scope limited to actual message containers only

**Use Case:** Desktop-like speed — no need to hover and find the reaction button.

---

### 2. **Right-Click Message Menu**
- **Right-click any message** (text or media) to open WhatsApp's native context menu
- Works on all message types:
  - ✓ Text messages
  - ✓ Images and GIFs
  - ✓ Videos (with play/download controls)
  - ✓ Audio messages (with play/download/waveform controls)
  - ✓ Documents and files
  - ✓ Stickers
- Blocks browser's default context menu and triggers WhatsApp's instead
- Full access to message options (reply, forward, delete, pin, react, etc.)

**Use Case:** Faster message management without moving your hand to the message options button.

---

### 3. **Intelligent File & Document Download Management**

#### Smart Detection
- Automatically detects file/document messages
- Intercepts clicks on:
  - Direct download links (`<a download>`)
  - Download buttons (role="button" with Download title)
  - Filename text near downloads
- Works with **all file types**: PDFs, images, videos, audio, documents, archives, executables, etc.

#### First-Time Download
- Click a file → Downloads normally to your default folder
- No extra dialogs or interruptions
- Seamless experience

#### Already Downloaded
When you click a file you've downloaded before:

```
┌─────────────────────────────────┐
│  File Already Downloaded        │
│                                 │
│  "document.pdf" has already     │
│  been downloaded.               │
│                                 │
│  [Cancel] [Save As] [Open]  ←  │
└─────────────────────────────────┘
```

**Three Action Options:**
- **Open** — Launch the file with your default application (instant access)
- **Save As** — Download a fresh copy and choose a different location
- **Cancel** — Do nothing, close the dialog

#### Download Detection Features
- ✓ **Automatic duplicate detection** using Chrome Downloads API
- ✓ **Cross-session memory** — Remembers downloads across browser sessions
- ✓ **Exact filename matching** — Only triggers for identical files
- ✓ **Background service worker** — Runs safely outside the page context
- ✓ **Custom WhatsApp-styled UI** — Matches platform design language
- ✓ **File history support** — Works with any downloadable file

---

### 4. **Resizable Chat List Sidebar**

Expand or collapse the chat list to see more conversations at a glance or focus on the current conversation.

#### How to Use
1. **Hover** over the divider between chat list and chat window
2. **Cursor changes** to resize mode (`↔`)
3. **Drag left** to shrink the chat list (min: 200px)
4. **Drag right** to expand the chat list (max: 600px)
5. **Width persists** across page reloads via localStorage

#### Visual Feedback
- Divider highlights with **teal/cyan tint** on hover
- Smooth **0.2s transitions** during resize
- Handle is **only 10px wide** — minimal visual footprint
- **Live resize** — messages reflow in real-time as you drag

#### Smart Persistence
- Saves your preferred width automatically (`localStorage: xh_sidebar_width`)
- Restores on every load
- No configuration needed

---

## 🛠️ Technical Architecture

### Event-Driven Design

```
┌─────────────────────────────────────────┐
│         WhatsApp Web Document           │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┐
        │ Event Layer │
        └──┬───────┬──┤
           │       │  │
    [Mousedown] [Mousemove] [Click] [Contextmenu]
    (capture=true, passive=true/false)
           │       │  │
           └───┬───┴──│
               │      │
        ┌──────▼──────▼────┐
        │ Handler Pipeline │
        └──┬───────┬───┬───┘
           │       │   │
    [File Detection] [Reaction Logic] [Menu Logic]
           │       │   │
           └───┬───┴───┘
               │
        ┌──────▼────────┐
        │ Chrome APIs   │
        │ & DOM Mutation│
        └──────────────┘
```

### Core Modules

| Module | File | Responsibility |
|--------|------|-----------------|
| **Content Script** | `content.js` | DOM interception, click handling, state management, UI injection |
| **Background Service Worker** | `background.js` | Chrome Downloads API calls, file history checks, open/show file operations |
| **Manifest** | `manifest.json` | Extension metadata, permissions, script registration |

### Key Implementation Details

#### Smart Message Detection
```javascript
// Multi-fallback DOM traversal strategy
1. Check for data-id, data-msgid, data-message-id attributes
2. Check for role="row", role="group" semantic markers  
3. Check for data-testid containing "message"
4. Walk up tree (max 15 levels) for any of above
```

#### Click Intent Disambiguation
```javascript
// Detect single-click intent vs. text selection
mousedown: Track X/Y coordinates
mousemove: If movement >5px, mark as selection intent
click:     If time <280ms since last click, ignore (double-click)
           If selection intent active, ignore (text drag)
           Otherwise: Trigger reaction
```

#### File Click Interception
```javascript
// Multi-path file detection
if (element is <a download>)                  → File click
if (element in div[role="button"][title*="Download"]) → File click
if (element.closest("[data-id]") has a[download])     → File click
→ Prevent default, check download history, show dialog
```

#### Resize Handle Positioning
```javascript
// Fixed-position overlay approach (non-invasive)
1. Create position:fixed 8px-wide stripe overlay on document.body
2. Position at #main.getBoundingClientRect().left (the true divider)
3. Update position on every drag move and window resize
4. Never touches WhatsApp's internal DOM structure
```

---

## 📋 Installation

### For Personal/Development Use

1. **Clone or Download**
   ```bash
   git clone https://github.com/yourusername/whatsapp-extension.git
   cd whatsapp-extension
   ```

2. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/`
   - Enable **Developer Mode** (top-right toggle)

3. **Load Unpacked**
   - Click **Load unpacked**
   - Select the extension folder
   - Extension appears in your toolbar instantly

4. **Grant Permissions** (if prompted)
   - Extension requests `downloads` and `downloads.open` permissions
   - Click **Allow**

5. **Test It Out**
   - Open https://web.whatsapp.com
   - Left-click a text message → emoji reactions appear
   - Right-click any message → WhatsApp menu appears
   - Click a file → custom dialog if already downloaded
   - Drag the chat list divider → resize sidebar

✅ **No restart needed — extension auto-activates**

---

## ⚙️ How It Works — Deep Dive

### Left-Click Reaction Flow

```
User clicks message text
         ↓
[mousedown event captured]
  Store: X, Y, timestamp
         ↓
[mousemove event captured]
  If delta >5px → mark as selection, ignore
         ↓
[click event captured]
  Check: not double-click (<280ms)?
  Check: not a drag (isTextSelection)?
  Check: inside .copyable-text or [data-pre-plain-text]?
  Check: on actual text element (not button/link/media)?
         ↓
[All checks pass]
  Find message container using multi-fallback strategy
         ↓
[Trigger reaction button]
  Search with priority:
    1. aria-label="react" or data-testid="react"
    2. Emoji in text content
    3. SVG icon in button
    4. Leftmost button near message
         ↓
✓ Emoji picker opens
```

### Right-Click Menu Flow

```
User right-clicks message
         ↓
[contextmenu event captured]
  Prevent browser menu (event.preventDefault)
         ↓
[Find message container]
  Check if target is inside [data-id], [data-msgid], etc.
         ↓
[Search for "message options" button]
  With priority:
    1. aria-label containing "menu" or "more"
    2. data-testid containing "menu" or "down"
    3. SVG icon in span[role="button"]
    4. Nearby button in parent container
         ↓
[Click the menu button]
  (triggers WhatsApp's native menu)
         ↓
✓ Message options menu appears
```

### File Download Flow

```
User clicks file/document in chat
         ↓
[click event captured]
  Check if target is: <a download> or download button?
         ↓
[YES → file message detected]
  Extract filename from attributes/title
  event.preventDefault()
  event.stopPropagation()
         ↓
[Query Chrome Downloads API]
  Background service worker searches by filename
         ↓
      NOT FOUND          ╱            FOUND
         │             ╱                 │
         ├─────────────┘                 │
         ↓                               ↓
  [Download normally]          [Show custom dialog]
  Standard browser           ┌─────────────────────┐
  download to               │ File Already        │
  Downloads folder          │ Downloaded          │
                           ├─────────────────────┤
                           │ [Cancel]            │
                           │ [Save As] [Open] ←─ │
                           └─────────────────────┘
```

### Sidebar Resize Flow

```
User hovers chat list divider
         ↓
[Cursor changes to col-resize]
  Pseudo-element ::after has cursor:ew-resize
         ↓
User presses mouse on divider
         ↓
[mousedown event on handle]
  Record: initialMouseX, initialWidth
  Add CSS class .xh-resizing
         ↓
User drags left/right
         ↓
[mousemove at document level]
  Calculate: delta = event.clientX - initialMouseX
  New width = initialWidth + delta
  Apply: element.style.maxWidth = width + "px"
  Save: localStorage.setItem("xh_sidebar_width", width)
         ↓
User releases mouse
         ↓
[mouseup event]
  Remove CSS class .xh-resizing
  Final width persists in localStorage
         ↓
✓ Reloads restore saved width automatically
```

---

## 🔐 Permissions & Safety

### Required Permissions

| Permission | Used For | Why Needed |
|-----------|----------|-----------|
| `downloads` | Check download history | Detect if file was already downloaded |
| `downloads.open` | Open downloaded files | Allow "Open" button in file dialog |
| `host_permissions: https://web.whatsapp.com/*` | Content script injection | Inject handlers into WhatsApp Web |

### What This Extension Does NOT Do

- ✗ Does NOT read your messages
- ✗ Does NOT store any data beyond sidebar width preference
- ✗ Does NOT track your activity
- ✗ Does NOT make external network requests (except Chrome API calls)
- ✗ Does NOT modify message content
- ✗ Does NOT interact with WhatsApp Web's authentication

### Privacy & Data

- **Sidebar width** is stored locally on your computer (`localStorage`)
- **No cloud sync** — width preference never leaves your device
- **No analytics** — no tracking or telemetry
- **No background tasks** — only runs while WhatsApp Web is active

---

## 📁 File Structure

```
wa-dblclick-reactions/
├── manifest.json              # Extension metadata & permissions
├── content.js                 # Main content script (~1300 lines)
│   ├── File detection & download management
│   ├── Left-click emoji reaction system
│   ├── Right-click message menu logic
│   ├── Resizable chat sidebar feature
│   ├── Event listeners & guard clauses
│   └── DOM traversal strategies
├── background.js              # Service worker (~200 lines)
│   ├── Chrome Downloads API interface
│   ├── File history lookup
│   ├── Open/show file operations
│   └── Async message handlers
├── README.md                  # This documentation
└── wa-dblclick-reactions.worktrees/  # Dev version snapshots
```

---

## 🚀 Performance Optimizations

- ✓ **Passive event listeners** for mousedown/mousemove (capture phase, non-blocking)
- ✓ **Lazy initialization** — waits for #side to exist before setting up resizer
- ✓ **Bounded DOM traversal** — max 15 levels up from click target
- ✓ **Early-exit guards** — returns immediately on ignored elements
- ✓ **Efficient selectors** — uses ID and data-attribute queries, not fragile classes
- ✓ **Debounced recovery** — re-applies divider clearing at 250ms intervals for ~5s
- ✓ **Minimal memory footprint** — no persistent observers after initialization
- ✓ **localStorage caching** — width preference lookup is O(1)
- ✓ **Single-fire polling** — resize setup clears interval after first success

---

## 🔄 Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| **Chrome** | ✓ Full | Manifest V3, tested on latest versions |
| **Chromium** | ✓ Full | Edge, Brave, Vivaldi (Chromium-based) |
| **Firefox** | ✗ Not yet | Would require manifest.json conversion |
| **Safari** | ✗ Not yet | Uses different extension API |

### WhatsApp Web Compatibility
- ✓ Modern WhatsApp Web (2023–2026)
- ✓ Works on all chat types (1:1, groups, broadcast lists)
- ✓ Survives WhatsApp SPA navigation (archive, settings, back)
- ✓ Re-injects resizer after WhatsApp re-renders
- ⚠ Class names change occasionally → uses data-attributes & ARIA labels as fallback

---

## 🧩 Integration with Existing Features

### Does NOT Break
- ✓ Text selection, highlighting, and copy-paste
- ✓ Image/GIF/video preview and playback
- ✓ Audio message playback
- ✓ Links, buttons, and media elements
- ✓ Native emoji picker
- ✓ Search functionality
- ✓ Chat navigation and pinning
- ✓ Voice/video calls
- ✓ Status sharing
- ✓ Settings and profile management

### Works Alongside
- ✓ Other WhatsApp extensions (if non-conflicting)
- ✓ Browser extensions: ad blockers, password managers, accessibility tools
- ✓ Browser features: bookmarks, history, extensions management
- ⚠ Another resizer extension: disable the other one to avoid resize conflicts

---

## 🐛 Known Limitations & Workarounds

| Limitation | Cause | Workaround |
|-----------|-------|-----------|
| Emoji selection uses regex | New emoji sets added regularly | Update emoji pattern (PR welcome) |
| Reaction button search is heuristic | WhatsApp's DOM is dynamic | Falls back to leftmost button if no match |
| Resizer handle is 10px wide | Intentional minimalist design | Edit CSS in content.js if needed |
| File detection only works on #pane-side | Message DOM structure narrow | Pinned/reported messages already supported |
| Sidebar width resets if cache cleared | Normal browser behavior | Clear cache less frequently or save to notes |

---

## 🔮 Future Roadmap

- [ ] Keyboard shortcuts (e.g., `Alt+E` for quick emoji reaction)
- [ ] Hover preview of emoji reactions already on the message
- [ ] Downloaded file preview in the dialog (thumbnail + file size)
- [ ] "Show in folder" option for quick access to Downloads
- [ ] Auto-adjust sidebar width on multi-monitor screen size changes
- [ ] Light/dark mode auto-detection for resizer handle styling
- [ ] Firefox webextension port (manifest conversion)
- [ ] Chrome Web Store submission (with proper WhatsApp legal disclaimers)
- [ ] Pin frequently-used emoji for quick access
- [ ] Custom reaction keyboard shortcuts per contact

---

## 💡 Technical Challenges & Solutions

| Challenge | Root Cause | Solution | Impact |
|-----------|-----------|----------|--------|
| **Text selection interferes with click intent** | mousedown → mousemove → click natural flow | Track movement delta (>5px = selection), timing (<280ms = double-click) | Reliable single-click detection |
| **WhatsApp class names change frequently** | Aggressive minification & bundling | Use data-attributes, ARIA labels, semantic roles, emoji detection | Future-proof even across versions |
| **Reaction button hard to find in DOM** | Multiple possible button layouts | Multi-level search: aria-label → data-testid → emoji text → SVG icon → leftmost | Works across all WhatsApp Web layouts |
| **File detection only on specific buttons** | Multiple download UI patterns | Detect link, button, and nearby link in 3 fallback paths | Catches all file download methods |
| **Divider line persists after resize** | WhatsApp re-paints during SPA navigation | Query hardcoded selector + structural fallback; re-apply on drag & init | Line always removes correctly |
| **Sidebar collapses after re-render** | WhatsApp rebuilds chat list panel | MutationObserver on #app watches for changes; re-injects resizer | Handle survives WhatsApp reloads |
| **Messages don't fill resized space** | WhatsApp's flex basis doesn't shrink #main | Apply `flex: 1 1 0` + `minWidth: 0` to #main | Chat area scales with sidebar |
| **Handle repositions incorrectly** | Element moved but overlay didn't follow | Re-position on every mousemove + window.resize listener | Handle stays glued to divider |

---

## 📝 License & Attribution

- **Author:** Muhammad Ali Zahid
- **Type:** Personal/Open-Source Chrome Extension
- **Version:** 1.1 | **Status:** Production-Ready
- **License:** MIT (or specify your preferred license)

**Disclaimer:** This extension is **not affiliated with, endorsed by, or associated with WhatsApp, Meta, or Facebook Inc.** It is an independent third-party tool designed solely to enhance user experience on WhatsApp Web. WhatsApp is a trademark of Meta Platforms, Inc.

---

## 💬 Feedback & Contributions

Found a bug? Have a feature request? Want to contribute?

- **Report Issues:** Open an issue with:
  - Chrome version and OS
  - Steps to reproduce
  - Screenshot/video if applicable
  - Browser console errors (F12)

- **Test Thoroughly On:**
  - Multiple message types (text, emoji, media, files)
  - Different chat types (1:1, groups, broadcast)
  - WhatsApp Web navigation (archive, search, settings)
  - Chrome profile with other extensions installed

- **Contribute:** Pull requests welcome for:
  - Bug fixes
  - Performance improvements
  - New features (with discussion first)
  - Documentation updates

---

## 🙏 Thank You

Thank you for using **WhatsApp Web Extensions**! We hope this brings you closer to the desktop experience. Your feedback makes this project better. 🎉

**Happy messaging!** 💬

