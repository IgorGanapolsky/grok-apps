async function run() {
  console.log("Fetching active targets...");
  const res = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await res.json();
  const target = targets.find(t => t.url.includes("play.google.com/console") && t.url.includes("/app-content/finance"));
  if (!target) {
    console.error("ERROR: Not currently on the Financial features page.");
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
      await sendCommand("Runtime.enable");

      console.log("Checking selected financial features checkboxes...");
      const checkResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          // Let's inspect all input[type="checkbox"] or elements that might be custom checkbox/radio elements
          const inputs = Array.from(document.querySelectorAll('input'));
          const checkedInputs = inputs.filter(i => i.checked);
          
          // Let's also check for custom material/MDC checkboxes or list items that have aria-checked="true"
          const ariaChecked = Array.from(document.querySelectorAll('[aria-checked="true"]'));
          const ariaSelected = Array.from(document.querySelectorAll('[aria-selected="true"]'));
          
          // Let's also print checkbox labels and check their checked/active state
          const labelsWithChecks = [];
          const labels = Array.from(document.querySelectorAll('label'));
          for (const label of labels) {
            const text = label.textContent.trim();
            const input = label.querySelector('input');
            if (input) {
              labelsWithChecks.push({ text, checked: input.checked, type: input.type });
            }
          }
          
          // Also try finding MDC/Mat checkbox containers
          const matCheckboxes = Array.from(document.querySelectorAll('mat-checkbox, mdc-checkbox, [role="checkbox"]'));
          const matDetails = matCheckboxes.map(c => {
            const labelText = c.textContent.trim();
            const isChecked = c.getAttribute('aria-checked') === 'true' || c.classList.contains('mdc-checkbox--selected') || c.classList.contains('mat-checkbox-checked') || c.innerHTML.includes('checked');
            return { labelText, isChecked, classes: c.className };
          });
          
          return {
            inputs: inputs.map(i => ({ type: i.type, name: i.name, checked: i.checked, id: i.id })),
            checkedInputs: checkedInputs.map(i => ({ type: i.type, name: i.name, id: i.id })),
            ariaChecked: ariaChecked.map(el => ({ tag: el.tagName, text: el.textContent.trim(), class: el.className })),
            ariaSelected: ariaSelected.map(el => ({ tag: el.tagName, text: el.textContent.trim(), class: el.className })),
            labels: labelsWithChecks,
            matCheckboxes: matDetails
          };
        })()`,
        returnByValue: true
      });

      console.log("Checkbox Statuses:\n", JSON.stringify(checkResult.result.value, null, 2));

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
