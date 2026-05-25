import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets from Comet browser...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  
  // Find Play Console target
  const target = targets.find(t => t.url.includes("play.google.com/console"));
  if (!target) {
    console.error("ERROR: No active Play Console tab found.");
    process.exit(1);
  }

  console.log(`Connecting to target: "${target.title}"`);
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  const sendCommand = (method, params = {}) => {
    return new Promise((resolve, reject) => {
      const id = Math.floor(Math.random() * 1000000);
      const messageHandler = (event) => {
        const response = JSON.parse(event.data);
        if (response.id === id) {
          ws.removeEventListener("message", messageHandler);
          if (response.error) {
            reject(response.error);
          } else {
            resolve(response.result);
          }
        }
      };
      ws.addEventListener("message", messageHandler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  ws.onopen = async () => {
    try {
      await sendCommand("Page.enable");
      await sendCommand("Runtime.enable");

      console.log("Selecting 'Productivity' in the opened category dropdown...");
      
      const selectResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // Find the list item/option containing 'Productivity'
          const elements = Array.from(document.querySelectorAll('*'));
          const productivityOption = elements.find(el => 
            el.textContent.trim() === 'Productivity' && 
            (el.tagName.toLowerCase() === 'span' || el.tagName.toLowerCase() === 'div' || el.getAttribute('role') === 'option')
          );
          
          if (productivityOption) {
            productivityOption.click();
            return { selected: true, text: productivityOption.textContent.trim() };
          }
          
          // Let's try case-insensitive or partial match
          const option2 = elements.find(el => el.textContent.includes('Productivity'));
          if (option2) {
            option2.click();
            return { selected: true, text: option2.textContent.trim() };
          }
          
          return { selected: false };
        })()`,
        returnByValue: true
      });

      console.log("Select category result:", selectResult.result.value);

      console.log("Waiting 2s...");
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Capture screenshot to confirm Productivity is selected
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/store_settings_category_selected.png", buffer);
      console.log("Screenshot showing 'Productivity' selected saved.");

      // Click the Save button in the active App Category modal
      console.log("Saving the category settings...");
      const saveResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Save');
          if (saveBtn) {
            saveBtn.click();
            return { clicked: true };
          }
          return { clicked: false };
        })()`,
        returnByValue: true
      });
      console.log("Click Save Result:", saveResult.result.value);

      console.log("Waiting 8s for settings to save and apply...");
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Capture screenshot showing saved state
      const screenshotResult2 = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer2 = Buffer.from(screenshotResult2.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/store_settings_saved.png", buffer2);
      console.log("Screenshot showing store settings saved successfully.");

      // Navigate to Publishing overview
      const pubOverviewUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/publishing-overview";
      console.log(`Navigating to Publishing Overview: ${pubOverviewUrl}`);
      await sendCommand("Page.navigate", { url: pubOverviewUrl });

      console.log("Waiting 8s for Publishing Overview to load...");
      await new Promise(resolve => setTimeout(resolve, 8000));

      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Current URL: ${urlResult.result.value}`);

      // Capture content of Publishing Overview
      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      console.log("\n--- Publishing Overview Page Content ---");
      const lines = textResult.result.value.split("\n");
      for (const line of lines) {
        const l = line.trim();
        if (l.length > 0 && (l.includes("review") || l.includes("Review") || l.includes("changes") || l.includes("Changes") || l.includes("Send") || l.includes("send"))) {
          console.log(`  > ${l}`);
        }
      }
      console.log("----------------------------------------\n");

      // Capture screenshot of publishing overview
      const screenshotResult3 = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer3 = Buffer.from(screenshotResult3.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/publishing_overview_loaded.png", buffer3);
      console.log("Publishing Overview screenshot saved.");

      // Click the send for review button
      console.log("Clicking 'Send changes for review'...");
      const sendForReviewResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // Let's find button that contains 'Send' and 'review'
          const buttons = Array.from(document.querySelectorAll('button'));
          const sendBtn = buttons.find(b => b.textContent.includes('Send') && b.textContent.includes('review'));
          if (sendBtn) {
            sendBtn.click();
            return { clicked: true, text: sendBtn.textContent.trim() };
          }
          
          // Let's try matching any button with debug-id or class
          const sendBtn2 = document.querySelector('button[debug-id=\"main-button\"]');
          if (sendBtn2) {
            sendBtn2.click();
            return { clicked: true, method: 'debug-id' };
          }
          
          return { clicked: false };
        })()`,
        returnByValue: true
      });
      console.log("Click Send for Review Result:", sendForReviewResult.result.value);

      console.log("Waiting 4s for confirmation modal...");
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Click the Confirm/Send button in the confirmation modal if present
      console.log("Looking for and clicking confirm button inside modal...");
      const confirmResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // In Google Play Console, the confirmation dialog has a primary button with text 'Send changes for review' or 'Send'
          const buttons = Array.from(document.querySelectorAll('button'));
          const confirmBtn = buttons.find(b => 
            b.textContent.trim() === 'Send changes for review' && 
            b.parentElement?.parentElement?.className?.includes('modal') || 
            b.className?.includes('confirm') || 
            b.textContent.includes('Send') && buttons.indexOf(b) > 0
          );
          
          if (confirmBtn) {
            confirmBtn.click();
            return { clicked: true, text: confirmBtn.textContent.trim() };
          }
          
          // Fallback: Click the last button containing "review" or "Send"
          const lastBtn = buttons.filter(b => b.textContent.includes('review') || b.textContent.includes('Send')).pop();
          if (lastBtn) {
            lastBtn.click();
            return { clicked: true, fallback: true, text: lastBtn.textContent.trim() };
          }
          
          return { clicked: false };
        })()`,
        returnByValue: true
      });
      console.log("Click Confirm Result:", confirmResult.result.value);

      console.log("Waiting 6s for submission to finish...");
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Capture final screenshot to verify success
      const screenshotResult4 = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer4 = Buffer.from(screenshotResult4.data, "base64");
      const finalScreenshotPath = "/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/re_submission_success.png";
      writeFileSync(finalScreenshotPath, buffer4);
      console.log(`Final re-submission screenshot saved to ${finalScreenshotPath}`);

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
      console.log("WebSocket connection closed.");
    }
  };
}

run().catch(console.error);
