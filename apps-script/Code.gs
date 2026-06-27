const SPREADSHEET_ID = "1xhmhIZJefP8hgZIMb6w7xTpWbtGrGBoOkMsBGIFl5xQ";
const TOPICS_SHEET_NAME = "기도제목";
const ENTRIES_SHEET_NAME = "기도기록";

const TOPIC_HEADERS = ["id", "title", "description", "position", "updatedAt"];
const ENTRY_HEADERS = ["id", "topicId", "date", "body", "createdAt", "updatedAt"];

function doGet(event) {
  try {
    ensureSheets();
    const action = event.parameter.action || "load";

    if (action === "load") {
      return jsonResponse({
        ok: true,
        topics: loadTopics(),
      });
    }

    return jsonResponse({ ok: false, error: "Unknown action" });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  }
}

function doPost(event) {
  try {
    ensureSheets();
    const payload = JSON.parse(event.postData.contents || "{}");

    if (payload.action === "saveState") {
      saveState(payload.topics || []);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: "Unknown action" });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  }
}

function loadTopics() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const topicsSheet = spreadsheet.getSheetByName(TOPICS_SHEET_NAME);
  const entriesSheet = spreadsheet.getSheetByName(ENTRIES_SHEET_NAME);

  const topicRows = readRows(topicsSheet);
  const entryRows = readRows(entriesSheet);
  const entriesByTopic = {};

  entryRows.forEach((row) => {
    const entry = {
      id: String(row.id || ""),
      date: normalizeDate(row.date),
      verse: "",
      body: row.body || "",
      createdAt: row.createdAt || new Date().toISOString(),
      updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
    };

    if (!entriesByTopic[row.topicId]) {
      entriesByTopic[row.topicId] = [];
    }
    entriesByTopic[row.topicId].push(entry);
  });

  return topicRows
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
    .map((row) => ({
      id: String(row.id || ""),
      title: row.title || "기도제목",
      description: row.description || "",
      entries: (entriesByTopic[row.id] || []).sort((a, b) => b.date.localeCompare(a.date)),
    }));
}

function saveState(topics) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const topicsSheet = spreadsheet.getSheetByName(TOPICS_SHEET_NAME);
    const entriesSheet = spreadsheet.getSheetByName(ENTRIES_SHEET_NAME);
    const now = new Date().toISOString();

    const topicRows = topics.map((topic, index) => [
      topic.id,
      topic.title || "",
      topic.description || "",
      index,
      now,
    ]);

    const entryRows = topics.flatMap((topic) =>
      (topic.entries || []).map((entry) => [
        entry.id,
        topic.id,
        entry.date || "",
        entry.body || entry.verse || "",
        entry.createdAt || now,
        entry.updatedAt || now,
      ]),
    );

    writeRows(topicsSheet, TOPIC_HEADERS, topicRows);
    writeRows(entriesSheet, ENTRY_HEADERS, entryRows);
  } finally {
    lock.releaseLock();
  }
}

function ensureSheets() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureSheet(spreadsheet, TOPICS_SHEET_NAME, TOPIC_HEADERS);
  ensureSheet(spreadsheet, ENTRIES_SHEET_NAME, ENTRY_HEADERS);
}

function ensureSheet(spreadsheet, sheetName, headers) {
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeaders = headers.every((header, index) => firstRow[index] === header);

  if (!hasHeaders) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function readRows(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];
  return values.slice(1).filter(rowHasValue).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });
    return item;
  });
}

function writeRows(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function rowHasValue(row) {
  return row.some((cell) => String(cell).trim() !== "");
}

function normalizeDate(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const parsed = new Date(text);
  if (!isNaN(parsed)) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  return text;
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
