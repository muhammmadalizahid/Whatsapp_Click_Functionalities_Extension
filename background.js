/**
 * Background Service Worker for WhatsApp File Download Management
 * Handles Chrome Downloads API operations that cannot be performed in content scripts
 */

const console = {
  log: () => {},
  warn: () => {},
  error: () => {}
};

// Store recent downloads for quick lookup (in-memory cache)
let recentDownloads = new Map();

/**
 * Check if a file with the given name has been downloaded
 * @param {string} fileName - Name of the file to search for
 * @returns {Promise<{downloaded: boolean, downloadItem: object|null}>}
 */
async function checkIfFileDownloaded(fileName) {
  console.log('[WA-BG] Checking if file downloaded:', fileName);
  try {
    // Search for downloads matching the filename
    const downloads = await chrome.downloads.search({
      filenameRegex: fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), // Escape regex chars
      limit: 10,
      orderBy: ['-startTime']
    });

    console.log('[WA-BG] Found downloads:', downloads.length);

    // Filter for exact filename match
    const matchingDownload = downloads.find(download => {
      const downloadFileName = download.filename.split('/').pop().split('\\').pop();
      console.log('[WA-BG] Comparing:', downloadFileName, 'vs', fileName);
      return downloadFileName === fileName;
    });

    if (matchingDownload && matchingDownload.exists) {
      console.log('[WA-BG] File found and exists:', matchingDownload);
      return {
        downloaded: true,
        downloadItem: matchingDownload
      };
    }

    console.log('[WA-BG] File not found in downloads');
    return {
      downloaded: false,
      downloadItem: null
    };
  } catch (error) {
    console.error('[WA-BG] Error checking downloads:', error);
    return {
      downloaded: false,
      downloadItem: null
    };
  }
}

/**
 * Download file with Save As dialog
 * @param {string} url - URL of the file to download (can be data URL)
 * @param {string} fileName - Suggested filename
 * @returns {Promise<{success: boolean}>}
 */
async function downloadWithSaveAs(url, fileName) {
  console.log('[WA-BG] downloadWithSaveAs called');
  console.log('[WA-BG] URL type:', url.substring(0, 20) + '...');
  console.log('[WA-BG] Filename:', fileName);
  
  try {
    if (!url || url === '') {
      throw new Error('Invalid URL');
    }

    console.log('[WA-BG] Attempting download with saveAs=true');
    const downloadId = await chrome.downloads.download({
      url: url,
      saveAs: true, // This triggers the Save As dialog
      filename: fileName || undefined,
      conflictAction: 'prompt' // Ask user if file exists
    });

    console.log('[WA-BG] Download started with ID:', downloadId);
    return { success: true, downloadId: downloadId };
  } catch (error) {
    console.error('[WA-BG] Error downloading with Save As:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Open a downloaded file
 * @param {number} downloadId - ID of the download to open
 * @returns {Promise<{success: boolean}>}
 */
async function openDownloadedFile(downloadId) {
  try {
    await chrome.downloads.open(downloadId);
    return { success: true };
  } catch (error) {
    console.error('Error opening file:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Show file in folder
 * @param {number} downloadId - ID of the download to show
 * @returns {Promise<{success: boolean}>}
 */
async function showFileInFolder(downloadId) {
  try {
    await chrome.downloads.show(downloadId);
    return { success: true };
  } catch (error) {
    console.error('Error showing file:', error);
    return { success: false, error: error.message };
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[WA-BG] Received message:', request);
  
  // Handle async operations
  (async () => {
    try {
      switch (request.action) {
        case 'checkIfDownloaded':
          console.log('[WA-BG] Action: checkIfDownloaded');
          const result = await checkIfFileDownloaded(request.fileName);
          console.log('[WA-BG] Sending response:', result);
          sendResponse(result);
          break;

        case 'downloadWithSaveAs':
          console.log('[WA-BG] Action: downloadWithSaveAs');
          const downloadResult = await downloadWithSaveAs(request.url, request.fileName);
          sendResponse(downloadResult);
          break;

        case 'openFile':
          console.log('[WA-BG] Action: openFile');
          const openResult = await openDownloadedFile(request.downloadId);
          sendResponse(openResult);
          break;

        case 'showInFolder':
          console.log('[WA-BG] Action: showInFolder');
          const showResult = await showFileInFolder(request.downloadId);
          sendResponse(showResult);
          break;

        default:
          console.log('[WA-BG] Unknown action:', request.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[WA-BG] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  // Return true to indicate we'll respond asynchronously
  return true;
});

// Listen for download events to update our cache
chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state && downloadDelta.state.current === 'complete') {
    chrome.downloads.search({ id: downloadDelta.id }, (results) => {
      if (results.length > 0) {
        const download = results[0];
        const fileName = download.filename.split('/').pop().split('\\').pop();
        recentDownloads.set(fileName, download);
        
        // Keep cache size manageable (max 100 items)
        if (recentDownloads.size > 100) {
          const firstKey = recentDownloads.keys().next().value;
          recentDownloads.delete(firstKey);
        }
      }
    });
  }
});

console.log('WhatsApp File Download Manager: Background service worker initialized');
