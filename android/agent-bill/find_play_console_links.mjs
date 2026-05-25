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

      // Retrieve all links on the dashboard
      const result = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const links = Array.from(document.querySelectorAll('a'));
          return links.map(a => ({
            text: a.innerText ? a.innerText.trim() : '',
            href: a.href,
            ariaLabel: a.getAttribute('aria-label')
          })).filter(l => l.text || l.href);
        })()`,
        returnByValue: true
      });

      console.log("Found links on Play Console Dashboard:");
      const filtered = result.result.value.filter(l => {
        const txt = l.text.toLowerCase();
        const href = l.href.toLowerCase();
        return txt.includes("test") || txt.includes("track") || txt.includes("alpha") || txt.includes("release") || href.includes("track") || href.includes("test");
      });
      console.log(JSON.stringify(filtered, null, 2));

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
