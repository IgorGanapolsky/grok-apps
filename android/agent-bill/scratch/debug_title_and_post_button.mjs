async function run() {
  const targetId = "996582CD0A9FC776C043C47B4FE02DCE";
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
      await sendCommand("Page.enable");

      const debugResult = await sendCommand("Runtime.evaluate", {
        expression: `(() => {
          function getAllElements(root = document, results = []) {
            try {
              const elements = root.querySelectorAll('*');
              for (const el of elements) {
                results.push(el);
                if (el.shadowRoot) {
                  getAllElements(el.shadowRoot, results);
                }
              }
            } catch (e) {}
            return results;
          }

          const allElements = getAllElements();
          const debugInfo = [];

          for (const el of allElements) {
            const tagName = el.tagName.toLowerCase();
            const id = el.id || '';
            const className = el.className || '';
            const text = el.innerText || el.textContent || '';
            
            // Look for anything resembling title input
            if (tagName === 'textarea' || tagName === 'input' || id === 'innerTextArea') {
              if (id === 'innerTextArea' || el.getAttribute('name') === 'title' || (el.placeholder && el.placeholder.includes('Title'))) {
                debugInfo.push({
                  type: 'Title Candidate',
                  tagName,
                  id,
                  className,
                  name: el.getAttribute('name'),
                  placeholder: el.getAttribute('placeholder'),
                  parentTagName: el.parentNode ? el.parentNode.tagName : 'none',
                  hostTagName: (el.getRootNode() && el.getRootNode().host) ? el.getRootNode().host.tagName : 'none'
                });
              }
            }

            // Look for anything resembling Post button
            if (tagName === 'button' || el.getAttribute('role') === 'button' || id.includes('submit') || id.includes('post')) {
              if (text.includes('Post') || text.includes('post') || id.includes('post') || id.includes('submit')) {
                debugInfo.push({
                  type: 'Post Button Candidate',
                  tagName,
                  id,
                  className,
                  innerText: text.substring(0, 100).trim(),
                  parentTagName: el.parentNode ? el.parentNode.tagName : 'none',
                  hostTagName: (el.getRootNode() && el.getRootNode().host) ? el.getRootNode().host.tagName : 'none'
                });
              }
            }
          }

          return debugInfo;
        })()`,
        returnByValue: true
      });

      console.log("=== Debug Candidates ===");
      console.log(JSON.stringify(debugResult.result.value, null, 2));

    } catch (err) {
      console.error(err);
    } finally {
      ws.close();
    }
  };
}

run().catch(console.error);
