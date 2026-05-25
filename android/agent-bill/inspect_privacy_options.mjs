import { writeFileSync } from "node:fs";

async function run() {
  const targetId = "DB9DA0FBA61BFC3E178AE8E7C3DC7B3E";
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  const target = targets.find(t => t.id === targetId);
  
  if (!target) {
    console.error(`ERROR: Target with ID ${targetId} not found.`);
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

      // We want to find elements that control "Who can join group"
      const result = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // Look at how the "Who can join group" options are laid out.
          // Let's dump all div / listbox elements that are visible on Step 2.
          const divs = Array.from(document.querySelectorAll('div[role="listbox"], div[role="radiogroup"], div[role="radio"], div[role="option"]'));
          const listboxInfo = divs.map((el, index) => ({
            index,
            tagName: el.tagName,
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label'),
            innerText: el.innerText ? el.innerText.trim() : '',
            className: el.className,
            ariaSelected: el.getAttribute('aria-selected'),
            ariaChecked: el.getAttribute('aria-checked')
          }));

          // Let's also look for text spans/divs containing "Anyone can join" or similar
          const elementsWithText = Array.from(document.querySelectorAll('span, div, label')).filter(el => {
            const txt = el.innerText ? el.innerText.trim() : '';
            return txt === 'Anyone can join' || txt === 'Anyone can ask' || txt === 'Only invited users';
          }).map((el, i) => ({
            index: i,
            tagName: el.tagName,
            text: el.innerText.trim(),
            className: el.className,
            role: el.getAttribute('role'),
            parentId: el.parentElement ? el.parentElement.tagName : '',
            parentClass: el.parentElement ? el.parentElement.className : ''
          }));

          return { listboxInfo, elementsWithText };
        })()`,
        returnByValue: true
      });

      console.log("MDC components / Listboxes / Radios:");
      console.log(JSON.stringify(result.result.value.listboxInfo, null, 2));
      console.log("\nElements containing join option texts:");
      console.log(JSON.stringify(result.result.value.elementsWithText, null, 2));

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
