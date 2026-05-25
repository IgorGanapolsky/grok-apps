import { writeFileSync } from "node:fs";

async function run() {
  console.log("Fetching active targets from Comet browser...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  
  // Find a "New Tab" target to reuse, or any target we can navigate
  const newTab = targets.find(t => t.type === "page" && (t.url === "chrome://newtab/" || t.title === "New Tab"));
  let wsUrl;
  
  if (newTab) {
    console.log(`Reusing existing New Tab target: "${newTab.title}"`);
    wsUrl = newTab.webSocketDebuggerUrl;
  } else {
    // If no New Tab, create a new target
    console.log("Creating a new target tab...");
    const createRes = await fetch("http://127.0.0.1:9222/json/new?https://www.reddit.com/r/AndroidClosedTesting/");
    const newPage = await createRes.json();
    wsUrl = newPage.webSocketDebuggerUrl;
  }

  console.log(`Connecting to WebSocket: ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

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

      console.log("Navigating to Reddit AndroidClosedTesting...");
      await sendCommand("Page.navigate", { url: "https://www.reddit.com/r/AndroidClosedTesting/" });

      console.log("Waiting 10s for page to load...");
      await new Promise(resolve => setTimeout(resolve, 10000));

      const urlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      console.log(`Active URL: ${urlResult.result.value}`);

      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      
      console.log("\n--- Page Title & Header ---");
      console.log(textResult.result.value.split("\n").slice(0, 20).join(" | "));
      console.log("---------------------------\n");

      // Save screenshot to verify if we are logged in
      console.log("Capturing screenshot...");
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      const screenshotPath = "/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/reddit_comet_state.png";
      writeFileSync(screenshotPath, buffer);
      console.log(`Screenshot saved to ${screenshotPath}`);

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
      console.log("Connection closed.");
    }
  };
}

run().catch(console.error);
