import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        const page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found.");
            return;
        }

        console.log(`Current page title: "${await page.title()}"`);
        console.log(`Current URL: ${page.url()}`);

        const domDetails = await page.evaluate(() => {
            // Find all radio elements
            const radios = Array.from(document.querySelectorAll('input[type="radio"], mat-radio-button, console-radio-button, [role="radio"]'));
            const radioDetails = radios.map(r => ({
                tagName: r.tagName,
                id: r.id,
                className: r.className,
                role: r.getAttribute('role'),
                text: r.textContent.trim(),
                outerHTML: r.outerHTML.substring(0, 300)
            }));

            // Find all potential question group containers
            const containers = Array.from(document.querySelectorAll('mat-radio-group, console-radio-group, [role="radiogroup"], .question, [debug-id]'));
            const containerDetails = containers.map(c => ({
                tagName: c.tagName,
                id: c.id,
                className: c.className,
                debugId: c.getAttribute('debug-id'),
                outerHTML: c.outerHTML.substring(0, 300)
            }));

            // Also check for the Next/Calculate/Submit buttons
            const buttons = Array.from(document.querySelectorAll('button'));
            const buttonDetails = buttons.map(b => ({
                text: b.textContent.trim(),
                disabled: b.disabled,
                outerHTML: b.outerHTML.substring(0, 300)
            }));

            return {
                radioCount: radios.length,
                radios: radioDetails.slice(0, 10),
                containerCount: containers.length,
                containers: containerDetails.slice(0, 10),
                buttonCount: buttons.length,
                buttons: buttonDetails
            };
        });

        console.log("DOM Details:", JSON.stringify(domDetails, null, 2));
    } catch (e) {
        console.error("Error during diagnosis:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
