/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Curated Google Apps Script API surface for editor intelligence:
 * the TypeScript lib below silences "cannot find name" for the common
 * services and powers method-name autocompletion.
 */

export const APPS_SCRIPT_API_LIB = `
declare namespace SpreadsheetApp {
  function getActiveSpreadsheet(): any;
  function openById(id: string): any;
  function openByUrl(url: string): any;
  function create(name: string): any;
  function getUi(): any;
  function newDataValidation(): any;
}
declare namespace DriveApp {
  function getFiles(): any;
  function getFolders(): any;
  function getFolderById(id: string): any;
  function getFileById(id: string): any;
  function createFolder(name: string): any;
  function createFile(name: string, content: string): any;
  function searchFiles(params: string): any;
  function searchFolders(params: string): any;
  function getStorageLimit(): number;
  function getStorageUsed(): number;
}
declare namespace DocumentApp {
  function openById(id: string): any;
  function create(name: string): any;
  function getUi(): any;
}
declare namespace SlidesApp {
  function openById(id: string): any;
  function create(name: string): any;
  function getUi(): any;
}
declare namespace FormApp {
  function openById(id: string): any;
  function create(name: string): any;
}
declare namespace GmailApp {
  function sendEmail(to: string, subject: string, body: string): void;
  function search(query: string): any;
  function getInboxThreads(start?: number, max?: number): any[];
  function getMessageById(id: string): any;
}
declare namespace CalendarApp {
  function getDefaultCalendar(): any;
  function getCalendarById(id: string): any;
  function create(name: string): any;
}
declare namespace MailApp {
  function sendEmail(to: string, subject: string, body: string): void;
  function getRemainingDailyQuota(): number;
}
declare namespace UrlFetchApp {
  function fetch(url: string, params?: any): any;
  function fetchAll(requests: any[]): any[];
}
declare namespace Utilities {
  function sleep(ms: number): void;
  function base64Encode(data: any): string;
  function base64Decode(data: string): any;
  function computeDigest(algorithm: any, value: any): any;
  function formatDate(date: Date, timeZone: string, format: string): string;
  function newUuid(): string;
  function jsonParse(json: string): any;
  function jsonStringify(obj: any): string;
}
declare namespace Session {
  function getActiveUser(): any;
  function getEffectiveUser(): any;
  function getScriptTimeZone(): string;
  function getTemporaryActiveUserKey(): string;
}
declare namespace PropertiesService {
  function getScriptProperties(): any;
  function getUserProperties(): any;
  function getDocumentProperties(): any;
}
declare namespace ScriptApp {
  function getOAuthToken(): string;
  function getService(): any;
  function newTrigger(functionName: string): any;
  function getProjectTriggers(): any[];
  function deleteTrigger(trigger: any): void;
  function getUserTriggers(document: any): any[];
}
declare namespace HtmlService {
  function createHtmlOutput(html?: string): any;
  function createTemplateFromFile(name: string): any;
  function createHtmlOutputFromFile(name: string): any;
  function XFrameOptionsMode: any;
}
declare namespace ContentService {
  function createTextOutput(content: string): any;
  function createJsonOutput(obj: any): any;
}
declare namespace LockService {
  function getScriptLock(): any;
  function getUserLock(): any;
  function getDocumentLock(): any;
}
declare namespace CacheService {
  function getScriptCache(): any;
  function getUserCache(): any;
  function getDocumentCache(): any;
}
declare namespace XmlService {
  function parse(text: string): any;
  function createElement(name: string): any;
  function generate(document: any): string;
}
declare namespace Logger {
  function log(data: any): void;
  function clear(): void;
  function getLog(): string;
}
declare namespace BigQuery {
  function newQuery(): any;
  function query(query: string, projectId?: string): any;
  function insertAll(projectId: string, datasetId: string, tableId: string, rows: any): any;
}
declare namespace Maps {
  function newDirectionFinder(): any;
  function newGeocoder(): any;
  function staticMap(): any;
}
declare namespace HtmlService {}
declare const console: any;
`;

/** Global service names offered as top-level completions. */
export const APPS_SCRIPT_SERVICES = [
  'SpreadsheetApp',
  'DriveApp',
  'DocumentApp',
  'SlidesApp',
  'FormApp',
  'GmailApp',
  'CalendarApp',
  'MailApp',
  'UrlFetchApp',
  'Utilities',
  'Session',
  'PropertiesService',
  'ScriptApp',
  'HtmlService',
  'ContentService',
  'LockService',
  'CacheService',
  'XmlService',
  'Logger',
  'BigQuery',
  'Maps'
];
