// sidepanel.js
// Main controller logic for the PageForge Side Panel UI.

let currentTabId = null;

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  updateActiveTabInfo();
  
  // Register tab listeners to update context when user switches tabs
  chrome.tabs.onActivated.addListener(updateActiveTabInfo);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      updateActiveTabInfo();
    }
  });

  // Action Button Click Handler
  document.getElementById("btn-extract").addEventListener("click", startExtraction);
});

// Update display with details of the active browser tab
async function updateActiveTabInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      currentTabId = tab.id;
      
      // Filter out system tabs (e.g. chrome://, chrome-extension://, edge://, about:blank)
      if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://") || tab.url.startsWith("about:")) {
        setUnsupportedState("Chrome System Page");
        return;
      }

      document.getElementById("page-title").textContent = tab.title || "Untitled Webpage";
      document.getElementById("page-url").textContent = tab.url;
      
      // Propose a clean name for the output ZIP file
      try {
        const urlObj = new URL(tab.url);
        let hostClean = urlObj.hostname
          .replace(/^www\./, '')
          .replace(/\.[a-z]{2,}/, '')
          .replace(/[^a-zA-Z0-9-_]/g, '_');
        document.getElementById("zip-filename").value = `${hostClean}_forge`;
      } catch (err) {
        document.getElementById("zip-filename").value = "page_forge";
      }
      
      document.getElementById("btn-extract").disabled = false;
      document.getElementById("btn-extract").querySelector(".btn-text").textContent = "Forge Code Package";
    } else {
      setUnsupportedState("No active tab detected");
    }
  } catch (err) {
    console.error("Error updating tab info:", err);
    setUnsupportedState("Error identifying active page");
  }
}

function setUnsupportedState(reason) {
  document.getElementById("page-title").textContent = "Unsupported Environment";
  document.getElementById("page-url").textContent = reason;
  document.getElementById("zip-filename").value = "";
  document.getElementById("btn-extract").disabled = true;
  document.getElementById("btn-extract").querySelector(".btn-text").textContent = "Extraction Unavailable";
}

// Log utility to post lines inside the terminal-like widget
function logToConsole(message, type = "info") {
  const consoleEl = document.getElementById("log-console");
  const line = document.createElement("div");
  line.className = `log-line ${type}`;
  
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  line.textContent = `[${timestamp}] ${message}`;
  
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

// Helper to update progress bar and stats text
function updateProgress(percent, labelText, detailsText = "") {
  const pBar = document.getElementById("progress-bar-fill");
  const pPercent = document.getElementById("progress-percent");
  const pCount = document.getElementById("progress-count");
  const pHeader = document.getElementById("progress-header");

  const cleanPercent = Math.min(100, Math.max(0, Math.round(percent)));
  pBar.style.width = `${cleanPercent}%`;
  pPercent.textContent = `${cleanPercent}%`;
  
  if (labelText) {
    pHeader.textContent = labelText;
  }
  if (detailsText) {
    pCount.textContent = detailsText;
  }
}

// Asynchronously fetch absolute resources bypassing CORS (thanks to extension permissions)
async function fetchAsset(url, responseType = "blob", retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, {
        method: "GET",
        mode: "cors",
        credentials: "omit"
      });
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      if (responseType === "text") {
        return await response.text();
      }
      return await response.blob();
    } catch (err) {
      if (i === retries) {
        throw err;
      }
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
    }
  }
}

