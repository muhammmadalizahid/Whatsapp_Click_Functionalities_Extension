# WhatsApp Web Desktop Reactions Extension

**Author:** Muhammad Ali Zahid – Software Engineer & Developer

A Chrome extension that brings WhatsApp Desktop’s Left-click emoji reactions and right-click message menu to WhatsApp Web.

---

## Project Overview

WhatsApp Web lacks some of the intuitive interactions available in the desktop app, such as:

- Left-clicking a text message to open the emoji reaction menu
- Right-clicking any message (text or media) for the native options menu, including media controls (play/download/waveform)

This extension replicates desktop-like behavior in the web environment by intelligently handling click events on text messages while preserving normal media interaction (clicking images/videos opens them, audio plays normally) and ensuring media controls still bring up the WhatsApp menu on right-click.

---

## Features

- Left-click on message text to open the emoji reaction menu (emoji-only messages supported)  
- Right-click on any message (text or media) or media control (play, download, waveform) to open the message options menu  
- **Smart document/file download management:**
  - Detects clicks on file/document messages
  - Automatically checks if file was already downloaded using Chrome Downloads API
  - First download: Downloads normally to your default downloads folder
  - Already downloaded: Shows custom WhatsApp-styled dialog with three options:
    - **Open** - Opens the file with your default application
    - **Save As** - Downloads again and lets you choose location
    - **Cancel** - Closes the dialog
  - Works seamlessly with PDFs, documents, images, videos, audio files, and all file types
  - Fully integrated with existing click behaviors
- Works across text, images, GIFs, videos, audio messages, stickers, and documents  
- Media elements remain fully clickable for normal viewing/playback  
- Ignores non-message elements like system messages, headers, navigation buttons, and links  
- Handles text selection gracefully to prevent accidental emoji triggers  
- Zero configuration needed - works out of the box
- Optimized for performance and reliability on WhatsApp Web  

---

## Tech Stack

- **Language:** JavaScript (ES6)  
- **Environment:** Chrome Extension (content script)  
- **Skills Demonstrated:**  
  - DOM traversal and element detection  
  - Event engineering (mousedown, mousemove, click, contextmenu)  
  - Capture-phase event handling to override native web app behavior  
  - Performance optimizations and defensive coding  
  - UX emulation of desktop applications  

---

## Challenges Solved

1. **Desktop-like Left-click reactions on web**  
   - Solved browser text selection interfering with reaction triggers  
   - Rebuilt “Left-click intent” logic using custom timing and movement detection  

2. **Smart click differentiation**  
   - Left-click only on text messages (supports emoji-only text)  
   - Right-click works on all message types (text and media) and media controls (play/download/waveform)  
   - Media elements remain fully functional (images open, videos play, audio works)  

3. **Reliable reaction button detection**  
   - Multi-level DOM traversal to find buttons even if WhatsApp updates class names  
   - Fallbacks using `aria-label`, `data-testid`, emoji text heuristics  

4. **Minimized accidental triggers**  
   - Ignored inputs, navigation buttons, and system messages  
   - Used precise bounding box checks and element type detection  

5. **Performance-conscious emoji detection**  
   - Runs expensive emoji regex only after faster aria-label checks fail  
   - Narrow search scope with parent fallback to avoid neighbor messages

---

## Installation (for personal use)

1. Clone or download this repository  
2. Open Chrome → Extensions → Developer Mode  
3. Click **Load unpacked** and select the project folder  
4. The extension will request permissions for:
   - `downloads` - To check download history and prevent duplicate downloads
   - `downloads.open` - To open downloaded files directly from WhatsApp  
5. Refresh WhatsApp Web; the extension will automatically start  
6. Left-click a text message to see emoji reactions (supports emoji-only text)  
7. Right-click any message or media control to open the message options menu
8. Click on files/documents to download - if already downloaded, you'll see options to Open or Save As

No configuration needed! The extension works automatically with intelligent defaults.

---

## How It Works

- Tracks mousedown and mousemove to detect text selection vs. single clicks  
- Determines the message container dynamically using multiple heuristics and fallbacks (data-id/msgid, data-testid, role row/group, closest parent)  
- Detects text (including emoji-only text) and keeps media interaction intact  
- **File/document detection:** Identifies file messages and intercepts clicks before default download
- **Background service worker:** Uses Chrome Downloads API to check download history and open files
- **Custom dialog UI:** Shows WhatsApp-styled dialog for already-downloaded files
- Right-click: blocks browser menu, then triggers WhatsApp menu for message + media controls  
- Left-click: triggers the native reaction button on text messages only  
- Clears text selection to mimic desktop behavior  
- Uses optimized search scope (message-first, then parent) to avoid neighbor targeting  

---

## File Download Management

### How It Works

The extension intelligently manages file downloads to prevent duplicates and give you quick access to already-downloaded files:

**First Time Downloading:**
- Click any file/document in WhatsApp
- Downloads normally to your default downloads folder
- No extra dialogs or interruptions

**Already Downloaded:**
- Click a file you've downloaded before
- Custom WhatsApp-styled dialog appears with three options:
  - **Open** - Opens the file immediately with your default application (PDF viewer, Word, media player, etc.)
  - **Save As** - Downloads a new copy and lets you choose where to save it
  - **Cancel** - Closes the dialog without doing anything

### Smart Features

- **Automatic duplicate detection:** Uses Chrome's download history to instantly check if you've downloaded a file
- **Cross-session memory:** Remembers downloads even after closing the browser
- **Exact filename matching:** Only shows the dialog for the exact same file
- **All file types supported:** Works with PDFs, images, videos, audio, documents, archives, and any downloadable file
- **Non-intrusive:** Downloads work normally for new files, no extra clicks needed
- **WhatsApp-styled UI:** Custom dialog matches WhatsApp's design language

### Permissions

The extension requires these permissions:
- `downloads` - To check download history and prevent duplicate downloads
- `downloads.open` - To open downloaded files with one click
- `host_permissions` - To detect file clicks on WhatsApp Web

---

## Future Improvements

- Keyboard shortcut support for reactions  
- Hover preview of emoji reactions  
- MutationObserver integration for dynamic chat updates  
- Download location preview in dialog (show where file was saved)
- File size and download date in already-downloaded dialog
- Quick actions: Delete, Show in Folder, Copy Path
- Chrome Store-ready packaging with proper branding disclaimers  

