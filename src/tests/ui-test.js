import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runUITest() {
  let browser;

  try {
    console.log('🚀 Starting UI test...');

    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Set to true for headless mode
      defaultViewport: {
        width: 1200,
        height: 800
      }
    });

    const page = await browser.newPage();

    // Navigate to the app
    console.log('📍 Navigating to localhost:1420...');
    await page.goto('http://localhost:1420', {
      waitUntil: 'networkidle2',
      timeout: 10000
    });

    // Take initial screenshot
    const screenshotDir = path.join(__dirname, '../../screenshots');
    await page.screenshot({
      path: path.join(screenshotDir, '01-initial-load.png'),
      fullPage: true
    });
    console.log('📸 Screenshot saved: 01-initial-load.png');

    // Look for the "Load Test Project" button (matching the text from FileChooser)
    console.log('🔍 Looking for Load Test Project button...');
    const testButton = await page.waitForSelector('button:has-text("Load Test Project")', {
      timeout: 5000
    }).catch(() => {
      // Fallback: look for button with loading text or primary button
      return page.waitForSelector('button.btn-primary', { timeout: 5000 });
    });

    if (!testButton) {
      throw new Error('Could not find Load Test Project button');
    }

    console.log('🖱️ Clicking Load Test Project button...');
    await testButton.click();

    // Wait for loading to complete and main screen to appear
    console.log('⏳ Waiting for main screen to load...');
    await page.waitForSelector('.navbar', { timeout: 15000 });

    // Wait a bit more for data to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot after loading
    await page.screenshot({
      path: path.join(screenshotDir, '02-main-screen.png'),
      fullPage: true
    });
    console.log('📸 Screenshot saved: 02-main-screen.png');

    // Check if devices are loaded
    const deviceElements = await page.$$('.card');
    console.log(`📊 Found ${deviceElements.length} device cards`);

    console.log('✅ UI test completed successfully!');

  } catch (error) {
    console.error('❌ UI test failed:', error.message);

    // Take error screenshot
    if (browser) {
      const page = (await browser.pages())[0];
      if (page) {
        await page.screenshot({
          path: path.join(__dirname, '../../screenshots/error.png'),
          fullPage: true
        });
        console.log('📸 Error screenshot saved: error.png');
      }
    }

    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  runUITest()
    .then(() => {
      console.log('🎉 Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

export { runUITest };