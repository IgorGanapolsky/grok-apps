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
      await sendCommand("Runtime.enable");

      const linkResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const links = Array.from(document.querySelectorAll('a'));
          return links.map(a => ({ text: a.textContent.trim(), href: a.href }));
        })()`,
        returnByValue: true
      });

      console.log("\n--- Links found on Home Page ---");
      for (const link of linkResult.result.value) {
        if (link.href.includes("/app/")) {
          console.log(`Text: "${link.text}" | Href: ${link.href}`);
        }
      }
      console.log("--------------------------------\n");

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
