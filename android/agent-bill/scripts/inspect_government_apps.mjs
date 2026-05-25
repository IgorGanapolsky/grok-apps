import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets from Comet browser...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  
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

      // Navigate to the App Content overview page
      const contentUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/app-content/overview";
      console.log(`Navigating to App Content: ${contentUrl}`);
      await sendCommand("Page.navigate", { url: contentUrl });
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Click on "Actioned" tab
      console.log("Clicking on 'Actioned' tab...");
      await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const tabs = Array.from(document.querySelectorAll('div, span, button'));
          const actionedTab = tabs.find(el => el.textContent.trim() === 'Actioned');
          if (actionedTab) actionedTab.click();
        })()`,
        returnByValue: true
      });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Click Manage for Government apps using the robust parent-chain lookup
      console.log("Locating and clicking 'Manage' for Government apps using parent-chain...");
      const clickManageResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // Find the text element containing 'Government apps'
          const elements = Array.from(document.querySelectorAll('*'));
          const govSpan = elements.find(el => 
            el.textContent.trim() === 'Government apps' && 
            (el.tagName.toLowerCase() === 'span' || el.tagName.toLowerCase() === 'div' || el.tagName.toLowerCase() === 'p')
          );
          
          if (govSpan) {
            let parent = govSpan.parentElement;
            while (parent) {
              // Check if this ancestor has a Manage button inside it
              const manageBtn = Array.from(parent.querySelectorAll('button, a, [role=\"button\"]')).find(b => 
                b.textContent.includes('Manage') || b.textContent.includes('Start')
              );
              if (manageBtn) {
                manageBtn.click();
                return { clicked: true, text: manageBtn.textContent.trim(), tag: manageBtn.tagName, foundViaAncestor: true };
              }
              parent = parent.parentElement;
            }
          }
          
          // Fallback row-based search
          const rows = Array.from(document.querySelectorAll('tr, div[role=\"row\"]'));
          const govRow = rows.find(r => r.textContent.includes('Government apps'));
          if (govRow) {
            const manageBtn = Array.from(govRow.querySelectorAll('button, a')).find(el => el.textContent.includes('Manage'));
            if (manageBtn) {
              manageBtn.click();
              return { clicked: true, text: manageBtn.textContent.trim(), rowBased: true };
            }
          }
          
          return { clicked: false };
        })()`,
        returnByValue: true
      });
      console.log("Click Manage Result:", clickManageResult.result.value);

      console.log("Waiting 6s for Government apps questionnaire to load...");
      await new Promise(resolve => setTimeout(resolve, 6000));

      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Current URL: ${urlResult.result.value}`);

      // Capture page text
      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const pageText = textResult.result.value;

      console.log("\n--- Government Apps Questionnaire Content ---");
      const lines = pageText.split("\n");
      for (const line of lines) {
        console.log(`  > ${line.trim()}`);
      }
      console.log("----------------------------------------------\n");

      // Save page text
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/government_apps_text.txt", pageText);

      // Take a screenshot
      console.log("Capturing screenshot of Government apps questionnaire...");
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      const screenshotPath = "/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/government_apps_status.png";
      writeFileSync(screenshotPath, buffer);
      console.log(`Screenshot saved to ${screenshotPath}`);

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
      console.log("WebSocket connection closed.");
    }
  };
}

run().catch(console.error);
