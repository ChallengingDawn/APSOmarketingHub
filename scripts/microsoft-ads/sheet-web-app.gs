// APSOhub - THE SHEET'S WEB APP: receives the Microsoft Advertising script's months and
// writes them into this sheet, which the hub reads with its Google service account.
// Google Apps Script (Extensions > Apps Script in the sheet), deployed as a web app that runs
// as its owner - so no sign-in token to expire. Paste in SECRET (the same as in the
// Microsoft Advertising script).

const SECRET = "PASTE THE SECRET HERE";
// Only when the script is made at script.google.com instead of from the sheet: the sheet id from its address
// (docs.google.com/spreadsheets/d/<THIS PART>/edit). From the sheet itself, leave it empty.
const SHEET_ID = "";

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.secret !== SECRET) return ContentService.createTextOutput("refused");
  // bound to the sheet (Extensions > Apps Script) it finds the sheet itself; made at script.google.com it needs SHEET_ID
  const book = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book.getSheets()[0];
  // 20.10.2026: the conversions and their value (revenue) as two more columns - "" from an older script
  const values = [["month", "impressions", "clicks", "cost", "currency", "campaigns", "account", "through", "written", "conversions", "revenue"]]
    .concat(body.rows.map((r) => [r[0], r[1], r[2], r[3], body.currency, r[4], body.account, body.through, new Date().toISOString(), r.length > 5 ? r[5] : "", r.length > 6 ? r[6] : ""]));
  sheet.clearContents();
  // the months stay text ("2026-09"), never dates
  sheet.getRange(1, 1, values.length, 1).setNumberFormat("@");
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  return ContentService.createTextOutput(`ok ${body.rows.length}`);
}
