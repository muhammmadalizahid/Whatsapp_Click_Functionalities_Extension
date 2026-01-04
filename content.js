(function() {
  'use strict';

  if (window.__waDoubleClickReactionsLoaded) return;
  window.__waDoubleClickReactionsLoaded = true;

  let mouseDownX = 0;
  let mouseDownY = 0;
  let mouseDownTime = 0;
  let isTextSelection = false;
  let lastClickTime = 0;

  function findMessageContainer(element) {
    let current = element;
    let depth = 0;
    const maxDepth = 15;

    while (current && depth < maxDepth) {
      if (current.hasAttribute && (current.hasAttribute('data-id') || current.hasAttribute('data-msgid') || current.hasAttribute('data-message-id'))) {
        return current;
      }

      if (current.getAttribute) {
        const role = current.getAttribute('role');
        if (role === 'row' || role === 'group') {
          return current;
        }

        const testId = (current.getAttribute('data-testid') || '').toLowerCase();
        if (testId.includes('message') || testId.includes('msg')) {
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
    
    const allButtons = searchArea.querySelectorAll('button, span[role="button"], div[role="button"]');
    
    for (const button of allButtons) {
      const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
      const title = (button.getAttribute('title') || '').toLowerCase();
      
      if ((ariaLabel.includes('react') || 
           ariaLabel.includes('emoji') ||
           title.includes('react') ||
           title.includes('emoji')) && 
          !ariaLabel.includes('reply') && 
          !ariaLabel.includes('menu') &&
          !ariaLabel.includes('more') &&
          !ariaLabel.includes('forward')) {
        
        const rect = button.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          button.click();
          return true;
        }
      }
    }

    const parentArea = messageContainer.parentElement;
    if (parentArea) {
      const parentButtons = parentArea.querySelectorAll('button, span[role="button"], div[role="button"]');
      
      for (const button of parentButtons) {
        const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
        const title = (button.getAttribute('title') || '').toLowerCase();
        
        if ((ariaLabel.includes('react') || 
             ariaLabel.includes('emoji') ||
             title.includes('react') ||
             title.includes('emoji')) && 
            !ariaLabel.includes('reply') && 
            !ariaLabel.includes('menu') &&
            !ariaLabel.includes('more') &&
            !ariaLabel.includes('forward')) {
          
          const rect = button.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            button.click();
            return true;
          }
        }
      }
    }

    searchArea = parentArea || messageContainer;

    const testIdButtons = searchArea.querySelectorAll('[data-testid]');
    for (const elem of testIdButtons) {
      const testId = (elem.getAttribute('data-testid') || '').toLowerCase();
      if (testId.includes('react') || testId.includes('emoji')) {
        const clickable = elem.closest('button, span[role="button"], div[role="button"]') || elem;
        if (clickable) {
          clickable.click();
          return true;
        }
      }
    }

    for (const button of searchArea.querySelectorAll('button, span[role="button"], div[role="button"]')) {
      const text = button.textContent || '';
      const hasEmoji = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(text);
      
      if (hasEmoji || button.innerHTML.includes('emoji')) {
        const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
        if (!ariaLabel.includes('menu') && !ariaLabel.includes('sticker')) {
          button.click();
          return true;
        }
      }
    }

    const buttons = searchArea.querySelectorAll('button[aria-label]');
    for (const button of buttons) {
      const rect = button.getBoundingClientRect();
      const msgRect = messageContainer.getBoundingClientRect();
      
      if (rect.right <= msgRect.left + 100 && rect.width > 0) {
        const ariaLabel = button.getAttribute('aria-label') || '';
        if (ariaLabel && !ariaLabel.toLowerCase().includes('menu')) {
          button.click();
          return true;
        }
      }
    }

    return false;
  }

  function triggerMessageMenu(messageContainer) {
    if (!messageContainer) return false;

    const buttons = messageContainer.querySelectorAll('button[aria-label], span[role="button"][aria-label], div[role="button"][aria-label]');
    
    for (const button of buttons) {
      const ariaLabel = button.getAttribute('aria-label') || '';
      const lowerLabel = ariaLabel.toLowerCase();
      
      if (lowerLabel.includes('menu') || 
          lowerLabel.includes('more') ||
          lowerLabel.includes('options') ||
          lowerLabel.includes('message options')) {
        button.click();
        return true;
      }
    }

    const menuButton = messageContainer.querySelector('[data-testid*="menu"], [data-testid*="down"], [data-testid*="chevron"]');
    if (menuButton) {
      menuButton.click();
      return true;
    }

    const spanButtons = messageContainer.querySelectorAll('span[role="button"], div[role="button"]');
    for (const button of spanButtons) {
      if (button.querySelector('svg') && !button.getAttribute('aria-label')?.toLowerCase().includes('react')) {
        button.click();
        return true;
      }
    }

    const parent = messageContainer.parentElement;
    if (parent) {
      const nearbyButtons = parent.querySelectorAll('button[aria-label], span[role="button"][aria-label]');
      for (const button of nearbyButtons) {
        const ariaLabel = button.getAttribute('aria-label') || '';
        if (ariaLabel.toLowerCase().includes('menu') || ariaLabel.toLowerCase().includes('more')) {
          button.click();
          return true;
        }
      }
    }

    return false;
  }

  function handleRightClick(event) {
    const target = event.target;

    if (target.tagName === 'INPUT' && target.type !== 'button' && target.type !== 'submit') {
      return;
    }

    if (target.tagName === 'TEXTAREA') {
      return;
    }

    if (target.closest('textarea:not([data-testid*="media"])')) {
      return;
    }

    let messageContainer = findMessageContainer(target);

    if (!messageContainer) {
      messageContainer = target.closest('[data-id], [data-message-id], [data-msgid], [data-testid*="message"], [data-testid*="msg"], [role="row"], [role="group"]');
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
    
    if (element.tagName === 'SPAN' || element.tagName === 'DIV') {
      const hasDirectText = Array.from(element.childNodes).some(node => 
        node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
      );
      
      if (hasDirectText) {
        return true;
      }
      
      const textContent = element.textContent.trim();
      if (textContent.length > 0) {
        const hasEmoji = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(textContent);
        if (hasEmoji) {
          return true;
        }
      }
      
      if (element.querySelector('img[alt], img[class*="emoji"]')) {
        return true;
      }
    }
    
    if (element.tagName === 'IMG' && (element.alt || element.className?.includes('emoji'))) {
      return true;
    }
    
    return false;
  }



  function handleClick(event) {
    const target = event.target;

    if (event.button !== 0) {
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

    const ignoredTags = ['INPUT', 'TEXTAREA', 'A', 'BUTTON', 'IMG', 'VIDEO', 'AUDIO', 'SVG', 'PATH'];
    if (ignoredTags.includes(target.tagName)) {
      return;
    }

    if (target.closest('a, button, input, textarea, img, video, audio, svg')) {
      return;
    }

    if (target.closest('[data-testid*="media"], [data-testid*="sticker"], [data-testid*="image"], [data-testid*="video"], [data-testid*="audio"]')) {
      return;
    }

    if (target.closest('[class*="media"], [class*="sticker"], [class*="image"]')) {
      return;
    }

    const hasButtonRole = target.closest('[role="button"]');
    if (hasButtonRole) {
      return;
    }

    if (target.closest('[data-testid*="system"], .system-message, [role="navigation"], header')) {
      return;
    }

    const messageText = target.closest('.copyable-text, [data-pre-plain-text], .selectable-text, ._11JPr, ._ao3e');
    if (!messageText) {
      return;
    }

    const isText = isActualTextElement(target) || 
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

  document.addEventListener('mousedown', handleMouseDown, true);
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('contextmenu', handleRightClick, true);

  console.log('WhatsApp Click Reactions: Loaded successfully');

})();
