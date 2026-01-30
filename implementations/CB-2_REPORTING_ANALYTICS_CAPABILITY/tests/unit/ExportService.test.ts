import { ExportService } from '../../src/services/ExportService';

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    service = new ExportService();
  });

  describe('exportToCsv', () => {
    it('should export data to CSV format', async () => {
      const data = [
        { name: 'Product A', revenue: 1000, quantity: 50 },
        { name: 'Product B', revenue: 2000, quantity: 100 },
      ];

      const buffer = await service.exportData(data, 'csv');
      const csv = buffer.toString('utf-8');

      expect(csv).toContain('Name,Revenue,Quantity');
      expect(csv).toContain('Product A,1000,50');
      expect(csv).toContain('Product B,2000,100');
    });

    it('should handle empty data', async () => {
      const buffer = await service.exportData([], 'csv');

      expect(buffer.toString('utf-8')).toBe('');
    });

    it('should escape CSV special characters', async () => {
      const data = [
        { name: 'Product, With Comma', description: 'Has "quotes"' },
      ];

      const buffer = await service.exportData(data, 'csv');
      const csv = buffer.toString('utf-8');

      expect(csv).toContain('"Product, With Comma"');
      expect(csv).toContain('"Has ""quotes"""');
    });
  });

  describe('exportToExcel', () => {
    it('should export data to Excel format', async () => {
      const data = [
        { name: 'Product A', revenue: 1000 },
        { name: 'Product B', revenue: 2000 },
      ];

      const buffer = await service.exportData(data, 'excel', {
        title: 'Sales Report',
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer[0]).toBe(0x50); // PK magic number for xlsx
    });

    it('should use custom columns', async () => {
      const data = [
        { product_name: 'A', total_revenue: 1000 },
      ];

      const buffer = await service.exportData(data, 'excel', {
        columns: [
          { field: 'product_name', header: 'Product Name', width: 20 },
          { field: 'total_revenue', header: 'Total Revenue', width: 15 },
        ],
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('exportToPdf', () => {
    it('should export data to PDF format', async () => {
      const data = [
        { name: 'Product A', revenue: 1000 },
        { name: 'Product B', revenue: 2000 },
      ];

      const buffer = await service.exportData(data, 'pdf', {
        title: 'Sales Report',
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.toString('utf-8', 0, 4)).toBe('%PDF');
    });

    it('should handle large datasets', async () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random() * 1000,
      }));

      const buffer = await service.exportData(data, 'pdf', {
        title: 'Large Report',
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should throw error for unsupported format', async () => {
      await expect(service.exportData([], 'xml' as any))
        .rejects.toThrow('Unsupported export format: xml');
    });
  });
});
