import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets from Comet browser...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  
  // Find Play Console policy target (since we are on policy-center / policy-status page now)
  const target = targets.find(t => t.url.includes("play.google.com/console") && (t.url.includes("policy-center") || t.url.includes("policy-status")));
  if (!target) {
    console.error("ERROR: Not currently on the Policy page. Current tabs:");
    for (const t of targets) {
      console.log(`- Title: "${t.title}" | URL: ${t.url}`);
    }
    process.exit(1);
  }

  console.log(`Connecting to target: "${target.title}"`);
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  // Helper to send CDP command
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
      console.log("WebSocket opened. Enabling domains...");
      await sendCommand("Page.enable");
      await sendCommand("Runtime.enable");

      console.log("Inspecting the page for interactive policy status rows...");
      
      // Let's run a script that finds any element with 'Play Console Requirements' and clicks it, or clicks the arrow_right_alt sibling
      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // Let's print all text in headings or divs first to see if we can find clickable rows
          const clickables = [];
          
          // Try finding by text "Play Console Requirements" or similar
          const elements = Array.from(document.querySelectorAll('*'));
          const targetEl = elements.find(el => 
            el.textContent.includes('Play Console Requirements') && 
            el.children.length === 0
          );
          
          if (targetEl) {
            // Find its ancestor that might be clickable (like a button, row, list item, or has role="button")
            let ancestor = targetEl;
            while (ancestor && ancestor !== document.body) {
              const role = ancestor.getAttribute('role');
              const tagName = ancestor.tagName.toLowerCase();
              if (role === 'button' || role === 'link' || tagName === 'button' || tagName === 'tr' || ancestor.onclick || ancestor.className.includes('clickable') || ancestor.className.includes('row')) {
                ancestor.click();
                return { clicked: true, method: 'Ancestor element clicked', tag: ancestor.tagName, text: targetEl.textContent };
              }
              ancestor = ancestor.parentElement;
            }
            // If no clear ancestor, just click the element or its parent
            targetEl.click();
            return { clicked: true, method: 'Direct target clicked', text: targetEl.textContent };
          }
          
          // Alternatively find by icon text 'arrow_right_alt'
          const icons = Array.from(document.querySelectorAll('*')).filter(el => el.textContent.trim() === 'arrow_right_alt');
          if (icons.length > 0) {
            icons[0].click();
            return { clicked: true, method: 'Arrow icon clicked' };
          }
          
          return { clicked: false };
        })()`,
        returnByValue: true
      });

      console.log("Click action result:", clickResult.result.value);

      console.log("Waiting 6s for transition or navigation...");
      await new Promise(resolve => setTimeout(resolve, 6000));

      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Current URL: ${urlResult.result.value}`);

      // Capture new page text
      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const detailedText = textResult.result.value;

      console.log("\n--- Live Detailed Policy Status Content ---");
      const lines = detailedText.split("\n");
      // Let's print all lines from this detail page
      for (let i = 0; i < Math.min(lines.length, 100); i++) {
        const line = lines[i].trim();
        if (line.length > 0) {
          console.log(`  > ${line}`);
        }
      }
      console.log("-------------------------------------------\n");

      // Save detailed text
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/policy_details_text.txt", detailedText);

      // Take a screenshot
      console.log("Capturing screenshot of details...");
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      const screenshotPath = "/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/policy_details_screenshot.png";
      writeFileSync(screenshotPath, buffer);
      console.log(`Screenshot saved to ${screenshotPath}`);

    } catch (err) {
      console.error("Error during execution:", err);
    } finally {
      ws.close();
      console.log("WebSocket connection closed.");
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };
}

run().catch(console.error);
