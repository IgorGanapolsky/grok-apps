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

        // If we are on the overview page, click "Edit"
        if (page.url().includes("content-rating-overview")) {
            const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit")').first();
            if (await editBtn.count() > 0) {
                console.log("Found 'Edit' button. Clicking it...");
                await editBtn.click();
                await page.waitForTimeout(6000);
            }
        }

        // If we are on Category page (step 1), click Next
        if (page.url().includes("content-rating-iarc-questionnaire")) {
            const nextBtn = page.locator('button:has-text("Next")').first();
            if (await nextBtn.count() > 0 && await nextBtn.isEnabled()) {
                console.log("On Category step. Clicking Next...");
                await nextBtn.click();
                await page.waitForTimeout(6000);
            }
        }

        console.log(`Target Questionnaire URL reached: ${page.url()}`);

        const domDetails = await page.evaluate(() => {
            // Let's search broadly for all elements that might be radio buttons or inputs
            const radios = Array.from(document.querySelectorAll('input[type="radio"], mat-radio-button, console-radio-button, [role="radio"]'));
            const radioDetails = radios.map(r => ({
                tagName: r.tagName,
                id: r.id,
                className: r.className,
                role: r.getAttribute('role'),
                ariaChecked: r.getAttribute('aria-checked'),
                text: r.textContent.trim(),
                outerHTML: r.outerHTML.substring(0, 300)
            }));

            // Search for containers that enclose radio buttons
            const groups = Array.from(document.querySelectorAll('mat-radio-group, console-radio-group, [role="radiogroup"], .question, [debug-id]')).filter(el => el.innerHTML.includes('radio'));
            const groupDetails = groups.map(g => ({
                tagName: g.tagName,
                className: g.className,
                debugId: g.getAttribute('debug-id'),
                outerHTML: g.outerHTML.substring(0, 300)
            }));

            // Also search for general labels and spans next to radios
            const labels = Array.from(document.querySelectorAll('label, span')).filter(el => el.textContent.trim().toLowerCase() === 'no').map(el => ({
                tagName: el.tagName,
                className: el.className,
                text: el.textContent.trim(),
                outerHTML: el.outerHTML.substring(0, 200)
            }));

            return {
                radioCount: radios.length,
                radios: radioDetails,
                groupCount: groups.length,
                groups: groupDetails.slice(0, 10),
                labelCount: labels.length,
                labels: labels
            };
        });

        console.log("Questionnaire DOM Details:", JSON.stringify(domDetails, null, 2));

        // Take a screenshot to visualize
        await page.screenshot({ path: "questionnaire_questions_inspected.png" });
        console.log("Screenshot saved as questionnaire_questions_inspected.png");
    } catch (e) {
        console.error("Error during diagnosis:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
