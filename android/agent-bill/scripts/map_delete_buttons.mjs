import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found.");
            return;
        }

        console.log(`Analyzing tab: "${await page.title()}"`);

        const buttonMapping = await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            const matching = [];
            
            btns.forEach((btn, idx) => {
                const txt = btn.innerText ? btn.innerText.trim() : "";
                const aria = btn.getAttribute('aria-label') || "";
                
                if (aria.includes("Remove app-release.aab") || txt === "delete" || txt === "clear") {
                    // Find nearest text container
                    let current = btn;
                    let contextText = "";
                    for (let i = 0; i < 8; i++) {
                        if (current.parentElement) {
                            contextText = current.parentElement.innerText ? current.parentElement.innerText.trim() : "";
                            if (contextText.includes("Version") || contextText.includes("App bundle") || contextText.includes("already been used")) {
                                break;
                            }
                            current = current.parentElement;
                        }
                    }
                    
                    matching.push({
                        buttonIndex: idx,
                        buttonText: txt,
                        ariaLabel: aria,
                        className: btn.className || "",
                        context: contextText.substring(0, 400).replace(/\n/g, " | ")
                    });
                }
            });
            return matching;
        });

        console.log("\n--- DETAILED DELETE BUTTON MAPPING ---");
        buttonMapping.forEach(m => {
            console.log(`\nButton #${m.buttonIndex}: [Text="${m.buttonText}", AriaLabel="${m.ariaLabel}"]`);
            console.log(`Class: ${m.className}`);
            console.log(`Context Text: ${m.context}`);
        });
        console.log("\n--------------------------------------\n");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
