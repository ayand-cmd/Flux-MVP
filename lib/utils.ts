/**
 * Extracts the Spreadsheet ID from a Google Sheets URL or returns the ID if already provided.
 * 
 * @param input - A full Google Sheets URL or just the spreadsheet ID
 * @returns The extracted spreadsheet ID, or the input if it's already just an ID
 * 
 * @example
 * extractSheetId('https://docs.google.com/spreadsheets/d/1BxiMvs0XRA5nFNd/edit#gid=0')
 * // Returns: '1BxiMvs0XRA5nFNd'
 * 
 * @example
 * extractSheetId('1BxiMvs0XRA5nFNd')
 * // Returns: '1BxiMvs0XRA5nFNd'
 */
export function extractSheetId(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  // If it's already just an ID (no slashes or protocol), return as is
  if (!input.includes('/') && !input.includes('://')) {
    return input.trim();
  }

  // Try to extract ID from Google Sheets URL pattern
  // Pattern: /spreadsheets/d/{ID}/ or /spreadsheets/d/{ID}#
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  
  if (match && match[1]) {
    return match[1];
  }

  // If no match found, return the input as-is (might be malformed, but let the caller handle it)
  return input.trim();
}

