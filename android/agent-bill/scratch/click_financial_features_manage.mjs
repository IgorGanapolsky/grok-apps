import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  const target = targets.find(t => t.url.includes("play.google.com/console") && t.url.includes("/app-content/overview"));
  if (!target) {
    console.error("ERROR: Not currently on the App Content page.");
    process.exit(1);
  }

  console.log(`Connecting to: "${target.title}"`);
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

      console.log("Clicking the 'Manage' button on the 'Financial features' row...");
      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // Let's print all elements and look for 'Financial features'
          const allEls = Array.from(document.querySelectorAll('*'));
          
          // Let's find the element containing 'Financial features'
          const finFeatures = allEls.find(el => el.textContent.trim() === 'Financial features');
          if (!finFeatures) {
            return { error: "Financial features element not found" };
          }
          
          // Find the containing row/ancestor.
          // Let's go up the parent tree until we find a tag that contains both 'Financial features' and 'Manage'
          let ancestor = finFeatures.parentElement;
          let foundManage = null;
          
          while (ancestor && ancestor !== document.body) {
            const manageButtons = Array.from(ancestor.querySelectorAll('*')).filter(el => 
              (el.textContent.trim() === 'Manage' || el.textContent.trim() === 'Start') &&
              (el.tagName.toLowerCase() === 'button' || el.tagName.toLowerCase() === 'a' || el.tagName.toLowerCase() === 'div' || el.tagName.toLowerCase() === 'span')
            );
            if (manageButtons.length > 0) {
              foundManage = manageButtons[0];
              break;
            }
            ancestor = ancestor.parentElement;
          }
          
          if (foundManage) {
            foundManage.click();
            return { clicked: true, text: foundManage.textContent.trim(), tag: foundManage.tagName };
          }
          
          // Fallback: look for all 'Manage' elements, and find the one near 'Financial features' by index
          const manageEls = allEls.filter(el => el.textContent.trim() === 'Manage');
          const finIndex = allEls.indexOf(finFeatures);
          let closestManage = null;
          let minDistance = Infinity;
          
          for (const m of manageEls) {
            const index = allEls.indexOf(m);
            const dist = Math.abs(index - finIndex);
            if (dist < minDistance) {
              minDistance = dist;
              closestManage = m;
            }
          }
          
          if (closestManage) {
            closestManage.click();
            return { clicked: true, method: 'Closest element', text: closestManage.textContent.trim(), tag: closestManage.tagName };
          }
          
          return { clicked: false, error: "Manage button not found" };
        })()`,
        returnByValue: true
      });

      console.log("Click result:", clickResult.result.value);

      console.log("Waiting 8s for the Financial features questionnaire to load...");
      await new Promise(resolve => setTimeout(resolve, 8000));

      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      const currentUrl = urlResult.result.value;
      console.log(`Current URL: ${currentUrl}`);

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const questionnaireText = textResult.result.value;

      console.log("\n--- Financial Features Questionnaire Page Content ---");
      const lines = questionnaireText.split("\n");
      for (let i = 0; i < Math.min(lines.length, 120); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("------------------------------------------------------\n");

      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/financial_features_page_text.txt", questionnaireText);

      // Take a screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/financial_features_page_state.png", buffer);
      console.log("Screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
