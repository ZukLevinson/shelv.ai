import assert from 'node:assert';
import {
  HEADERS,
  ACTION_HEADERS,
  applySheetFormatting,
  formatAllSheets,
} from '../src/services/googleSheetsService.js';

console.log('--- Starting Google Sheets Formatting Verification Test ---');

// 1. Verify headers array parity
assert.strictEqual(HEADERS.length, 16, 'Expected 16 headers for scans tab');
assert.strictEqual(ACTION_HEADERS.length, 10, 'Expected 10 headers for actions tab');

// 2. Mock Google Sheets API client to verify batchUpdate requests generated
const sentRequests: any[] = [];
const mockClient: any = {
  spreadsheets: {
    get: async () => ({
      data: {
        sheets: [
          {
            properties: { sheetId: 0, title: 'סריקות' },
            bandedRanges: [{ bandedRangeId: 101 }],
            conditionalFormats: [{ rule: {} }],
          },
          {
            properties: { sheetId: 12345, title: 'יומן פעולות סריקה' },
            bandedRanges: [],
            conditionalFormats: [],
          },
        ],
      },
    }),
    batchUpdate: async ({ spreadsheetId, requestBody }: any) => {
      sentRequests.push(...requestBody.requests);
      return { data: { replies: [] } };
    },
  },
};

// Test scans tab formatting
(async () => {
  const scansSuccess = await applySheetFormatting(mockClient, 'test-spreadsheet-id', 'scans');
  assert.strictEqual(scansSuccess, true, 'Expected applySheetFormatting for scans to succeed');

  // Verify cleanup requests were sent
  const deleteBandingReq = sentRequests.find((r) => r.deleteBanding);
  assert.ok(deleteBandingReq, 'Expected deleteBanding request during cleanup');
  assert.strictEqual(deleteBandingReq.deleteBanding.bandedRangeId, 101);

  const deleteCondRuleReq = sentRequests.find((r) => r.deleteConditionalFormatRule);
  assert.ok(deleteCondRuleReq, 'Expected deleteConditionalFormatRule request during cleanup');

  // Verify RTL & Frozen row
  const updatePropsReq = sentRequests.find((r) => r.updateSheetProperties);
  assert.ok(updatePropsReq, 'Expected updateSheetProperties request');
  assert.strictEqual(updatePropsReq.updateSheetProperties.properties.rightToLeft, true, 'Expected RTL to be true');
  assert.strictEqual(updatePropsReq.updateSheetProperties.properties.gridProperties.frozenRowCount, 1, 'Expected frozen row count to be 1');
  assert.strictEqual(updatePropsReq.updateSheetProperties.properties.gridProperties.hideGridlines, false, 'Expected hideGridlines to be false');

  // Verify Native Basic Filter
  const filterReq = sentRequests.find((r) => r.setBasicFilter);
  assert.ok(filterReq, 'Expected setBasicFilter request');
  assert.strictEqual(filterReq.setBasicFilter.filter.range.sheetId, 0);
  assert.strictEqual(filterReq.setBasicFilter.filter.range.endColumnIndex, 16);

  // Verify Zebra Banding
  const bandingReq = sentRequests.find((r) => r.addBanding);
  assert.ok(bandingReq, 'Expected addBanding request');
  assert.strictEqual(bandingReq.addBanding.bandedRange.range.endColumnIndex, 16);

  // Verify Conditional Format Rules (Green, Amber, Red)
  const condRules = sentRequests.filter((r) => r.addConditionalFormatRule);
  assert.ok(condRules.length >= 3, 'Expected at least 3 conditional format rules');

  const matchRule = condRules.find((r) =>
    r.addConditionalFormatRule.rule.booleanRule?.condition?.values?.[0]?.userEnteredValue === 'תואם חתימה'
  );
  assert.ok(matchRule, 'Expected conditional rule for "תואם חתימה"');

  const mismatchRule = condRules.find((r) =>
    r.addConditionalFormatRule.rule.booleanRule?.condition?.values?.[0]?.userEnteredValue === 'חריגת מיקום / חתימה'
  );
  assert.ok(mismatchRule, 'Expected conditional rule for "חריגת מיקום / חתימה"');

  const unlistedRule = condRules.find((r) =>
    r.addConditionalFormatRule.rule.booleanRule?.condition?.values?.[0]?.userEnteredValue === 'לא רשום באקסל'
  );
  assert.ok(unlistedRule, 'Expected conditional rule for "לא רשום באקסל"');

  // Test formatAllSheets
  sentRequests.length = 0;
  const allSuccess = await formatAllSheets(mockClient);
  assert.strictEqual(allSuccess, true, 'Expected formatAllSheets to succeed');

  console.log('✨ All Google Sheets formatting, RTL, filters, and styling logic verified successfully!');
})();
