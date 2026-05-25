import { writeFileSync } from "node:fs";

async function run() {
  const targetId = "6EDFA1792D04B07000E9749AE299E980";
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  const target = targets.find(t => t.id === targetId);
  
  if (!target) {
    console.error(`ERROR: Target with ID ${targetId} not found.`);
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
      await sendCommand("Runtime.enable");

      console.log("Selecting 'Google Groups' radio button and setting tester details...");
      const selectGroupsResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // 1. Click the Google Groups radio button.
          // Let's find the radio inputs. The first one is Email Lists, second is Google Groups.
          const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
          if (radios.length >= 2) {
            radios[1].click();
            console.log("Clicked Google Groups radio button");
          } else {
            // Fallback search by text/labels
            const allElements = Array.from(document.querySelectorAll('*'));
            const groupsLabel = allElements.find(el => el.innerText && el.innerText.trim() === 'Google Groups');
            if (groupsLabel) {
              groupsLabel.click();
              console.log("Clicked Google Groups label as fallback");
            } else {
              console.log("ERROR: Google Groups radio option not found");
              return "ERROR: Google Groups radio option not found";
            }
          }
          return "SUCCESS: Selected Google Groups radio";
        })()`,
        returnByValue: true
      });
      console.log("Radio selection status:", selectGroupsResult.result.value);

      // Wait 2s for UI transition
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log("Filling in Google Group email and Feedback link...");
      const fillFieldsResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // Find Google Group input
          const groupInput = document.querySelector('input[aria-label="Enter Google Group email addresses"]') || 
                             document.querySelector('.search-input') ||
                             document.querySelector('input[placeholder*="Google Group"]');
          
          // Find Feedback URL input
          const feedbackInput = document.querySelector('input[aria-label="Feedback URL or email address"]') ||
                              document.querySelector('input[placeholder*="Feedback"]');

          if (!groupInput) {
            console.log("ERROR: Could not find Google Group input field");
            return "ERROR: Could not find Google Group input field";
          }

          groupInput.value = "agentbill-testers@googlegroups.com";
          groupInput.dispatchEvent(new Event('input', { bubbles: true }));
          groupInput.dispatchEvent(new Event('change', { bubbles: true }));
          console.log("Filled Google Group input");

          if (feedbackInput) {
            feedbackInput.value = "https://groups.google.com/g/agentbill-testers";
            feedbackInput.dispatchEvent(new Event('input', { bubbles: true }));
            feedbackInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log("Filled Feedback URL input");
          } else {
            console.log("WARNING: Feedback URL input not found");
          }

          return "SUCCESS: Filled fields";
        })()`,
        returnByValue: true
      });
      console.log("Fill status:", fillFieldsResult.result.value);

      // Wait 2s
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log("Clicking 'Save' button at the bottom...");
      const clickSaveResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          // Find the Save button
          const saveBtn = buttons.find(b => b.textContent.trim() === 'Save');
          if (saveBtn) {
            saveBtn.click();
            return "SUCCESS: Clicked Save button";
          }
          return "ERROR: Save button not found";
        })()`,
        returnByValue: true
      });
      console.log("Save click status:", clickSaveResult.result.value);

      console.log("Waiting 6s for Save to process...");
      await new Promise(resolve => setTimeout(resolve, 6000));

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      console.log("\n--- Active Page Content After Save ---");
      const lines = textResult.result.value.split("\n");
      const testersIndex = lines.findIndex(l => l.includes("Mailing lists") || l.includes("Google Groups") || l.includes("Testers"));
      const startIndex = testersIndex !== -1 ? Math.max(0, testersIndex - 5) : 0;
      for (let i = startIndex; i < Math.min(lines.length, startIndex + 60); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("--------------------------------------\n");

      // Take screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/testers_saved_play_console.png", buffer);
      console.log("Screenshot saved.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
