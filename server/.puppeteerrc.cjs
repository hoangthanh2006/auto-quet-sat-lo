const { join } = require('path');

/**
 * Configuration file for Puppeteer
 * Ensures Chrome is installed inside the project cache directory on Render/Linux
 */
module.exports = {
  // Changes the cache location for Puppeteer.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
