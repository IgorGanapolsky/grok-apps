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

        // Click "Edit declaration" on Content ratings
        const editBtn = page.locator('button:has-text("Edit declaration")').first();
        if (await editBtn.count() > 0) {
            console.log("Found 'Edit declaration' button. Clicking it...");
            await editBtn.click();
            await page.waitForTimeout(6000);
            console.log(`Navigated to: ${page.url()}`);
        } else {
            console.log("'Edit declaration' button not found on overview.");
        }

        // Now dump the DOM details of the questionnaire page
        const domDetails = await page.evaluate(() => {
            // Find all radio elements
            const radios = Array.from(document.querySelectorAll('input[type="radio"], mat-radio-button, console-radio-button, [role="radio"], label, span'));
            const radioDetails = radios.map(r => ({
                tagName: r.tagName,
                id: r.id,
                className: r.className,
                role: r.getAttribute('role'),
                text: r.textContent.trim(),
                outerHTML: r.outerHTML.substring(0, 300)
            }));

            // Find all potential question group containers
            const groups = Array.from(document.querySelectorAll('mat-radio-group, console-radio-group, [role="radiogroup"], .question, [debug-id]'));
            const groupDetails = groups.map(g => ({
                tagName: g.tagName,
                id: g.id,
                className: g.className,
                debugId: g.getAttribute('debug-id'),
                outerHTML: g.outerHTML.substring(0, 300)
            }));

            const buttons = Array.from(document.querySelectorAll('button'));
            const buttonDetails = buttons.map(b => ({
                text: b.textContent.trim(),
                disabled: b.disabled,
                outerHTML: b.outerHTML.substring(0, 300)
            }));

            return {
                radioCount: radios.length,
                radios: radioDetails.slice(0, 15),
                groupCount: groups.length,
                groups: groupDetails.slice(0, 15),
                buttonCount: buttons.length,
                buttons: buttonDetails
            };
        });

        console.log("Questionnaire DOM Details:", JSON.stringify(domDetails, null, 2));

        // Take a screenshot to visualize
        await page.screenshot({ path: "questionnaire_inspected.png" });
        console.log("Screenshot saved as questionnaire_inspected.png");
    } catch (e) {
        console.error("Error during diagnosis:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
