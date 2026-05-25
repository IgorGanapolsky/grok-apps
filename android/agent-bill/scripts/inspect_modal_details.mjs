import { chromium } from "playwright";

async function run() {
    console.log("[inspect-details] Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            throw new Error("No Play Console tab found.");
        }

        console.log(`[inspect-details] Found tab: "${await page.title()}"`);

        const data = await page.evaluate(() => {
            // Find all inputs
            const inputs = Array.from(document.querySelectorAll("input")).map((el, idx) => {
                return {
                    idx,
                    tagName: el.tagName.toLowerCase(),
                    type: el.type,
                    id: el.id || "",
                    className: el.className || "",
                    outerHTML: el.outerHTML,
                    visible: el.getBoundingClientRect().height > 0
                };
            });

            // Find all elements with class containing 'radio' or role='radio' or role='checkbox'
            const radios = Array.from(document.querySelectorAll("[role='radio'], [role='checkbox'], .mdc-radio, .radio")).map((el, idx) => {
                return {
                    idx,
                    tagName: el.tagName.toLowerCase(),
                    className: el.className || "",
                    outerHTML: el.outerHTML,
                    visible: el.getBoundingClientRect().height > 0
                };
            });

            // Find all cells/rows that contain 'Internal testing'
            const elementsWithText = Array.from(document.querySelectorAll("tr, div[role='row'], div, label, span")).filter(el => {
                const text = el.innerText ? el.innerText.trim() : "";
                return text.includes("Internal testing") && text.includes("0.1.0");
            }).map((el, idx) => {
                return {
                    idx,
                    tagName: el.tagName.toLowerCase(),
                    className: el.className || "",
                    outerHTML: el.outerHTML.substring(0, 500),
                    visible: el.getBoundingClientRect().height > 0
                };
            });

            return { inputs, radios, elementsWithText };
        });

        console.log("\n--- ALL INPUTS ON PAGE ---");
        data.inputs.forEach(inp => {
            console.log(`Input #${inp.idx}: Tag=${inp.tagName}, Type=${inp.type}, ID="${inp.id}", Class="${inp.className}", Visible=${inp.visible}`);
            console.log(`OuterHTML: ${inp.outerHTML}\n`);
        });

        console.log("\n--- ALL RADIO/CHECKBOX ELEMENTS ON PAGE ---");
        data.radios.forEach(rad => {
            console.log(`Radio #${rad.idx}: Tag=${rad.tagName}, Class="${rad.className}", Visible=${rad.visible}`);
            console.log(`OuterHTML: ${rad.outerHTML}\n`);
        });

        console.log("\n--- ELEMENTS WITH TEXT 'Internal testing 0.1.0' ---");
        data.elementsWithText.forEach(el => {
            console.log(`TextEl #${el.idx}: Tag=${el.tagName}, Class="${el.className}", Visible=${el.visible}`);
            console.log(`OuterHTML snippet: ${el.outerHTML}\n`);
        });

    } catch (e) {
        console.error("Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}

run();
