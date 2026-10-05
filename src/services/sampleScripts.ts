import { AppsScriptProject } from '../types';

export const SAMPLE_SHEETS_SCRIPTS: AppsScriptProject[] = [
  {
    scriptId: '1DEMO_SHEET_AUTOMATION_SCRIPT_777',
    title: 'Orders & Inventory Sync Automation',
    parentTitle: 'E-Commerce Orders & Warehouse 2026.xlsx',
    parentId: '1Spreadsheet_Orders_Demo_2026',
    lastModified: new Date().toISOString(),
    files: [
      {
        name: 'Code',
        type: 'SERVER_JS',
        source: `/**
 * Google Sheets Real-time Inventory & Order Processor
 * Automatically calculates totals, syncs status, and sends webhooks.
 */

function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;
  
  // Check if modified sheet is 'Orders' and column is 'Status' (Col 4)
  if (sheet.getName() === 'Orders' && range.getColumn() === 4) {
    const newValue = e.value;
    const row = range.getRow();
    const orderId = sheet.getRange(row, 1).getValue();
    
    Logger.log('Order #' + orderId + ' updated to: ' + newValue);
    notifyWarehouse(orderId, newValue);
  }
}

function syncInventoryWithDrive() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inventorySheet = ss.getSheetByName('Inventory');
  if (!inventorySheet) return;
  
  const data = inventorySheet.getDataRange().getValues();
  Logger.log('Total inventory items: ' + (data.length - 1));
}

function notifyWarehouse(orderId, status) {
  // Webhook integration
  const payload = {
    orderId: orderId,
    status: status,
    timestamp: new Date().toISOString()
  };
  Logger.log('Payload dispatched: ' + JSON.stringify(payload));
}
`,
      },
      {
        name: 'ReportsHelper',
        type: 'SERVER_JS',
        source: `/**
 * Helper utilities for generating weekly sales summaries and backups.
 */

function generateWeeklySummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const orders = ss.getSheetByName('Orders');
  if (!orders) return;
  
  const lastRow = orders.getLastRow();
  Logger.log('Generating summary for ' + lastRow + ' rows.');
}

function exportCsvBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const csv = sheet.getDataRange().getValues().map(r => r.join(',')).join('\\n');
  return csv;
}
`,
      },
      {
        name: 'appsscript',
        type: 'JSON',
        source: `{
  "timeZone": "Europe/Moscow",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}`,
      },
    ],
  },
  {
    scriptId: '1DEMO_LEADS_PIPELINE_SCRIPT_888',
    title: 'CRM Leads & Telegram Notifier',
    parentTitle: 'Sales CRM & Marketing Pipeline.xlsx',
    parentId: '1Spreadsheet_CRM_Pipeline_2026',
    lastModified: new Date(Date.now() - 3600000 * 4).toISOString(),
    files: [
      {
        name: 'Main',
        type: 'SERVER_JS',
        source: `/**
 * CRM Leads Processor & Telegram Bot Integration
 */
const TELEGRAM_BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE';
const CHAT_ID = 'YOUR_CHAT_ID_HERE';

function onFormSubmit(e) {
  const responses = e.namedValues;
  const leadName = responses['Name'] ? responses['Name'][0] : 'New Lead';
  const email = responses['Email'] ? responses['Email'][0] : 'N/A';
  const phone = responses['Phone'] ? responses['Phone'][0] : 'N/A';
  
  const message = '🎯 *Новая заявка с сайта!*\\n' +
                  '👤 Имя: ' + leadName + '\\n' +
                  '📧 Email: ' + email + '\\n' +
                  '📱 Телефон: ' + phone;
                  
  sendTelegramMessage(message);
}

function sendTelegramMessage(text) {
  const url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';
  const payload = {
    chat_id: CHAT_ID,
    text: text,
    parse_mode: 'Markdown'
  };
  Logger.log('Sending message to Telegram: ' + text);
}
`,
      },
      {
        name: 'appsscript',
        type: 'JSON',
        source: `{
  "timeZone": "UTC",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}`,
      },
    ],
  },
];
