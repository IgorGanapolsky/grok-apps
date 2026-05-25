import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets from Comet browser...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  
  // Find Play Console policy page (currently open)
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

      // Navigate to store settings
      const storeSettingsUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/store-settings";
      console.log(`Navigating to: ${storeSettingsUrl}`);
      await sendCommand("Page.navigate", { url: storeSettingsUrl });

      console.log("Waiting 8s for the Store Settings page to load...");
      await new Promise(resolve => setTimeout(resolve, 8000));

      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Current URL: ${urlResult.result.value}`);

      // Capture page text to see what is displayed
      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const pageText = textResult.result.value;

      console.log("\n--- Store Settings Page Content ---");
      const lines = pageText.split("\n");
      for (const line of lines) {
        const l = line.trim();
        if (l.length > 0 && (l.includes("Category") || l.includes("App") || l.includes("Finance") || l.includes("Edit") || l.includes("Save"))) {
          console.log(`  > ${l}`);
        }
      }
      console.log("-----------------------------------\n");

      // Take a screenshot of the main store settings page
      console.log("Capturing screenshot of Store Settings...");
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      const screenshotPath = "/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/store_settings_main.png";
      writeFileSync(screenshotPath, buffer);
      console.log(`Screenshot saved to ${screenshotPath}`);

      // Click the first "Edit" button for App Category
      console.log("Clicking the first Edit button (App Category)...");
      const clickEditResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const editButtons = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Edit'));
          if (editButtons.length > 0) {
            editButtons[0].click();
            return { clicked: true, count: editButtons.length };
          }
          return { clicked: false };
        })()`,
        returnByValue: true
      });
      console.log("Click Edit Result:", clickEditResult.result.value);

      console.log("Waiting 3s for the category dialog to open...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Take another screenshot showing the opened dialog
      console.log("Capturing screenshot of category dialog...");
      const screenshotResult2 = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer2 = Buffer.from(screenshotResult2.data, "base64");
      const screenshotPath2 = "/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/store_settings_category_dialog.png";
      writeFileSync(screenshotPath2, buffer2);
      console.log(`Dialog screenshot saved to ${screenshotPath2}`);

      // Open the category dropdown list to see how choices are formatted
      console.log("Clicking the category select dropdown...");
      const clickDropdownResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const dropdowns = Array.from(document.querySelectorAll('div, select, mat-select')).filter(el => 
            el.textContent.includes('Select a category') || 
            el.textContent.includes('Finance')
          );
          // Let's click the last dropdown
          if (dropdowns.length > 0) {
            const dropdown = dropdowns[dropdowns.length - 1];
            dropdown.click();
            return { clicked: true, tag: dropdown.tagName, text: dropdown.textContent.trim() };
          }
          return { clicked: false };
        })()`,
        returnByValue: true
      });
      console.log("Click Dropdown Result:", clickDropdownResult.result.value);

      console.log("Waiting 3s for options to render...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Capture page text again to list the options
      const textResult2 = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const detailedText = textResult2.result.value;

      console.log("\n--- Visible Options / Content with Dropdown Open ---");
      const lines2 = detailedText.split("\n");
      // Let's print out the last 50 lines which usually contain the overlay dropdown options
      const lastLines = lines2.slice(-50);
      for (const line of lastLines) {
        const l = line.trim();
        if (l.length > 0) {
          console.log(`  > ${l}`);
        }
      }
      console.log("----------------------------------------------------\n");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
      console.log("WebSocket connection closed.");
    }
  };
}

run().catch(console.error);
