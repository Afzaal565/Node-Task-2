const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Helper function for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to wait for navigation with retry logic
async function waitForNavigationWithRetry(page, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await page.waitForNavigation({
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            return;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            console.log(`Navigation retry attempt ${i + 1}`);
            await delay(1000);
        }
    }
}

app.post('/search', async (req, res) => {
    let browser = null;
    
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--window-size=1920x1080'
            ]
        });

        const page = await browser.newPage();
        
        // Set viewport and user agent
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Set longer default timeout
        page.setDefaultNavigationTimeout(30000);
        page.setDefaultTimeout(30000);

        console.log('Navigating to Google...');
        await page.goto('https://www.google.com', {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        console.log('Landed on Google');

        // Handle consent form if it appears
        try {
            const consentButton = await page.$('button[aria-label="Accept all"], button[jsname="b3VHJd"]');
            if (consentButton) {
                await consentButton.click();
                await delay(2000);
            }
        } catch (e) {
            console.log('No consent form found, continuing...');
        }

        // Wait for and find the search box
        console.log('Waiting for search box...');
        await page.waitForSelector('textarea[name="q"]', { visible: true });
        console.log('Found search box, typing query...');
        
        // Clear the search box first
        await page.evaluate(() => {
            document.querySelector('textarea[name="q"]').value = '';
        });
        
        await page.type('textarea[name="q"]', query);
        
        // Submit search
        console.log('Submitting search...');
        await Promise.all([
            page.keyboard.press('Enter'),
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 })
        ]);

        // Wait for results to stabilize
        await delay(3000);

        console.log('Extracting results...');
        const searchResults = await page.evaluate(() => {
            const results = [];
            // Try both old and new selectors
            const elements = Array.from(document.querySelectorAll('div.g, [data-sokoban-container], div[data-header-feature="0"]'));
            
            elements.forEach(element => {
                const titleElement = element.querySelector('h3, [role="heading"]');
                const linkElement = element.querySelector('a');
                const snippetElement = element.querySelector('[data-content-feature="1"], .VwiC3b, .s');
                
                if (titleElement && linkElement) {
                    const url = linkElement.href;
                    // Filter out non-search results
                    if (!url.includes('google.com/search') && !url.includes('webcache.googleusercontent')) {
                        results.push({
                            title: titleElement.textContent.trim(),
                            url: url,
                            snippet: snippetElement ? snippetElement.textContent.trim() : ''
                        });
                    }
                }
            });
            
            return results.slice(0, 10);
        });

        console.log(`Found ${searchResults.length} results`);

        if (searchResults.length === 0) {
            // Take a screenshot for debugging
            await page.screenshot({ 
                path: 'debug-screenshot.png',
                fullPage: true 
            });
            throw new Error('No search results found. Google might have changed their page structure.');
        }
        
        await browser.close();
        browser = null;
        
        res.json({
            query,
            results: searchResults
        });
        
    } catch (error) {
        console.error('Search error:', error);
        
        // Take error screenshot if browser is still open
        if (browser) {
            try {
                const page = (await browser.pages())[0];
                await page.screenshot({ 
                    path: 'error-screenshot.png',
                    fullPage: true 
                });
            } catch (screenshotError) {
                console.error('Failed to take error screenshot:', screenshotError);
            }
        }
        
        res.status(500).json({ 
            error: 'Failed to perform search',
            details: error.message 
        });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});