const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');

async function parseFile(filePath, filename) {
  const ext = path.extname(filename).toLowerCase();

  switch (ext) {
    case '.pdf':
      return await parsePDF(filePath, filename);
    case '.docx':
    case '.doc':
      return await parseDOCX(filePath, filename);
    case '.txt':
    case '.md':
      return parseTXT(filePath, filename);
    case '.xlsx':
    case '.xls':
    case '.csv':
      return parseXLSX(filePath, filename);
    default:
      throw new Error(`Unsupported file type: ${ext}. Supported: PDF, DOCX, TXT, MD, XLSX, CSV`);
  }
}

async function parsePDF(filePath, filename) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return {
    text: data.text,
    pages: data.numpages,
    filename,
    type: 'pdf',
    wordCount: data.text.split(/\s+/).length,
  };
}

async function parseDOCX(filePath, filename) {
  const result = await mammoth.extractRawText({ path: filePath });
  return {
    text: result.value,
    filename,
    type: 'docx',
    wordCount: result.value.split(/\s+/).length,
  };
}

function parseTXT(filePath, filename) {
  const text = fs.readFileSync(filePath, 'utf-8');
  return {
    text,
    filename,
    type: 'txt',
    wordCount: text.split(/\s+/).length,
  };
}

function parseXLSX(filePath, filename) {
  const workbook = XLSX.readFile(filePath);
  let allText = '';

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    allText += `\n=== Sheet: ${sheetName} ===\n${csv}\n`;
  });

  return {
    text: allText,
    filename,
    type: 'xlsx',
    sheets: workbook.SheetNames.length,
    wordCount: allText.split(/\s+/).length,
  };
}

module.exports = { parseFile };