// Helper to check for file obfuscation/minification patterns
function checkObfuscation(code, filename) {
  const stats = {
    filename: filename,
    isObfuscated: false,
    reasons: [],
    type: 'none' // 'obfuscated', 'minified', 'none'
  };
  
  if (!code) return stats;
  
  const codeLen = code.length;
  const lines = code.split('\n');
  const avgLineLength = codeLen / (lines.length || 1);
  const hasVeryLongLine = lines.some(l => l.length > 1000);
  
  // 1. Check for Javascript Obfuscator pattern (hex variable structures like _0x5a1e)
  const hexVarCount = (code.match(/\b_0x[a-f0-9]{4,6}\b/g) || []).length;
  const hexVarRatio = hexVarCount / (codeLen / 1000 || 1); // count per 1KB
  
  // 2. Check for base64/hex character arrays commonly used in encryption tables
  const hasBase64Table = code.includes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
  
  // 3. Check for high density of single or double character variables (short minification names)
  const shortVarsCount = (code.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]{0,1}\b/g) || []).length;
  const shortVarsRatio = shortVarsCount / (codeLen / 1000 || 1);

  if (hexVarCount > 15 || hexVarRatio > 3) {
    stats.isObfuscated = true;
    stats.type = 'obfuscated';
    stats.reasons.push("High density of hex-encoded variable/function identifiers (e.g., '_0x4fa2') indicating automated obfuscation.");
  } else if (hasVeryLongLine || avgLineLength > 300) {
    stats.isObfuscated = true;
    stats.type = 'minified';
    stats.reasons.push("Extremely compressed layouts (lines exceeding 1,000 characters) indicating minification.");
  } else if (shortVarsRatio > 50 && codeLen > 5000) {
    stats.isObfuscated = true;
    stats.type = 'minified';
    stats.reasons.push("High frequency of abbreviated identifiers (1-2 characters) indicating production code squeezing.");
  }
  
  if (hasBase64Table && stats.isObfuscated) {
    stats.reasons.push("Detected common Base64/Hex conversion lookup dictionaries suggesting string array encryptors.");
  }
  
  return stats;
}

