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

        const details = await page.evaluate(() => {
            const label = Array.from(document.querySelectorAll('label, span')).find(el => 
                el.textContent.includes("agree to the Terms")
            );
            if (!label) return { found: false };

            const parent = label.parentElement;
            const parentHTML = parent ? parent.outerHTML.substring(0, 1000) : "No parent";
            
            const siblings = parent ? Array.from(parent.children).map(child => ({
                tagName: child.tagName,
                className: child.className,
                outerHTML: child.outerHTML.substring(0, 300)
            })) : [];

            // Let's also search for any input checkbox on the whole page
            const inputs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
            const inputDetails = inputs.map(i => ({
                id: i.id,
                className: i.className,
                checked: i.checked,
                outerHTML: i.outerHTML.substring(0, 300)
            }));

            // Let's also check for all mat-checkbox/console-checkbox elements
            const customCheckboxes = Array.from(document.querySelectorAll('mat-checkbox, console-checkbox, [role="checkbox"]'));
            const customDetails = customCheckboxes.map(c => ({
                tagName: c.tagName,
                className: c.className,
                ariaChecked: c.getAttribute('aria-checked'),
                outerHTML: c.outerHTML.substring(0, 300)
            }));

            return {
                found: true,
                labelTagName: label.tagName,
                labelOuterHTML: label.outerHTML,
                parentTagName: parent ? parent.tagName : null,
                parentClassName: parent ? parent.className : null,
                parentHTML: parentHTML,
                siblings: siblings,
                allInputCheckboxes: inputDetails,
                allCustomCheckboxes: customDetails
            };
        });

        console.log("Checkbox DOM Details:", JSON.stringify(details, null, 2));
    } catch (e) {
        console.error("Error during diagnosis:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
