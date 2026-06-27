# Google Sheets Sync Setup

1. Open the Google Sheet.
2. Go to `Extensions > Apps Script`.
3. Replace the default script with `apps-script/Code.gs`.
4. Click `Deploy > New deployment`.
5. Select type `Web app`.
6. Set `Execute as` to `Me`.
7. Set `Who has access` to `Anyone with the link`.
8. Deploy and copy the Web app URL.
9. Paste that URL into `SHEET_API_URL` at the top of `app.js`.

The script creates and uses two sheets:

- `기도제목`
- `기도기록`

If `SHEET_API_URL` is empty, the app keeps using local browser storage only.