// Start extraction pipeline
async function startExtraction() {
  const btn = document.getElementById("btn-extract");
  const progressCard = document.getElementById("progress-card");
  
  btn.disabled = true;
  btn.querySelector(".btn-text").textContent = "Forging...";
  
  // Show progress block
  progressCard.classList.remove("hidden");
  document.getElementById("progress-header").textContent = "Analyzing Webpage...";
  document.getElementById("progress-header").classList.remove("success-header");
  document.getElementById("log-console").innerHTML = ""; // Clear console
  updateProgress(0, "Analyzing Webpage...", "0 / 0 assets");

  logToConsole("Initializing PageForge analyzer...", "info");
  
  const options = {
    includeCss: document.getElementById("inc-css").checked,
    includeScripts: document.getElementById("inc-js").checked,
    includeImages: document.getElementById("inc-img").checked,
    cleanHtml: document.getElementById("opt-clean").checked,
    generateGuide: document.getElementById("opt-guide").checked
  };
  
  let zipName = document.getElementById("zip-filename").value.trim();
  if (!zipName) zipName = "page_forge";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error("No active browser window or tab detected.");
    }

    logToConsole(`Target active tab: ${tab.id} - ${tab.url}`, "info");

    // Dynamic Injection of Content Script (handles edge cases where extension was reloaded or target opened before installation)
    logToConsole("Injecting analyzer script into page environment...", "info");
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      logToConsole("Script injection verified.", "success");
    } catch (injectErr) {
      logToConsole("Analyzer injection notes: Continuing parsing sequence...", "warning");
    }

    // Ping content script to run analysis
    logToConsole("Requesting DOM traversal and asset references mapping...", "info");
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: "analyze_page", options }, (res) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Failed to communicate with page: ${chrome.runtime.lastError.message}. Try reloading the target page.`));
        } else if (res && !res.success) {
          reject(new Error(res.error || "Unknown analysis error inside content script."));
        } else {
          resolve(res ? res.data : null);
        }
      });
    });

    if (!response) {
      throw new Error("Page analyzer returned an empty payload.");
    }

    logToConsole("DOM analysis completed successfully.", "success");
    logToConsole(`Identified stylesheets: ${response.resources.css.length}`, "info");
    logToConsole(`Identified scripts: ${response.resources.js.length}`, "info");
    logToConsole(`Identified assets: ${response.resources.img.length}`, "info");

    // Start compiling resources
    const zip = new JSZip();
    const obfuscationReport = [];
    const sourceMapInfo = [];
    
    // Add primary HTML (beautified)
    let formattedHtml = response.html;
    try {
      if (typeof html_beautify !== "undefined") {
        formattedHtml = html_beautify(response.html, { indent_size: 2, wrap_line_length: 0 });
        logToConsole("Main index.html beauty formatted.", "success");
      }
    } catch(e) {
      console.warn("HTML beautification failed:", e);
    }
    zip.file("index.html", formattedHtml);

    // Flatten all resources we want to fetch into a single list
    const assetsQueue = [];
    
    // Add css assets
    if (options.includeCss) {
      response.resources.css.forEach(res => {
        assetsQueue.push({ ...res, type: 'css' });
      });
    }
    
    // Add js assets
    if (options.includeScripts) {
      response.resources.js.forEach(res => {
        assetsQueue.push({ ...res, type: 'js' });
      });
    }
    
    // Add image assets
    if (options.includeImages) {
      response.resources.img.forEach(res => {
        assetsQueue.push({ ...res, type: 'img' });
      });
    }

    const totalAssets = assetsQueue.length;
    let completedCount = 0;
    
    logToConsole(`Starting fetch pipeline for ${totalAssets} linked resources...`, "info");

    // Process all resources sequentially to maintain interactive logger and prevent connection flooding
    for (const asset of assetsQueue) {
      const displayUrl = asset.originalUrl ? asset.originalUrl.substring(0, 60) + (asset.originalUrl.length > 60 ? "..." : "") : "Generated Asset";
      logToConsole(`Fetching [${asset.type.toUpperCase()}]: ${displayUrl}`, "info");

      try {
        if (!asset.originalUrl) {
          // Dynamic content like serialized CSS rules generated by JS libraries
          if (asset.content) {
            let cleanCss = asset.content;
            try {
              if (typeof css_beautify !== "undefined") {
                cleanCss = css_beautify(cleanCss, { indent_size: 2 });
              }
            } catch(e) {}
            zip.file(asset.localPath, cleanCss);
            logToConsole(`Generated dynamic style added: ${asset.localPath}`, "success");
          }
        } else {
          // Remote resources
          if (asset.type === 'css') {
            // Fetch text
            let cssText = await fetchAsset(asset.originalUrl, "text");
            
            // Check for Source Maps
            try {
              const mapUrl = asset.originalUrl + ".map";
              const mapText = await fetchAsset(mapUrl, "text", 1);
              const mapJson = JSON.parse(mapText);
              
              logToConsole(`Source map found for stylesheet ${asset.localPath}!`, "success");
              zip.file(asset.localPath + ".map", mapText);
              
              // If source map embeds original files, extract them
              if (mapJson.sources && mapJson.sourcesContent) {
                logToConsole(`Extracting original CSS source files...`, "info");
                for (let i = 0; i < mapJson.sources.length; i++) {
                  let srcName = mapJson.sources[i];
                  let srcContent = mapJson.sourcesContent[i];
                  if (srcName && srcContent) {
                    // Sanitize path for ZIP storage
                    let cleanSrcName = srcName.replace(/^webpack:\/\/\/?/, '').replace(/^\.\//, '');
                    cleanSrcName = cleanSrcName.replace(/[^a-zA-Z0-9-_./]/g, '_');
                    zip.file(`src/${cleanSrcName}`, srcContent);
                  }
                }
              }
            } catch (e) {
              // Ignore source map fetch failures
            }
            
            // Rewrite nested CSS assets (fonts, background images)
            const bgUrlRegex = /url\(['"]?([^'")\s]+)['"]?\)/gi;
            let match;
            const nestedUrls = [];
            while ((match = bgUrlRegex.exec(cssText)) !== null) {
              const nestedRawUrl = match[1];
              if (!nestedRawUrl.startsWith("data:") && !nestedRawUrl.startsWith("http:") && !nestedRawUrl.startsWith("https:") && !nestedRawUrl.startsWith("//")) {
                try {
                  const absoluteUrl = new URL(nestedRawUrl, asset.originalUrl).href;
                  nestedUrls.push({ raw: nestedRawUrl, abs: absoluteUrl });
                } catch(e) {}
              } else if (nestedRawUrl.startsWith("http") || nestedRawUrl.startsWith("//")) {
                nestedUrls.push({ raw: nestedRawUrl, abs: nestedRawUrl.startsWith("//") ? `https:${nestedRawUrl}` : nestedRawUrl });
              }
            }

            // Download nested assets and rewrite the css references
            for (const nested of nestedUrls) {
              try {
                logToConsole(`Fetching nested CSS asset: ${nested.abs.substring(0, 45)}...`, "info");
                const nestedBlob = await fetchAsset(nested.abs, "blob");
                
                const pathname = new URL(nested.abs).pathname;
                let cleanFilename = pathname.substring(pathname.lastIndexOf('/') + 1) || `nested_asset_${Date.now()}`;
                cleanFilename = cleanFilename.replace(/[?#].*$/, '').replace(/[^a-zA-Z0-9-_.]/g, '_');
                
                const localAssetPath = `assets/nested_${cleanFilename}`;
                zip.file(localAssetPath, nestedBlob);
                
                const escapedRawUrl = nested.raw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const replaceRegex = new RegExp(`url\\(['"]?${escapedRawUrl}['"]?\\)`, 'g');
                cssText = cssText.replace(replaceRegex, `url('../${localAssetPath}')`);
                logToConsole(`Nested asset saved: ${localAssetPath}`, "success");
              } catch(nestedErr) {
                logToConsole(`Failed to fetch nested asset ${nested.abs}: ${nestedErr.message}`, "warning");
              }
            }

            // Format CSS code
            try {
              if (typeof css_beautify !== "undefined") {
                cssText = css_beautify(cssText, { indent_size: 2 });
              }
            } catch(e) {}

            zip.file(asset.localPath, cssText);
            logToConsole(`Styles saved: ${asset.localPath}`, "success");
          } else if (asset.type === 'js') {
            // Fetch JS text
            let jsText = await fetchAsset(asset.originalUrl, "text");
            
            // Check for Source Maps
            let hasMap = false;
            let extractedSources = [];
            try {
              const mapUrl = asset.originalUrl + ".map";
              const mapText = await fetchAsset(mapUrl, "text", 1);
              const mapJson = JSON.parse(mapText);
              
              logToConsole(`Source map found for script ${asset.localPath}!`, "success");
              zip.file(asset.localPath + ".map", mapText);
              hasMap = true;
              
              if (mapJson.sources && mapJson.sourcesContent) {
                logToConsole(`Extracting original JS source files...`, "info");
                for (let i = 0; i < mapJson.sources.length; i++) {
                  let srcName = mapJson.sources[i];
                  let srcContent = mapJson.sourcesContent[i];
                  if (srcName && srcContent) {
                    let cleanSrcName = srcName.replace(/^webpack:\/\/\/?/, '').replace(/^\.\//, '');
                    cleanSrcName = cleanSrcName.replace(/[^a-zA-Z0-9-_./]/g, '_');
                    zip.file(`src/${cleanSrcName}`, srcContent);
                    extractedSources.push(cleanSrcName);
                  }
                }
                logToConsole(`Reconstructed ${extractedSources.length} files under src/ directory.`, "success");
              }
            } catch (e) {
              // Ignore map failures
            }
            
            sourceMapInfo.push({
              filename: asset.localPath,
              hasMap: hasMap,
              extractedCount: extractedSources.length
            });

            // Perform Obfuscation/Minification Check
            const obResult = checkObfuscation(jsText, asset.localPath);
            obResult.hasSourceMap = hasMap;
            obResult.extractedSources = extractedSources;
            obfuscationReport.push(obResult);
            
            if (obResult.isObfuscated) {
              const severity = obResult.type === 'obfuscated' ? "obfuscation" : "minification";
              logToConsole(`[Warning] Identified ${severity} patterns in ${asset.localPath}!`, "warning");
              obResult.reasons.forEach(r => logToConsole(`  -> Reason: ${r}`, "warning"));
            }

            // Format JS code
            try {
              if (typeof js_beautify !== "undefined") {
                jsText = js_beautify(jsText, { indent_size: 2 });
              }
            } catch(e) {}

            zip.file(asset.localPath, jsText);
            logToConsole(`Asset script saved: ${asset.localPath}`, "success");
          } else {
            // Standard static file (Images, Fonts, etc.)
            const blob = await fetchAsset(asset.originalUrl, "blob");
            zip.file(asset.localPath, blob);
            logToConsole(`Asset saved: ${asset.localPath}`, "success");
          }
        }
      } catch (assetErr) {
        logToConsole(`Failed to retrieve ${asset.originalUrl}: ${assetErr.message}`, "error");
        zip.file(asset.localPath, `/* PageForge download failure for resource: ${asset.originalUrl} \nError: ${assetErr.message} */`);
      }

      completedCount++;
      const downloadProgress = (completedCount / totalAssets) * 90;
      updateProgress(downloadProgress, "Downloading resources...", `${completedCount} / ${totalAssets} assets`);
    }

    // 9. Generate AI Agent Instruction Guide if selected
    if (options.generateGuide) {
      logToConsole("Assembling AI Developer Guide (ai_instructions.md)...", "info");
      const guideMd = buildGuideMarkdown(response.metadata, response.resources, obfuscationReport, sourceMapInfo);
      zip.file("ai_instructions.md", guideMd);
      logToConsole("AI Guide integrated.", "success");
    }

    // 10. Compile ZIP File
    logToConsole("Compressing and packaging files into ZIP archive...", "info");
    updateProgress(90, "Assembling ZIP package...", "Compiling...");
    
    const zipBlob = await zip.generateAsync({ type: "blob" }, (metadata) => {
      const totalProgress = 90 + (metadata.percent / 10);
      updateProgress(totalProgress, "Finalizing package...", `Compressing: ${Math.round(metadata.percent)}%`);
    });

    logToConsole("Compression completed successfully. Triggering download...", "success");

    // Request file download using standard <a> link click method to bypass Chrome extension Blob filename bugs
    const blobUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${zipName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup resources
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 10000);

    updateProgress(100, "Package Forged Successfully!", "Completed!");
    logToConsole(`ZIP Package "${zipName}.zip" ready! Check downloads folder.`, "success");
    
    document.getElementById("progress-header").classList.add("success-header");
    
  } catch (err) {
    logToConsole(`Error in extraction pipeline: ${err.message}`, "error");
    updateProgress(0, "Extraction Failed", "Error encountered");
    console.error("Pipeline failure:", err);
  } finally {
    btn.disabled = false;
    btn.querySelector(".btn-text").textContent = "Forge Code Package";
  }
}

