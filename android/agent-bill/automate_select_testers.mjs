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

      // We are on the dashboard. Let's find "Select testers" and click it
      console.log("Looking for and clicking 'Select testers'...");
      const clickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const links = Array.from(document.querySelectorAll('a'));
          const testersLink = links.find(a => a.textContent.includes('Select testers'));
          if (testersLink) {
            testersLink.scrollIntoView({ block: 'center' });
            testersLink.click();
            return { clicked: true, text: testersLink.textContent.trim(), href: testersLink.href };
          }
          
          // Try div/span with chevron/right arrow next to Select testers
          const elements = Array.from(document.querySelectorAll('*'));
          const el = elements.find(el => el.textContent.trim() === 'Select testers');
          if (el) {
            el.click();
            return { clicked: true, method: 'Direct click on text' };
          }

          return { clicked: false, links: links.map(l => l.textContent.trim()) };
        })()`,
        returnByValue: true
      });

      console.log("Click result:", clickResult.result.value);

      console.log("Waiting 8s for the testers page to load...");
      await new Promise(resolve => setTimeout(resolve, 8000));

      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Current URL: ${urlResult.result.value}`);

      // Capture page text on the testers page to see what's there
      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      const pageText = textResult.result.value;
      console.log("\n--- Testers Page Content ---");
      const lines = pageText.split("\n");
      for (let i = 0; i < Math.min(lines.length, 40); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("----------------------------\n");

      // Save page text
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/testers_page_text.txt", pageText);

      // Check if there are checkboxes or mailing lists
      console.log("Looking for checkboxes or mailing lists to select...");
      const selectListResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const checkboxes = Array.from(document.querySelectorAll('mat-checkbox, input[type="checkbox"]'));
          const labelTexts = Array.from(document.querySelectorAll('label, span, div')).map(el => el.textContent.trim());
          
          // Let's click the first checkbox we find
          if (checkboxes.length > 0) {
            checkboxes[0].scrollIntoView({ block: 'center' });
            checkboxes[0].click();
            
            // Check if there are other checkboxes (we can click them too if they are mailing lists)
            for (let i = 1; i < checkboxes.length; i++) {
              checkboxes[i].click();
            }

            return { foundCheckbox: true, count: checkboxes.length };
          }
          
          return { foundCheckbox: false, labelTexts: labelTexts.slice(0, 50) };
        })()`,
        returnByValue: true
      });
      console.log("Select checkbox result:", selectListResult.result.value);

      // Wait 3s
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Click "Save changes" button
      console.log("Looking for and clicking 'Save changes' button...");
      const saveResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const saveBtn = buttons.find(b => b.textContent.includes('Save changes') || b.textContent.trim() === 'Save');
          if (saveBtn) {
            saveBtn.click();
            return { clicked: true, text: saveBtn.textContent.trim() };
          }
          return { clicked: false, buttons: buttons.map(b => b.textContent.trim()) };
        })()`,
        returnByValue: true
      });
      console.log("Save changes result:", saveResult.result.value);

      // Wait 5s for save to commit
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Let's navigate back to the dashboard to verify
      console.log("Navigating back to app dashboard...");
      const dashboardUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/app-dashboard";
      await sendCommand("Page.navigate", { url: dashboardUrl });

      console.log("Waiting 10s for the Dashboard to reload...");
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Capture final screenshot and text of the dashboard
      const finalUrl = await sendCommand("Runtime.evaluate", { expression: "window.location.href", returnByValue: true });
      console.log(`Verified Dashboard URL: ${finalUrl.result.value}`);

      const finalCheckText = await sendCommand("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true });
      const finalLines = finalCheckText.result.value.split("\n");
      console.log("\n--- Final Dashboard Content ---");
      for (let i = 0; i < Math.min(finalLines.length, 30); i++) {
        console.log(`  > ${finalLines[i].trim()}`);
      }
      console.log("-------------------------------\n");

      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/testers_selected_dashboard_state.png", buffer);
      console.log("Final screenshot saved to testers_selected_dashboard_state.png.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
      console.log("WebSocket connection closed.");
    }
  };
}

run().catch(console.error);
