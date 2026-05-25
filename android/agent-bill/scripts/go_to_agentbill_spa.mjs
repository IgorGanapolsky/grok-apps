import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets from Comet browser...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  
  // Find Play Console target (Home page)
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

      // Check if we are already in the app context or need to click from Home page
      const currentUrlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      const startUrl = currentUrlResult.result.value;
      console.log(`Current active URL on start: ${startUrl}`);

      if (startUrl.includes("/app-list") || !startUrl.includes("/app/4973243580627455820")) {
        console.log("Not in AgentBill app. Locating the link for AgentBill app ID 4973243580627455820...");
        const clickResult = await sendCommand("Runtime.evaluate", {
          expression: `(() => {
            const agentBillLink = document.querySelector('a[href*="/app/4973243580627455820/"]');
            if (agentBillLink) {
              agentBillLink.click();
              return { clicked: true, text: agentBillLink.textContent.trim(), href: agentBillLink.href };
            }
            return { clicked: false };
          })()`,
          returnByValue: true
        });

        console.log("Click result:", clickResult.result.value);
        console.log("Waiting 8s for app dashboard to load...");
        await new Promise(resolve => setTimeout(resolve, 8000));
      } else {
        console.log("Already in AgentBill app context.");
      }

      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Current URL: ${urlResult.result.value}`);

      // Now click on "Publishing overview" in the sidebar SPA menu
      console.log("Locating and clicking 'Publishing overview' in the sidebar...");
      const clickMenuResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // Find all links or items containing 'Publishing overview'
          const links = Array.from(document.querySelectorAll('a, button, [role="button"], span, div'));
          const item = links.find(el => el.textContent.trim() === 'Publishing overview' || el.innerText?.trim() === 'Publishing overview');
          if (item) {
            // Find the closest clickable ancestor link or click directly
            let clickable = item;
            while (clickable && clickable !== document.body) {
              if (clickable.tagName.toLowerCase() === 'a' || clickable.tagName.toLowerCase() === 'button') {
                clickable.click();
                return { clicked: true, text: item.textContent.trim(), tag: clickable.tagName, class: clickable.className };
              }
              clickable = clickable.parentElement;
            }
            item.click();
            return { clicked: true, text: item.textContent.trim(), direct: true };
          }
          return { clicked: false };
        })()`,
        returnByValue: true
      });

      console.log("Click menu result:", clickMenuResult.result.value);
      console.log("Waiting 8s for Publishing Overview to load...");
      await new Promise(resolve => setTimeout(resolve, 8000));

      const finalUrlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Final URL: ${finalUrlResult.result.value}`);

      const finalPageText = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      
      console.log("\n--- Page Content after SPA Transition ---");
      const lines = finalPageText.result.value.split("\n");
      for (let i = 0; i < Math.min(lines.length, 50); i++) {
        console.log(`  > ${lines[i].trim()}`);
      }
      console.log("-----------------------------------------\n");

      // Save screenshot
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/publishing_overview_spa_success.png", buffer);
      console.log("Screenshot saved to publishing_overview_spa_success.png.");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
      console.log("WebSocket connection closed.");
    }
  };
}

run().catch(console.error);