// Build the AI instruction markdown guide with Obfuscation analysis details
function buildGuideMarkdown(metadata, resources, obfuscationReport, sourceMapInfo) {
  const timestamp = new Date().toLocaleString();
  const layoutDesc = metadata.layoutSummary;
  
  let colorPalette = "";
  if (metadata.colors && metadata.colors.length > 0) {
    colorPalette = "### Detected Styling Custom Properties (Colors/Themes)\n";
    metadata.colors.forEach(v => {
      colorPalette += `- \`${v.name}\`: \`${v.value}\`\n`;
    });
  }

  // Format resources structure
  let fileList = "- `index.html` (Primary webpage markup - auto-beautified)\n";
  if (resources.css.length > 0) {
    fileList += "- `css/` (Stylesheets)\n";
    resources.css.forEach(r => {
      const filename = r.localPath.split('/').pop();
      fileList += `  - \`${filename}\` (${r.originalUrl ? "Original: " + r.originalUrl : "Dynamic stylesheet compiled at runtime"})\n`;
    });
  }
  if (resources.js.length > 0) {
    fileList += "- `js/` (Scripts)\n";
    resources.js.forEach(r => {
      const filename = r.localPath.split('/').pop();
      fileList += `  - \`${filename}\`\n`;
    });
  }
  
  // Display src directory (Source Map extraction)
  const totalExtracted = sourceMapInfo.reduce((sum, item) => sum + item.extractedCount, 0);
  if (totalExtracted > 0) {
    fileList += `- \`src/\` (**🟢 RECONSTRUCTED SOURCE FILES FROM SOURCE MAPS** - contains ${totalExtracted} original files)\n`;
  }
  
  if (resources.img.length > 0) {
    fileList += "- `assets/` (Images, icons, vectors, backgrounds)\n";
    resources.img.slice(0, 15).forEach(r => {
      const filename = r.localPath.split('/').pop();
      fileList += `  - \`${filename}\`\n`;
    });
    if (resources.img.length > 15) {
      fileList += `  - ... and ${resources.img.length - 15} more assets.\n`;
    }
  }

  // 11. Code Obfuscation & Deobfuscation Analysis
  let deobfuscationSection = "## 🔍 Code Readability & Deobfuscation Report\n\n";
  let hasObfuscatedFiles = false;

  obfuscationReport.forEach(item => {
    const statusIcon = item.isObfuscated ? (item.hasSourceMap ? "🟡" : "🔴") : "🟢";
    const typeLabel = item.type === 'obfuscated' ? "Heavily Obfuscated" : item.type === 'minified' ? "Minified / Compressed" : "Clean / Readable";
    const mapLabel = item.hasSourceMap ? `(Source Maps Found - Extracted ${item.extractedSources.length} files to \`src/\`)` : "(No Source Maps Found)";

    deobfuscationSection += `### ${statusIcon} \`${item.filename}\` — **${typeLabel}** ${mapLabel}\n`;
    if (item.isObfuscated) {
      hasObfuscatedFiles = true;
      deobfuscationSection += `*   **Observations**:\n`;
      item.reasons.forEach(r => {
        deobfuscationSection += `    *   ${r}\n`;
      });
      
      if (!item.hasSourceMap) {
        deobfuscationSection += `*   **⚠️ Reversal Strategy & Instruction for AI Agent**:\n`;
        deobfuscationSection += `    *   *AI Deobfuscation Prompt*: Copy and paste the prompt in the "Deobfuscation Prompt" block below to instruct an LLM to decode this specific file.\n`;
        deobfuscationSection += `    *   *Critical Targets*: Focus analysis on element query selectors (e.g. \`document.querySelector\`) and network request endpoints (e.g. \`fetch\`, \`axios\`, \`XHR\`) inside this file. Ignore large utility runtimes (like React, Webpack boilerplate) to save token windows.\n`;
        deobfuscationSection += `    *   *Command Line AST Tools*: If you have bash access, you can run:\n`;
        if (item.type === 'obfuscated') {
          deobfuscationSection += `        \`\`\`bash\n        npx synchrony deobfuscate js/${item.filename.split('/').pop()} -o js/deobfuscated_${item.filename.split('/').pop()}\n        \`\`\`\n`;
        } else {
          deobfuscationSection += `        \`\`\`bash\n        npx webcrack js/${item.filename.split('/').pop()} -o js/unpacked_${item.filename.split('/').pop()}\n        \`\`\`\n`;
        }
      }
      deobfuscationSection += `\n`;
    }
  });

  if (!hasObfuscatedFiles) {
    deobfuscationSection += "🟢 **All JavaScript files are clean, readable, or have been successfully reconstructed via source maps. No heavy obfuscation detected!**\n\n";
  }

  // Obfuscation specific prompt generator
  let deobfuscationSystemPrompt = "";
  if (hasObfuscatedFiles) {
    const obfuscatedFilesList = obfuscationReport
      .filter(i => i.isObfuscated && !i.hasSourceMap)
      .map(i => `\`${i.filename}\` (${i.type === 'obfuscated' ? 'Obfuscated' : 'Minified'})`)
      .join(', ');

    deobfuscationSystemPrompt = `
### 🛠️ Specialized AI Deobfuscation Instruction Prompt

*If you are using an AI Agent (like Cursor, Windsurf, or Claude) for secondary development, copy this custom prompt to initiate deobfuscation on the compressed scripts:*

\`\`\`text
You are an expert reverse engineer and javascript refactoring assistant.
The workspace contains obfuscated/minified files without Source Maps: ${obfuscatedFilesList}

I need you to deobfuscate these files so they are readable for our secondary creation. Do NOT rewrite the libraries (like jQuery, React, or Webpack core modules). Instead, follow these steps:
1. Identify the custom business logic functions (like DOM listeners, click handlers, ajax/fetch requests, page states).
2. Clean up the identifiers: Rename single-letter variable names (a, b, c, etc.) and hex arrays (_0x4f1e, _0x30da) to descriptive English names based on their usage (e.g., 'usernameInput', 'handleFormSubmit', 'apiEndpoint').
3. Remove dead code, anti-debugging wrappers, or self-defending locks injected by obfuscation tools.
4. Replace obfuscated string lookup tables with clean, inline string literals.
5. Save the output as a clean, readable equivalent file (e.g. 'js/deobfuscated_app.js') and link it in 'index.html'.

Let me know once you have analyzed the files and are ready to refactor.
\`\`\`
`;
  }

  return `# AI Developer Package Instructions

This package contains the fully extracted, clean frontend code template for the webpage: **"${metadata.title}"**.

- **Original Source URL**: [${metadata.url}](${metadata.url})
- **Extracted Timestamp**: ${timestamp}
- **Layout Outline**: ${layoutDesc}

---

## Package File Structure

\`\`\`
.
${fileList.replace(/- /g, '├── ').replace(/  ├── /g, '│   ├── ')}
├── ai_instructions.md  (This guide)
\`\`\`

---

${colorPalette}

---

${deobfuscationSection}

${deobfuscationSystemPrompt}

---

## Suggested System Prompt for Secondary Creation

You can copy and paste the prompt below into an LLM or AI Agent along with this codebase to start building on top of this template:

\`\`\`text
You are an expert Frontend Developer and UX Designer.
I have extracted the static frontend codebase of a webpage from "${metadata.url}". The codebase files are loaded in your context workspace:
- "index.html" is the layout (using relative paths for local resources).
- "css/" contains the stylesheets.
- "js/" contains the scripts.
- "assets/" contains all logos, images, vectors, and graphic assets.
${totalExtracted > 0 ? '- "src/" contains the reconstructed original TypeScript/ES6 component source files extracted via source maps.' : ''}

The layout architecture includes: ${layoutDesc}

Your task is to perform secondary creation on this template. Specifically, I want you to:
1. Analyze the visual grid, spacing, and styling design tokens.
2. Maintain the design aesthetic (color palette, dark/light theme, modern typography, glassmorphism card shapes, animations) but change the theme/topic of the page to: [INSERT YOUR NEW TOPIC/PROJECT IDEA HERE].
3. Replace the text, placeholders, navigation list items, and copy with appropriate premium content for the new topic.
4. Integrate any additional components requested (e.g. detailed charts, data tables, modern cards, feature grids) ensuring they match the parent design language perfectly.
5. Provide clean, production-ready code.

Let me know once you have scanned the files and are ready to start.
\`\`\`
`;
}
