import { logger } from '../utils/logger';
import { ExportFormat, QueryResult } from '../models/types';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export class ExportService {
  async exportData(
    data: Record<string, unknown>[],
    format: ExportFormat,
    options?: {
      title?: string;
      filename?: string;
      columns?: Array<{ field: string; header: string; width?: number }>;
    }
  ): Promise<Buffer> {
    logger.info('Exporting data', { format, rowCount: data.length });

    switch (format) {
      case 'csv':
        return this.exportToCsv(data, options);
      case 'excel':
        return this.exportToExcel(data, options);
      case 'pdf':
        return this.exportToPdf(data, options);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async exportToCsv(
    data: Record<string, unknown>[],
    options?: { columns?: Array<{ field: string; header: string }> }
  ): Promise<Buffer> {
    if (data.length === 0) {
      return Buffer.from('');
    }

    const columns = options?.columns || this.inferColumns(data);
    const headers = columns.map(c => this.escapeCsvValue(c.header));
    const lines = [headers.join(',')];

    for (const row of data) {
      const values = columns.map(c => {
        const value = row[c.field];
        return this.escapeCsvValue(this.formatValue(value));
      });
      lines.push(values.join(','));
    }

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  private async exportToExcel(
    data: Record<string, unknown>[],
    options?: { title?: string; columns?: Array<{ field: string; header: string; width?: number }> }
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WebWaka CB-2 Analytics';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(options?.title || 'Report');

    const columns = options?.columns || this.inferColumns(data);
    
    worksheet.columns = columns.map(c => ({
      header: c.header,
      key: c.field,
      width: (c as { field: string; header: string; width?: number }).width || 15,
    }));

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const row of data) {
      const rowData: Record<string, unknown> = {};
      for (const col of columns) {
        rowData[col.field] = this.formatValue(row[col.field]);
      }
      worksheet.addRow(rowData);
    }

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private exportToPdf(
    data: Record<string, unknown>[],
    options?: { title?: string; columns?: Array<{ field: string; header: string }> }
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.fontSize(18).font('Helvetica-Bold').text(options?.title || 'Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
        doc.moveDown(2);

        const columns = options?.columns || this.inferColumns(data);
        const pageWidth = doc.page.width - 100;
        const colWidth = pageWidth / columns.length;
        const startX = 50;
        let y = doc.y;

        doc.font('Helvetica-Bold').fontSize(9);
        columns.forEach((col, i) => {
          doc.text(col.header, startX + i * colWidth, y, { width: colWidth - 5, align: 'left' });
        });

        y = doc.y + 5;
        doc.moveTo(startX, y).lineTo(startX + pageWidth, y).stroke();
        y += 10;

        doc.font('Helvetica').fontSize(8);
        const maxRows = Math.min(data.length, 50);

        for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
          const row = data[rowIndex];
          
          if (y > doc.page.height - 100) {
            doc.addPage();
            y = 50;
          }

          columns.forEach((col, i) => {
            const value = this.formatValue(row[col.field]);
            const text = String(value).substring(0, 30);
            doc.text(text, startX + i * colWidth, y, { width: colWidth - 5, align: 'left' });
          });

          y = doc.y + 5;
        }

        if (data.length > maxRows) {
          doc.moveDown();
          doc.fontSize(10).text(`... and ${data.length - maxRows} more rows`, { align: 'center' });
        }

        doc.moveDown(2);
        doc.fontSize(8).text(`Total rows: ${data.length}`, { align: 'right' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private inferColumns(data: Record<string, unknown>[]): Array<{ field: string; header: string }> {
    if (data.length === 0) return [];

    const firstRow = data[0];
    return Object.keys(firstRow).map(key => ({
      field: key,
      header: this.formatHeader(key),
    }));
  }

  private formatHeader(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

export const exportService = new ExportService();
