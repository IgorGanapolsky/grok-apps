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

      console.log("Waiting 10s for App Content page to load...");
      await new Promise(resolve => setTimeout(resolve, 10000));

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

      console.log("\n--- App Content Overview Page Content ---");
      const lines = pageText.split("\n");
      for (const line of lines) {
        console.log(`  > ${line.trim()}`);
      }
      console.log("-----------------------------------------\n");

      // Save the text to a file
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/app_content_overview_text.txt", pageText);

      // Take a screenshot
      console.log("Capturing screenshot of App Content Overview...");
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      const screenshotPath = "/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/app_content_overview.png";
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
