// APSOhub - THE SHEET'S WEB APP: receives the Microsoft Advertising script's months and
// writes them into this sheet, which the hub reads with its Google service account.
// Google Apps Script (Extensions > Apps Script in the sheet), deployed as a web app that runs
// as its owner - so no sign-in token to expire. Paste in SECRET (the same as in the
// Microsoft Advertising script).

const SECRET = "PASTE THE SECRET HERE";

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.secret !== SECRET) return ContentService.createTextOutput("refused");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const values = [["month", "impressions", "clicks", "cost", "currency", "campaigns", "account", "through", "written"]]
    .concat(body.rows.map((r) => [r[0], r[1], r[2], r[3], body.currency, r[4], body.account, body.through, new Date().toISOString()]));
  sheet.clearContents();
  // the months stay text ("2026-09"), never dates
  sheet.getRange(1, 1, values.length, 1).setNumberFormat("@");
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  return ContentService.createTextOutput(`ok ${body.rows.length}`);
}
