(function () {
  "use strict";

  const console = {
    log: () => {},
    warn: () => {},
    error: () => {},
  };

  if (window.__waDoubleClickReactionsLoaded) return;
  window.__waDoubleClickReactionsLoaded = true;

  let mouseDownX = 0;
  let mouseDownY = 0;
  let mouseDownTime = 0;
  let isTextSelection = false;
  let lastClickTime = 0;

  // ==========================================
  // FILE/DOCUMENT DOWNLOAD MANAGEMENT
  // ==========================================

  /**
   * Detects if the clicked element is a file/document message
   * @param {Element} element - The clicked element
   * @returns {Object|null} - File info if it's a document, null otherwise
   */
  function isFileMessage(element) {
    // Check if clicked element itself is a download link
    if (element.tagName === "A" && element.hasAttribute("download")) {
      console.log("[WA-Extension] Direct click on download link detected");
      const fileName = element.getAttribute("download") || "document";
      const container = element.closest("[data-id]") || element.parentElement;

      return {
        sourceElement: element,
        container: container,
        downloadLink: element,
        downloadButton: null,
        fileName: fileName,
      };
    }

    // Check if clicked element is inside a download button
    const downloadButton = element.closest(
      'div[role="button"][title*="Download"]',
    );
    if (downloadButton) {
      console.log("[WA-Extension] Click inside download button detected");

      // Extract filename from title attribute
      const title = downloadButton.getAttribute("title") || "";
      const match =
        title.match(/Download\s+"(.+?)"/i) || title.match(/Download\s+(.+)/i);
      const fileName = match ? match[1] : "document";

      // Find the hidden download link nearby
      const container =
        downloadButton.closest("[data-id]") || downloadButton.parentElement;
      const downloadLink = container.querySelector("a[download]");

      console.log(
        "[WA-Extension] Download button - FileName:",
        fileName,
        "Link:",
        downloadLink,
      );

      return {
        sourceElement: element,
        container: container,
        downloadLink: downloadLink,
        downloadButton: downloadButton,
        fileName: fileName,
      };
    }

    // Check if we're clicking on filename text near a download link
    const nearbyDownloadLink = element
      .closest("[data-id]")
      ?.querySelector("a[download]");
    if (nearbyDownloadLink) {
      console.log("[WA-Extension] Click near download link detected");
      const fileName =
        nearbyDownloadLink.getAttribute("download") || "document";
      const container = element.closest("[data-id]") || element.parentElement;

      // Make sure we're not clicking on a text message
      const isTextMessage = element.closest(
        ".copyable-text, [data-pre-plain-text]",
      );
      if (
        isTextMessage &&
        !nearbyDownloadLink
          .closest("[data-id]")
          .querySelector('div[role="button"][title*="Download"]')
      ) {
        console.log("[WA-Extension] False positive - text message, not file");
        return null;
      }

      console.log(
        "[WA-Extension] File detected via nearby link - FileName:",
        fileName,
      );

      return {
        sourceElement: element,
        container: container,
        downloadLink: nearbyDownloadLink,
        downloadButton: null,
        fileName: fileName,
      };
    }

    console.log("[WA-Extension] Not a file message");
    return null;
  }

  /**
   * Extract filename from download item
   */
  function extractFileName(downloadItem) {
    return downloadItem.filename.split("/").pop().split("\\").pop();
  }

  // Track pending Save As capture
  let pendingSaveAs = null;
  let downloadLinkObserver = null;
  let suppressNextFileClick = false;

  function isMatchingDownloadLink(link, fileName) {
    if (!link || !link.href) {
      return false;
    }
    const downloadAttr = link.getAttribute("download") || "";
    if (
      downloadAttr &&
      (downloadAttr === fileName || downloadAttr.includes(fileName))
    ) {
      return true;
    }
    return (
      link.href.startsWith("blob:") &&
      (!downloadAttr || downloadAttr.includes(fileName))
    );
  }

  function findLinkInNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }
    if (node.tagName === "A") {
      return node;
    }
    return node.querySelector
      ? node.querySelector('a[download], a[href^="blob:"]')
      : null;
  }

  function startDownloadLinkObserver() {
    if (downloadLinkObserver) {
      return;
    }
    downloadLinkObserver = new MutationObserver((mutations) => {
      if (!pendingSaveAs) {
        return;
      }
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.target) {
          const link = mutation.target.tagName === "A" ? mutation.target : null;
          if (
            link &&
            isMatchingDownloadLink(link, pendingSaveAs.fileInfo.fileName)
          ) {
            console.log(
              "[WA-Extension] Captured download link from attribute mutation",
            );
            handleCapturedLink(link);
            return;
          }
        }
        if (mutation.addedNodes && mutation.addedNodes.length) {
          for (const node of mutation.addedNodes) {
            const link = findLinkInNode(node);
            if (
              link &&
              isMatchingDownloadLink(link, pendingSaveAs.fileInfo.fileName)
            ) {
              console.log(
                "[WA-Extension] Captured download link from added node",
              );
              handleCapturedLink(link);
              return;
            }
          }
        }
      }
    });
    downloadLinkObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "download"],
    });
  }

  function handleCapturedLink(link) {
    const pending = pendingSaveAs;
    pendingSaveAs = null;
    if (downloadLinkObserver) {
      downloadLinkObserver.disconnect();
      downloadLinkObserver = null;
    }
    if (pending && pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }
    const updatedFileInfo = { ...pending.fileInfo, downloadLink: link };
    downloadFileWithSaveAs(updatedFileInfo);
  }

  /**
   * Try to find a fresh download link for the given filename in the DOM
   */
  function findFreshDownloadLink(fileName) {
    const links = Array.from(
      document.querySelectorAll('a[download], a[href^="blob:"]'),
    );
    return (
      links.find((link) => {
        const downloadAttr = link.getAttribute("download") || "";
        return downloadAttr === fileName || downloadAttr.includes(fileName);
      }) || null
    );
  }

  /**
   * Handle file message click with custom download logic
   * @param {Event} event - Click event
   * @param {Object} fileInfo - File information object
   */
  async function handleFileClick(event, fileInfo) {
    console.log("[WA-Extension] handleFileClick called with:", fileInfo);

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (!chrome?.runtime?.id) {
      console.warn(
        "[WA-Extension] Extension context invalidated or not available",
      );
      alert(
        "Extension was reloaded. Please refresh WhatsApp Web (Ctrl+R) and try again.",
      );
      return;
    }

    // Check if file was already downloaded
    console.log(
      "[WA-Extension] Checking if file was downloaded:",
      fileInfo.fileName,
    );
    try {
      const response = await chrome.runtime.sendMessage({
        action: "checkIfDownloaded",
        fileName: fileInfo.fileName,
      });

      console.log("[WA-Extension] Download check response:", response);

      if (response && response.downloaded && response.downloadItem) {
        // File was already downloaded - ask user what to do
        console.log(
          "[WA-Extension] File already downloaded, showing options dialog",
        );
        showFileOptionsDialog(fileInfo, response.downloadItem);
      } else {
        // File not downloaded yet - download normally
        console.log("[WA-Extension] File not downloaded, downloading normally");
        downloadFileNormally(fileInfo);
      }
    } catch (error) {
      console.error("[WA-Extension] Error checking download status:", error);

      // Check if extension context was invalidated
      if (
        error.message &&
        error.message.includes("Extension context invalidated")
      ) {
        alert(
          "Extension was reloaded. Please refresh this page (Ctrl+R) to continue using the extension.",
        );
        return;
      }

      // Fallback to normal download
      downloadFileNormally(fileInfo);
    }
  }

  /**
   * Download file normally (default browser behavior)
   */
  function downloadFileNormally(fileInfo) {
    console.log("[WA-Extension] downloadFileNormally called");
    if (fileInfo.downloadLink) {
      console.log("[WA-Extension] Clicking download link");
      fileInfo.downloadLink.click();
    } else {
      // Try to find and click the download button
      console.log("[WA-Extension] No download link, trying button");
      const directButton =
        fileInfo.downloadButton ||
        fileInfo.sourceElement?.closest('div[role="button"], button');
      const containerButton =
        fileInfo.container
          .querySelector(
            'div[role="button"][title*="Download"], [aria-label*="Download"], button[aria-label*="Download"], [data-icon="audio-download"], [data-icon="document-download"]',
          )
          ?.closest('div[role="button"], button') ||
        fileInfo.container.querySelector(
          'div[role="button"][title*="Download"]',
        );
      const downloadButton = directButton || containerButton;
      if (downloadButton) {
        console.log("[WA-Extension] Found and clicking download button");
        suppressNextFileClick = true;
        downloadButton.click();
        setTimeout(() => {
          suppressNextFileClick = false;
        }, 300);
      } else {
        console.log(
          "[WA-Extension] No download button found, file may not be downloadable",
        );
      }
    }
  }

  /**
   * Download file with Save As dialog
   * Since WhatsApp uses blob URLs, we need to fetch the blob and use Downloads API
   */
  async function downloadFileWithSaveAs(fileInfo) {
    console.log("[WA-Extension] downloadFileWithSaveAs called");

    if (!fileInfo.downloadLink || !fileInfo.downloadLink.href) {
      console.warn("[WA-Extension] No download link available");
      downloadFileNormally(fileInfo);
      return;
    }

    try {
      const blobUrl = fileInfo.downloadLink.href;
      console.log("[WA-Extension] Fetching blob from:", blobUrl);

      // Fetch the blob data
      const response = await fetch(blobUrl);
      const blob = await response.blob();

      console.log(
        "[WA-Extension] Blob fetched, size:",
        blob.size,
        "type:",
        blob.type,
      );

      // Convert blob to data URL for chrome.downloads API
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      console.log("[WA-Extension] Data URL created, length:", dataUrl.length);

      // Send to background script to trigger download with saveAs
      chrome.runtime.sendMessage(
        {
          action: "downloadWithSaveAs",
          url: dataUrl,
          fileName: fileInfo.fileName,
        },
        (result) => {
          if (result && result.success) {
            console.log(
              "[WA-Extension] Save As download initiated successfully",
            );
          } else {
            console.warn(
              "[WA-Extension] Save As via API failed, using fallback",
              result?.error,
            );
            // Fallback: direct download
            const objectUrl = URL.createObjectURL(blob);
            const downloadLink = document.createElement("a");
            downloadLink.href = objectUrl;
            downloadLink.download = fileInfo.fileName;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            setTimeout(() => {
              document.body.removeChild(downloadLink);
              URL.revokeObjectURL(objectUrl);
            }, 100);
          }
        },
      );
    } catch (error) {
      console.error("[WA-Extension] Error in downloadFileWithSaveAs:", error);
      // Fallback to normal download
      console.log("[WA-Extension] Falling back to normal download");
      downloadFileNormally(fileInfo);
    }
  }

  /**
   * Show dialog asking user to Open or Save As existing file
   */
  async function showFileOptionsDialog(fileInfo, downloadItem) {
    console.log("[WA-Extension] showFileOptionsDialog called");

    // Immediately capture the blob before it expires
    let capturedBlob = null;
    if (fileInfo.downloadLink && fileInfo.downloadLink.href) {
      try {
        console.log("[WA-Extension] Capturing blob for later use...");
        const response = await fetch(fileInfo.downloadLink.href);
        capturedBlob = await response.blob();
        console.log(
          "[WA-Extension] Blob captured successfully, size:",
          capturedBlob.size,
        );
      } catch (error) {
        console.warn("[WA-Extension] Could not capture blob:", error);
      }
    } else {
      console.warn(
        "[WA-Extension] No download link available to capture blob from",
      );
    }

    // Create custom dialog
    const dialog = document.createElement("div");
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
      z-index: 999999;
      max-width: 400px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    `;

    const fileName = extractFileName(downloadItem);

    dialog.innerHTML = `
      <div style="margin-bottom: 16px; font-size: 16px; font-weight: 500; color: #111;">
        File Already Downloaded
      </div>
      <div style="margin-bottom: 20px; font-size: 14px; color: #667781;">
        "${fileName}" has already been downloaded.
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="wa-file-cancel" style="
          padding: 8px 16px;
          border: 1px solid #d1d7db;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          color: #54656f;
        ">Cancel</button>
        <button id="wa-file-saveas" style="
          padding: 8px 16px;
          border: none;
          background: #00a884;
          color: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">Save As</button>
        <button id="wa-file-open" style="
          padding: 8px 16px;
          border: none;
          background: #00a884;
          color: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">Open</button>
      </div>
    `;

    // Add backdrop
    const backdrop = document.createElement("div");
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.4);
      z-index: 999998;
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(dialog);

    // Handle button clicks
    dialog.querySelector("#wa-file-cancel").addEventListener("click", () => {
      document.body.removeChild(dialog);
      document.body.removeChild(backdrop);
    });

    dialog
      .querySelector("#wa-file-saveas")
      .addEventListener("click", async () => {
        document.body.removeChild(dialog);
        document.body.removeChild(backdrop);

        console.log("[WA-Extension] Save As clicked, fileInfo:", {
          hasContainer: !!fileInfo.container,
          hasDownloadLink: !!fileInfo.downloadLink,
          hasCapturedBlob: !!capturedBlob,
          fileName: fileInfo.fileName,
        });

        if (capturedBlob) {
          // Use the captured blob we stored earlier
          console.log(
            "[WA-Extension] Using captured blob for Save As, size:",
            capturedBlob.size,
          );
          try {
            // Convert blob to data URL
            const reader = new FileReader();
            const dataUrl = await new Promise((resolve, reject) => {
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(capturedBlob);
            });

            console.log(
              "[WA-Extension] Blob converted to data URL, length:",
              dataUrl.length,
            );

            // Send to background script
            chrome.runtime.sendMessage({
              action: "downloadWithSaveAs",
              url: dataUrl,
              fileName: fileInfo.fileName,
            });
          } catch (error) {
            console.error("[WA-Extension] Error using captured blob:", error);
            alert("Could not save file. Please try again.");
          }
        } else {
          // No blob captured - try to find a fresh link anywhere in the DOM
          const freshLink = findFreshDownloadLink(fileInfo.fileName);
          if (freshLink && freshLink.href) {
            console.log(
              "[WA-Extension] Found fresh link in DOM for Save As:",
              freshLink.href,
            );
            const updatedFileInfo = { ...fileInfo, downloadLink: freshLink };
            downloadFileWithSaveAs(updatedFileInfo);
            return;
          }

          // Try using the download URL from history (only if not a blob URL)
          const historyUrl = downloadItem?.finalUrl || downloadItem?.url;
          if (historyUrl && !historyUrl.startsWith("blob:")) {
            console.log(
              "[WA-Extension] Using download history URL for Save As:",
              historyUrl,
            );
            chrome.runtime.sendMessage({
              action: "downloadWithSaveAs",
              url: historyUrl,
              fileName: fileInfo.fileName,
            });
            return;
          }

          if (historyUrl && historyUrl.startsWith("blob:")) {
            console.warn(
              "[WA-Extension] History URL is a blob URL; cannot reuse for Save As",
            );
          }

          // Fallback: observe DOM while clicking the download button to capture the blob link
          console.log(
            "[WA-Extension] No usable URL, attempting observer-based capture...",
          );
          if (!fileInfo.container) {
            console.error("[WA-Extension] No container reference available!");
            alert(
              "Please click directly on the download icon and select Save As immediately.",
            );
            return;
          }

          const downloadButton = fileInfo.container.querySelector(
            'div[role="button"][title*="Download"]',
          );
          if (downloadButton) {
            console.log(
              "[WA-Extension] Starting observer and clicking download button",
            );
            pendingSaveAs = { fileInfo, timeoutId: null };
            startDownloadLinkObserver();
            pendingSaveAs.timeoutId = setTimeout(() => {
              if (pendingSaveAs) {
                pendingSaveAs = null;
                if (downloadLinkObserver) {
                  downloadLinkObserver.disconnect();
                  downloadLinkObserver = null;
                }
                alert(
                  "Could not capture the download link. Please click the download icon and use browser Save As.",
                );
              }
            }, 3000);

            suppressNextFileClick = true;
            downloadButton.click();
          } else {
            console.error("[WA-Extension] Could not find download button");
            alert(
              "Please click directly on the download icon and select Save As immediately.",
            );
          }
        }
      });

    dialog.querySelector("#wa-file-open").addEventListener("click", () => {
      document.body.removeChild(dialog);
      document.body.removeChild(backdrop);

      chrome.runtime.sendMessage({
        action: "openFile",
        downloadId: downloadItem.id,
      });
    });

    // Close on backdrop click
    backdrop.addEventListener("click", () => {
      document.body.removeChild(dialog);
      document.body.removeChild(backdrop);
    });
  }

  function findMessageContainer(element) {
    let current = element;
    let depth = 0;
    const maxDepth = 15;

    while (current && depth < maxDepth) {
      if (
        current.hasAttribute &&
        (current.hasAttribute("data-id") ||
          current.hasAttribute("data-msgid") ||
          current.hasAttribute("data-message-id"))
      ) {
        return current;
      }

      if (current.getAttribute) {
        const role = current.getAttribute("role");
        if (role === "row" || role === "group") {
          return current;
        }

        const testId = (
          current.getAttribute("data-testid") || ""
        ).toLowerCase();
        if (testId.includes("message") || testId.includes("msg")) {
          return current;
        }
      }

      current = current.parentElement;
      depth++;
    }

    return null;
  }

  function triggerReactionButton(messageContainer) {
    if (!messageContainer) return false;

    let searchArea = messageContainer;

    const allButtons = searchArea.querySelectorAll(
      'button, span[role="button"], div[role="button"]',
    );

    for (const button of allButtons) {
      const ariaLabel = (button.getAttribute("aria-label") || "").toLowerCase();
      const title = (button.getAttribute("title") || "").toLowerCase();

      if (
        (ariaLabel.includes("react") ||
          ariaLabel.includes("emoji") ||
          title.includes("react") ||
          title.includes("emoji")) &&
        !ariaLabel.includes("reply") &&
        !ariaLabel.includes("menu") &&
        !ariaLabel.includes("more") &&
        !ariaLabel.includes("forward")
      ) {
        const rect = button.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          button.click();
          return true;
        }
      }
    }

    const parentArea = messageContainer.parentElement;
    if (parentArea) {
      const parentButtons = parentArea.querySelectorAll(
        'button, span[role="button"], div[role="button"]',
      );

      for (const button of parentButtons) {
        const ariaLabel = (
          button.getAttribute("aria-label") || ""
        ).toLowerCase();
        const title = (button.getAttribute("title") || "").toLowerCase();

        if (
          (ariaLabel.includes("react") ||
            ariaLabel.includes("emoji") ||
            title.includes("react") ||
            title.includes("emoji")) &&
          !ariaLabel.includes("reply") &&
          !ariaLabel.includes("menu") &&
          !ariaLabel.includes("more") &&
          !ariaLabel.includes("forward")
        ) {
          const rect = button.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            button.click();
            return true;
          }
        }
      }
    }

    searchArea = parentArea || messageContainer;

    const testIdButtons = searchArea.querySelectorAll("[data-testid]");
    for (const elem of testIdButtons) {
      const testId = (elem.getAttribute("data-testid") || "").toLowerCase();
      if (testId.includes("react") || testId.includes("emoji")) {
        const clickable =
          elem.closest('button, span[role="button"], div[role="button"]') ||
          elem;
        if (clickable) {
          clickable.click();
          return true;
        }
      }
    }

    for (const button of searchArea.querySelectorAll(
      'button, span[role="button"], div[role="button"]',
    )) {
      const text = button.textContent || "";
      const hasEmoji =
        /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(
          text,
        );

      if (hasEmoji || button.innerHTML.includes("emoji")) {
        const ariaLabel = (
          button.getAttribute("aria-label") || ""
        ).toLowerCase();
        if (!ariaLabel.includes("menu") && !ariaLabel.includes("sticker")) {
          button.click();
          return true;
        }
      }
    }

    const buttons = searchArea.querySelectorAll("button[aria-label]");
    for (const button of buttons) {
      const rect = button.getBoundingClientRect();
      const msgRect = messageContainer.getBoundingClientRect();

      if (rect.right <= msgRect.left + 100 && rect.width > 0) {
        const ariaLabel = button.getAttribute("aria-label") || "";
        if (ariaLabel && !ariaLabel.toLowerCase().includes("menu")) {
          button.click();
          return true;
        }
      }
    }

    return false;
  }

  function triggerMessageMenu(messageContainer) {
    if (!messageContainer) return false;

    const buttons = messageContainer.querySelectorAll(
      'button[aria-label], span[role="button"][aria-label], div[role="button"][aria-label]',
    );

    for (const button of buttons) {
      const ariaLabel = button.getAttribute("aria-label") || "";
      const lowerLabel = ariaLabel.toLowerCase();

      if (
        lowerLabel.includes("menu") ||
        lowerLabel.includes("more") ||
        lowerLabel.includes("options") ||
        lowerLabel.includes("message options")
      ) {
        button.click();
        return true;
      }
    }

    const menuButton = messageContainer.querySelector(
      '[data-testid*="menu"], [data-testid*="down"], [data-testid*="chevron"]',
    );
    if (menuButton) {
      menuButton.click();
      return true;
    }

    const spanButtons = messageContainer.querySelectorAll(
      'span[role="button"], div[role="button"]',
    );
    for (const button of spanButtons) {
      if (
        button.querySelector("svg") &&
        !button.getAttribute("aria-label")?.toLowerCase().includes("react")
      ) {
        button.click();
        return true;
      }
    }

    const parent = messageContainer.parentElement;
    if (parent) {
      const nearbyButtons = parent.querySelectorAll(
        'button[aria-label], span[role="button"][aria-label]',
      );
      for (const button of nearbyButtons) {
        const ariaLabel = button.getAttribute("aria-label") || "";
        if (
          ariaLabel.toLowerCase().includes("menu") ||
          ariaLabel.toLowerCase().includes("more")
        ) {
          button.click();
          return true;
        }
      }
    }

    return false;
  }

  function handleRightClick(event) {
    const target = event.target;

    if (
      target.tagName === "INPUT" &&
      target.type !== "button" &&
      target.type !== "submit"
    ) {
      return;
    }

    if (target.tagName === "TEXTAREA") {
      return;
    }

    if (target.closest('textarea:not([data-testid*="media"])')) {
      return;
    }

    let messageContainer = findMessageContainer(target);

    if (!messageContainer) {
      messageContainer = target.closest(
        '[data-id], [data-message-id], [data-msgid], [data-testid*="message"], [data-testid*="msg"], [role="row"], [role="group"]',
      );
    }

    if (messageContainer) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      setTimeout(() => {
        triggerMessageMenu(messageContainer);
      }, 0);
    }
  }

  function handleMouseDown(event) {
    if (event.button === 0) {
      mouseDownX = event.clientX;
      mouseDownY = event.clientY;
      mouseDownTime = Date.now();
      isTextSelection = false;
    }
  }

  function handleMouseMove(event) {
    if (mouseDownTime > 0) {
      const deltaX = Math.abs(event.clientX - mouseDownX);
      const deltaY = Math.abs(event.clientY - mouseDownY);

      if (deltaX > 5 || deltaY > 5) {
        isTextSelection = true;
      }
    }
  }

  function isActualTextElement(element) {
    if (element.nodeType === Node.TEXT_NODE) {
      return true;
    }

    if (element.tagName === "SPAN" || element.tagName === "DIV") {
      const hasDirectText = Array.from(element.childNodes).some(
        (node) =>
          node.nodeType === Node.TEXT_NODE &&
          node.textContent.trim().length > 0,
      );

      if (hasDirectText) {
        return true;
      }

      const textContent = element.textContent.trim();
      if (textContent.length > 0) {
        const hasEmoji =
          /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(
            textContent,
          );
        if (hasEmoji) {
          return true;
        }
      }

      if (element.querySelector('img[alt], img[class*="emoji"]')) {
        return true;
      }
    }

    if (
      element.tagName === "IMG" &&
      (element.alt || element.className?.includes("emoji"))
    ) {
      return true;
    }

    return false;
  }

  function handleClick(event) {
    const target = event.target;

    if (event.button !== 0) {
      return;
    }

    // ==========================================
    // PRIORITY: Check if this is a file/document message click
    // ==========================================
    console.log("[WA-Extension] Click detected on:", target);
    if (suppressNextFileClick) {
      suppressNextFileClick = false;
      return;
    }
    const fileInfo = isFileMessage(target);
    if (fileInfo) {
      console.log("[WA-Extension] File message click detected, handling...");
      handleFileClick(event, fileInfo);
      return;
    }

    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastClickTime;
    lastClickTime = currentTime;

    if (timeSinceLastClick < 280) {
      isTextSelection = false;
      mouseDownTime = 0;
      return;
    }

    if (isTextSelection) {
      isTextSelection = false;
      mouseDownTime = 0;
      return;
    }

    mouseDownTime = 0;

    const ignoredTags = [
      "INPUT",
      "TEXTAREA",
      "A",
      "BUTTON",
      "IMG",
      "VIDEO",
      "AUDIO",
      "SVG",
      "PATH",
    ];
    if (ignoredTags.includes(target.tagName)) {
      return;
    }

    if (target.closest("a, button, input, textarea, img, video, audio, svg")) {
      return;
    }

    if (
      target.closest(
        '[data-testid*="media"], [data-testid*="sticker"], [data-testid*="image"], [data-testid*="video"], [data-testid*="audio"]',
      )
    ) {
      return;
    }

    if (
      target.closest('[class*="media"], [class*="sticker"], [class*="image"]')
    ) {
      return;
    }

    const hasButtonRole = target.closest('[role="button"]');
    if (hasButtonRole) {
      return;
    }

    if (
      target.closest(
        '[data-testid*="system"], .system-message, [role="navigation"], header',
      )
    ) {
      return;
    }

    const messageText = target.closest(
      ".copyable-text, [data-pre-plain-text], .selectable-text, ._11JPr, ._ao3e",
    );
    if (!messageText) {
      return;
    }

    const isText =
      isActualTextElement(target) ||
      isActualTextElement(target.parentElement) ||
      isActualTextElement(messageText);

    if (!isText) {
      return;
    }

    const messageContainer = findMessageContainer(target);

    if (messageContainer) {
      window.getSelection()?.removeAllRanges();

      const success = triggerReactionButton(messageContainer);

      if (success) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
  }

  document.addEventListener("mousedown", handleMouseDown, {
    capture: true,
    passive: true,
  });
  document.addEventListener("mousemove", handleMouseMove, {
    capture: true,
    passive: true,
  });
  document.addEventListener("click", handleClick, {
    capture: true,
    passive: false,
  });
  document.addEventListener("contextmenu", handleRightClick, {
    capture: true,
    passive: false,
  });

  console.log("WhatsApp Click Reactions: Loaded successfully");
  console.log("File download management: Active");
})();
