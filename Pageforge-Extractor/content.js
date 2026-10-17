// content.js
// Injected into the webpage to analyze DOM and prepare files for extraction.

// Resolve relative URLs to absolute URLs using the document's baseURI
function resolveUrl(url) {
  if (!url) return "";
  try {
    return new URL(url, document.baseURI).href;
  } catch (e) {
    return url;
  }
}

// Generate a clean, unique local filename for a resource
let fileCounter = 0;
function getLocalFilename(url, type) {
  let urlObj;
  try {
    urlObj = new URL(url);
  } catch (e) {
    return `${type}_file_${++fileCounter}`;
  }
  
  let pathname = urlObj.pathname;
  let filename = pathname.substring(pathname.lastIndexOf('/') + 1);
  if (!filename) {
    filename = `file_${++fileCounter}`;
  }
  
  // Strip query strings or hashes (already handled by URL parsing mostly but let's be safe)
  filename = filename.replace(/[?#].*$/, '');
  
  let extIdx = filename.lastIndexOf('.');
  let base = filename;
  let ext = "";
  
  if (extIdx !== -1) {
    base = filename.substring(0, extIdx);
    ext = filename.substring(extIdx);
  }
  
  // Standardize common fallbacks for extensions
  if (!ext || ext.length > 5 || ext.includes('/') || extIdx === -1) {
    base = filename;
    if (type === 'css') ext = '.css';
    else if (type === 'js') ext = '.js';
    else if (type === 'img') ext = '.png';
    else ext = '';
  }
  
  // Clean base name to be alphanumeric + dashes/underscores
  base = base.replace(/[^a-zA-Z0-9-_]/g, '_');
  if (base.length > 30) {
    base = base.substring(0, 30);
  }
  
  return `${base}_${++fileCounter}${ext}`;
}

// Extract background image URLs from inline styles
function extractInlineBackgroundUrls(element) {
  const urls = [];
  const style = element.getAttribute("style");
  if (style) {
    const bgUrlRegex = /url\(['"]?([^'")]+)['"]?\)/gi;
    let match;
    while ((match = bgUrlRegex.exec(style)) !== null) {
      urls.push(resolveUrl(match[1]));
    }
  }
  return urls;
}

// Extract background URLs from active styles in stylesheets
function extractStylesheetBackgroundUrls(cssText) {
  const urls = [];
  const bgUrlRegex = /url\(['"]?([^'")\s]+)['"]?\)/gi;
  let match;
  while ((match = bgUrlRegex.exec(cssText)) !== null) {
    // Exclude inline data URIs
    if (!match[1].startsWith("data:")) {
      urls.push(resolveUrl(match[1]));
    }
  }
  return urls;
}

// Main page analysis function
function analyzePage(options) {
  fileCounter = 0;
  const resourceMap = {
    css: [], // { originalUrl, localPath }
    js: [],
    img: [],
    inlineCssAssets: [] // CSS backgrounds, fonts inside stylesheets
  };

  // We clone the document structure so we don't mess up the live web page
  const docClone = document.cloneNode(true);
  const head = docClone.head || docClone.getElementsByTagName("head")[0];
  const body = docClone.body || docClone.getElementsByTagName("body")[0];

  // 1. Serialize Constructed and Dynamic Stylesheets (CSSOM)
  // Many modern web apps (React, Vue, Tailwind, styled-components) inject styles via CSSOM.
  // We extract all rules from active stylesheets that are either inline, dynamic, or otherwise.
  let dynamicStylesText = "";
  try {
    for (const sheet of document.styleSheets) {
      try {
        // Only gather if we can read the rules (CORS might block external stylesheets, we'll fetch them separately)
        if (sheet.cssRules) {
          const rules = Array.from(sheet.cssRules);
          const rulesText = rules.map(rule => rule.cssText).join("\n");
          
          // Check if this sheet is dynamic (no href, or ownerNode is empty/dynamic)
          const isDynamic = !sheet.href || sheet.ownerNode?.tagName === "STYLE" && !sheet.ownerNode.innerHTML;
          if (isDynamic) {
            dynamicStylesText += `/* Dynamic Stylesheet */\n${rulesText}\n\n`;
          }
        }
      } catch (err) {
        // CORS blocked reading rules directly. Background fetch will handle this.
        console.warn("Unable to read stylesheet rules directly (CORS):", sheet.href);
      }
    }
  } catch (err) {
    console.error("Error serializing dynamic styles:", err);
  }

  // 2. Perform AI Cleanup if selected
  if (options.cleanHtml) {
    // Selectors for analytics, tracking, ads, and third party widgets
    const bloatSelectors = [
      'script[src*="analytics"]',
      'script[src*="gtm.js"]',
      'script[src*="facebook.net"]',
      'script[src*="adservice"]',
      'script[src*="adsbygoogle"]',
      'iframe[src*="googleads"]',
      'iframe[src*="doubleclick"]',
      'iframe[src*="facebook.com/plugins"]',
      'noscript',
      '#google_ads_iframe',
      '.adsbygoogle',
      '.ad-banner'
    ];

    bloatSelectors.forEach(selector => {
      docClone.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Remove comments recursively
    const removeComments = (node) => {
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        if (child.nodeType === Node.COMMENT_NODE) {
          node.removeChild(child);
          i--;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          removeComments(child);
        }
      }
    };
    removeComments(docClone);
  }

  // Helper to register a resource and return its relative path
  function registerResource(url, type, folder) {
    const absUrl = resolveUrl(url);
    if (!absUrl || absUrl.startsWith("data:")) return null;

    // Filter to only capture standard web URLs (http/https), ignoring extension or chrome internal resources
    if (!absUrl.startsWith("http://") && !absUrl.startsWith("https://")) {
      return null;
    }

    // Check if we already registered this URL
    const list = resourceMap[type === 'img' ? 'img' : type];
    const existing = list.find(r => r.originalUrl === absUrl);
    if (existing) {
      return existing.localPath;
    }

    const localFilename = getLocalFilename(absUrl, type);
    const localPath = `${folder}/${localFilename}`;
    list.push({
      originalUrl: absUrl,
      localPath: localPath
    });
    return localPath;
  }

  // 3. Process Stylesheets
  // For `<link rel="stylesheet">` tags in clone
  docClone.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      const localPath = registerResource(href, 'css', 'css');
      if (localPath) {
        link.setAttribute('href', localPath);
      }
    }
  });

  // Extract backgrounds/assets from inline `<style>` tags
  docClone.querySelectorAll('style').forEach(style => {
    // If it's an empty style tag, it was likely injected into using CSSOM.
    // If we have dynamic styles text, we can populate it, or we'll just handle it globally.
    const text = style.innerHTML;
    if (text) {
      const urls = extractStylesheetBackgroundUrls(text);
      urls.forEach(url => {
        const localImgPath = registerResource(url, 'img', 'assets');
        if (localImgPath) {
          // Replace in style text
          const escapedUrl = url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(escapedUrl, 'g');
          style.innerHTML = style.innerHTML.replace(regex, `../${localImgPath}`);
        }
      });
    }
  });

  // 4. Process Scripts (if includeScripts is true)
  docClone.querySelectorAll('script[src]').forEach(script => {
    if (options.includeScripts) {
      const src = script.getAttribute('src');
      if (src) {
        const localPath = registerResource(src, 'js', 'js');
        if (localPath) {
          script.setAttribute('src', localPath);
        }
      }
    } else {
      // Remove external scripts if they aren't requested
      script.remove();
    }
  });

  // 5. Process Images & Media (if includeImages is true)
  docClone.querySelectorAll('img, input[type="image"]').forEach(img => {
    const src = img.getAttribute('src');
    if (src) {
      if (options.includeImages) {
        const localPath = registerResource(src, 'img', 'assets');
        if (localPath) {
          img.setAttribute('src', localPath);
        }
      } else {
        // Fallback to placeholder or clear src
        img.setAttribute('src', '');
      }
    }

    // Handle srcset attributes on images
    const srcset = img.getAttribute('srcset');
    if (srcset) {
      if (options.includeImages) {
        const parts = srcset.split(',').map(part => {
          const subparts = part.trim().split(/\s+/);
          if (subparts[0]) {
            const localPath = registerResource(subparts[0], 'img', 'assets');
            if (localPath) {
              subparts[0] = localPath;
            }
          }
          return subparts.join(' ');
        });
        img.setAttribute('srcset', parts.join(', '));
      } else {
        img.removeAttribute('srcset');
      }
    }
  });

  // Process picture source tags
  docClone.querySelectorAll('picture source').forEach(source => {
    const srcset = source.getAttribute('srcset');
    if (srcset) {
      if (options.includeImages) {
        const parts = srcset.split(',').map(part => {
          const subparts = part.trim().split(/\s+/);
          if (subparts[0]) {
            const localPath = registerResource(subparts[0], 'img', 'assets');
            if (localPath) {
              subparts[0] = localPath;
            }
          }
          return subparts.join(' ');
        });
        source.setAttribute('srcset', parts.join(', '));
      } else {
        source.removeAttribute('srcset');
      }
    }
  });

  // 6. Process inline element background images
  docClone.querySelectorAll('*').forEach(el => {
    const bgUrls = extractInlineBackgroundUrls(el);
    bgUrls.forEach(url => {
      if (options.includeImages) {
        const localPath = registerResource(url, 'img', 'assets');
        if (localPath) {
          // Update style attribute
          let style = el.getAttribute('style');
          const escapedUrl = url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(escapedUrl, 'g');
          style = style.replace(regex, localPath);
          el.setAttribute('style', style);
        }
      }
    });
  });

  // 7. Handle dynamic/constructed stylesheets.
  // If we collected any dynamic rules, save them into a new stylesheet.
  if (dynamicStylesText && head) {
    const dynamicStyleFilename = "dynamic_styles.css";
    const localPath = `css/${dynamicStyleFilename}`;
    
    // Extract background images from dynamic CSS
    const urls = extractStylesheetBackgroundUrls(dynamicStylesText);
    urls.forEach(url => {
      const localImgPath = registerResource(url, 'img', 'assets');
      if (localImgPath) {
        const escapedUrl = url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(escapedUrl, 'g');
        // Since stylesheet is in css/ directory, reference to assets/ must go up one folder: ../assets/
        dynamicStylesText = dynamicStylesText.replace(regex, `../${localImgPath}`);
      }
    });

    // Add reference map
    resourceMap.css.push({
      originalUrl: null, // Indicates generated inline styles
      content: dynamicStylesText,
      localPath: localPath
    });

    // Inject link tag into cloned document head
    const link = docClone.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", localPath);
    head.appendChild(link);
  }

  // 8. Generate page design/structure metadata for the AI agent instructions
  const metaInfo = {
    title: document.title,
    url: window.location.href,
    fonts: [],
    colors: [],
    layoutSummary: ""
  };

  // Extract layout tags
  const tags = ['header', 'nav', 'main', 'aside', 'footer', 'section', 'article'];
  const activeTags = tags.filter(tag => docClone.querySelector(tag) !== null);
  metaInfo.layoutSummary = `The page contains the following semantic layouts: ${activeTags.join(', ')}.`;

  // Get some CSS Custom Properties (variables) for styling clues
  const cssVars = [];
  try {
    const rootStyles = getComputedStyle(document.documentElement);
    // Find custom properties
    let rootRules = [];
    for (const sheet of document.styleSheets) {
      try {
        if (sheet.cssRules) {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText === ':root') {
              // Extract variable names
              const varRegex = /(--[a-zA-Z0-9-_]+)\s*:/g;
              let match;
              while ((match = varRegex.exec(rule.cssText)) !== null) {
                const varName = match[1];
                const value = rootStyles.getPropertyValue(varName).trim();
                if (value && cssVars.length < 30) { // Limit to 30 variables
                  cssVars.push({ name: varName, value });
                }
              }
            }
          }
        }
      } catch (e) {}
    }
  } catch (e) {}
  metaInfo.colors = cssVars.filter(v => v.name.includes('color') || v.name.includes('brand') || v.name.includes('theme'));

  // Get raw serialized HTML
  const doctype = document.doctype 
    ? new XMLSerializer().serializeToString(document.doctype) 
    : "<!DOCTYPE html>";
  const htmlContent = doctype + "\n" + docClone.documentElement.outerHTML;

  return {
    html: htmlContent,
    resources: resourceMap,
    metadata: metaInfo
  };
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyze_page") {
    try {
      const result = analyzePage(request.options);
      sendResponse({ success: true, data: result });
    } catch (error) {
      console.error("Extraction error inside content script:", error);
      sendResponse({ success: false, error: error.message });
    }
  }
  return true; // Keep channel open
});
