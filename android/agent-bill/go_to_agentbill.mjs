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

      console.log("Locating the link for AgentBill app ID 4973243580627455820...");
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

      const dashboardUrlResult = await sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });
      const dashboardUrl = dashboardUrlResult.result.value;
      console.log(`Current active URL: ${dashboardUrl}`);

      // Verify we are on dashboard
      const textResult = await sendCommand("Runtime.evaluate", {
        expression: "document.body.innerText",
        returnByValue: true
      });
      console.log("Dashboard loaded text sample:", textResult.result.value.split("\n").slice(0, 15).join(" | "));

      // Take a screenshot of the dashboard
      const screenshotResult = await sendCommand("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(screenshotResult.data, "base64");
      writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/dashboard_restored.png", buffer);
      console.log("Screenshot of dashboard saved.");

      // Now navigate to Publishing Overview by constructing the URL from the dashboard URL
      if (dashboardUrl.includes("/app-dashboard") || dashboardUrl.includes("/dashboard")) {
        const pubOverviewUrl = dashboardUrl.replace(/\/(app-dashboard|dashboard)$/, "/publishing-overview");
        console.log(`Navigating to Publishing Overview URL: ${pubOverviewUrl}`);
        await sendCommand("Page.navigate", { url: pubOverviewUrl });

        console.log("Waiting 8s for Publishing Overview to load...");
        await new Promise(resolve => setTimeout(resolve, 8000));

        const finalUrlResult = await sendCommand("Runtime.evaluate", {
          expression: "window.location.href",
          returnByValue: true
        });
        console.log(`Current URL: ${finalUrlResult.result.value}`);

        const finalPageText = await sendCommand("Runtime.evaluate", {
          expression: "document.body.innerText",
          returnByValue: true
        });
        console.log("\n--- Publishing Overview Content ---");
        const lines = finalPageText.result.value.split("\n");
        for (const line of lines) {
          const l = line.trim();
          if (l.length > 0 && (l.includes("review") || l.includes("Review") || l.includes("changes") || l.includes("Changes") || l.includes("Send") || l.includes("send") || l.includes("Category") || l.includes("Productivity"))) {
            console.log(`  > ${l}`);
          }
        }
        console.log("-----------------------------------\n");

        // Save a screenshot
        const screenshotResult2 = await sendCommand("Page.captureScreenshot", { format: "png" });
        const buffer2 = Buffer.from(screenshotResult2.data, "base64");
        writeFileSync("/Users/igorganapolsky/workspace/git/igor/grok-apps/android/Agent-Bill/publishing_overview_restored.png", buffer2);
        console.log("Screenshot of Publishing Overview saved.");
      } else {
        console.error("ERROR: Active URL does not seem to be the app dashboard.");
      }

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
      console.log("WebSocket connection closed.");
    }
  };
}

run().catch(console.error);
