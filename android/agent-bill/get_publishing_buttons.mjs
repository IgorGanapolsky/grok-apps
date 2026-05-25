import { writeFileSync } from "node:fs";

async function run() {
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  const target = targets.find(t => t.url.includes("play.google.com/console"));
  if (!target) {
    console.error("No target");
    process.exit(1);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const sendCommand = (method, params = {}) => {
    return new Promise((resolve, reject) => {
      const id = Math.floor(Math.random() * 1000000);
      const messageHandler = (event) => {
        const response = JSON.parse(event.data);
        if (response.id === id) {
          ws.removeEventListener("message", messageHandler);
          if (response.error) reject(response.error);
          else resolve(response.result);
        }
      };
      ws.addEventListener("message", messageHandler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  ws.onopen = async () => {
    try {
      await sendCommand("Runtime.enable");
      const result = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          return btns.map((b, idx) => ({
            index: idx,
            text: b.textContent.trim().replace(/\\n/g, ' '),
            disabled: b.disabled || b.getAttribute('disabled') !== null,
            outerHTML: b.outerHTML.substring(0, 150)
          })).filter(b => b.text.includes('Send') || b.text.includes('review') || b.text.includes('Review') || b.text.includes('changes') || b.text.includes('Changes') || b.text.includes('publishing') || b.text.includes('Publishing') || b.text.includes('Turn on'));
        })()`,
        returnByValue: true
      });
      console.log(JSON.stringify(result.result.value, null, 2));
    } catch(e) {
      console.error(e);
    } finally {
      ws.close();
    }
  };
}
run();
