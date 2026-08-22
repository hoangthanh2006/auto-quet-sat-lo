import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT_FOLDER_ID = '1qyM-4r0aBiyVmRDotRARVg6WVUKAGAJC';
const CONFIG_FILE_PATH = path.join(__dirname, 'driveConfig.json');
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'service-account.json');

let driveClient = null;
let currentConfig = {
  rootFolderId: DEFAULT_ROOT_FOLDER_ID,
  hasCredentials: false,
  clientEmail: null
};

// Load saved config if exists
function loadSavedConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf-8'));
      if (data.rootFolderId) currentConfig.rootFolderId = data.rootFolderId;
    }
  } catch (e) {
    console.error('Error reading driveConfig.json:', e.message);
  }
}
loadSavedConfig();

/**
 * Initializes Google Drive API client using Service Account credentials
 */
export function getDriveClient() {
  if (driveClient) return driveClient;

  let credentials = null;

  // 1. Check env variable
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      console.error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON env var');
    }
  }

  // 2. Check local service-account.json file
  if (!credentials && fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    try {
      credentials = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
    } catch (e) {
      console.error('Error parsing service-account.json:', e.message);
    }
  }

  // 3. Check driveConfig.json saved via API
  if (!credentials && fs.existsSync(CONFIG_FILE_PATH)) {
    try {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf-8'));
      if (saved.credentials) {
        credentials = saved.credentials;
      }
    } catch (e) {}
  }

  if (!credentials || !credentials.client_email || !credentials.private_key) {
    currentConfig.hasCredentials = false;
    currentConfig.clientEmail = null;
    return null;
  }

  try {
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
    );

    driveClient = google.drive({ version: 'v3', auth });
    currentConfig.hasCredentials = true;
    currentConfig.clientEmail = credentials.client_email;
    return driveClient;
  } catch (err) {
    console.error('Failed to create Drive auth JWT:', err.message);
    currentConfig.hasCredentials = false;
    return null;
  }
}

/**
 * Save Service Account JSON credentials or Root Folder ID
 */
export function saveDriveConfig(newConfig = {}) {
  try {
    const existing = fs.existsSync(CONFIG_FILE_PATH)
      ? JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf-8'))
      : {};

    const updated = {
      ...existing,
      ...newConfig,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(updated, null, 2), 'utf-8');

    // Reset drive client so it re-initializes
    driveClient = null;
    getDriveClient();

    return { success: true, config: getDriveStatus() };
  } catch (err) {
    console.error('Error saving drive config:', err);
    throw new Error(`Failed to save Drive config: ${err.message}`);
  }
}

/**
 * Get current Google Drive connection status
 */
export function getDriveStatus() {
  getDriveClient(); // ensure checked
  return {
    rootFolderId: currentConfig.rootFolderId,
    hasCredentials: currentConfig.hasCredentials,
    clientEmail: currentConfig.clientEmail,
    targetFolderUrl: `https://drive.google.com/drive/folders/${currentConfig.rootFolderId}`
  };
}

/**
 * Ensures a subfolder exists inside parentId, creates if missing
 */
async function ensureSubFolder(drive, parentId, folderName) {
  try {
    const query = `'${parentId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id;
    }

    // Create folder if not found
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    };

    const created = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id, name'
    });

    return created.data.id;
  } catch (err) {
    console.error(`Error ensuring subfolder '${folderName}' in parent '${parentId}':`, err.message);
    throw err;
  }
}

/**
 * Get or create YYYY/MM/DD folder path under rootFolderId
 */
export async function getOrCreateDateFolderPath(rootFolderId = currentConfig.rootFolderId) {
  const drive = getDriveClient();
  if (!drive) {
    throw new Error('Chưa cấu hình Service Account Google Drive. Vui lòng thêm file service-account.json hoặc dán JSON key trong phần cài đặt.');
  }

  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  console.log(`Building Drive folder hierarchy: ${rootFolderId} -> ${year} -> ${month} -> ${day}`);

  // 1. Year folder
  const yearFolderId = await ensureSubFolder(drive, rootFolderId, year);
  // 2. Month folder
  const monthFolderId = await ensureSubFolder(drive, yearFolderId, month);
  // 3. Day folder
  const dayFolderId = await ensureSubFolder(drive, monthFolderId, day);

  return {
    dayFolderId,
    path: `${year}/${month}/${day}`
  };
}

/**
 * Upload file to Google Drive under YYYY/MM/DD path
 */
export async function uploadToDrive({ fileName, content, mimeType = 'text/csv' }) {
  const drive = getDriveClient();
  if (!drive) {
    throw new Error('Chưa cấu hình Service Account Google Drive. Vui lòng tải lên file Service Account JSON.');
  }

  const { dayFolderId, path: folderPath } = await getOrCreateDateFolderPath();

  // Create stream from content
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const fileMetadata = {
    name: fileName,
    parents: [dayFolderId]
  };

  const media = {
    mimeType,
    body: stream
  };

  console.log(`Uploading file '${fileName}' to Google Drive path ${folderPath}...`);

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, name, webViewLink, webContentLink'
  });

  console.log(`File uploaded successfully to Google Drive. File ID: ${file.data.id}`);

  return {
    success: true,
    fileId: file.data.id,
    fileName: file.data.name,
    folderPath,
    webViewLink: file.data.webViewLink || `https://drive.google.com/file/d/${file.data.id}/view`,
    webContentLink: file.data.webContentLink
  };
}
