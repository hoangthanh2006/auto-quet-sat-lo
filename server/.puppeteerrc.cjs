const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Store Puppeteer cache inside the server directory so it persists on Render
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
