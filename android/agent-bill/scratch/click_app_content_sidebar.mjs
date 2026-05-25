import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  const target = targets.find(t => t.url.includes("play.google.com/console"));
  if (!target) {
    console.error("ERROR: No active Play Console tab found.");
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

      // First let's check if we are on the policy details page. If not, go there first.
      const currentUrlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      const currentUrl = currentUrlResult.result.value;
      console.log(`Current URL at start: ${currentUrl}`);

      if (!currentUrl.includes("/policy-center")) {
        const detailsUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/policy-center/issues/4989639849899950694/details";
        console.log(`Navigating to details page: ${detailsUrl}`);
        await sendCommand("Page.navigate", { url: detailsUrl });
        console.log("Waiting 8s for details page to load...");
        await new Promise(resolve => setTimeout(resolve, 8000));
      }

      console.log("Locating the 'App content' sidebar link...");
      const sidebarClickResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // Print all links
          const links = Array.from(document.querySelectorAll('a'));
          const appContentLink = links.find(a => a.textContent.trim() === 'App content');
          if (appContentLink) {
            appContentLink.click();
            return { clicked: true, text: appContentLink.textContent.trim(), href: appContentLink.href };
          }
          
          // Let's search by partial text
          const partialLink = links.find(a => a.textContent.includes('App content'));
          if (partialLink) {
            partialLink.click();
            return { clicked: true, partial: true, text: partialLink.textContent.trim(), href: partialLink.href };
          }
          
          return { clicked: false, availableLinks: links.map(a => a.textContent.trim()).filter(t => t.length > 0) };
        })()`,
        returnByValue: true
      });

      console.log("Sidebar click result:", sidebarClickResult.result.value);

      if (sidebarClickResult.result.value.clicked) {
        console.log("Waiting 10s for the App Content page to load...");
        await new Promise(resolve => setTimeout(resolve, 10000));

        const finalUrlResult = await sendCommand("Runtime.evaluate", {
          expression: "window.location.href",
          returnByValue: true
        });
        console.log(`Final URL: ${finalUrlResult.result.value}`);

        const textResult = await sendCommand("Runtime.evaluate", {
          expression: "document.body.innerText",
          returnByValue: true
        });
        const pageText = textResult.result.value;
        console.log("\n--- App Content Loaded Content ---");
        const lines = pageText.split("\n");
        for (let i = 0; i < Math.min(lines.length, 50); i++) {
          console.log(`  > ${lines[i].trim()}`);
        }
        console.log("----------------------------------\n");

        writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/app_content_loaded_text.txt", pageText);

        const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
        const buffer = Buffer.from(screenshotResult.data, "base64");
        writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/app_content_loaded_screenshot.png", buffer);
        console.log("Screenshot saved.");
      }

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
