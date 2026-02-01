import { parseBRCRecord, parseBRCFile } from './brc.service';
import { BRCRecord } from '../types';

describe('BRC Service', () => {
  describe('parseBRCRecord', () => {
    // Create a sample 500-byte BRC record
    const createBRCRecord = (overrides: Partial<{
      carMark: string;
      carNumber: string;
      billingDate: string;
      completionDate: string;
      shopCode: string;
      cardType: string;
      whyMadeCode: string;
      laborAmount: string;
      materialAmount: string;
      totalAmount: string;
      laborHours: string;
      jobCodes: string;
    }> = {}): string => {
      const defaults = {
        carMark: 'SHQX',
        carNumber: '006002',
        billingDate: '2026032', // Julian date: Feb 1, 2026
        completionDate: '2026030', // Jan 30, 2026
        shopCode: 'BUDE',
        cardType: '01',
        whyMadeCode: 'H1',
        laborAmount: '00015234', // $152.34 in cents
        materialAmount: '00021500', // $215.00 in cents
        totalAmount: '00036734', // $367.34 in cents
        laborHours: '0001250', // 12.50 hours in hundredths
        jobCodes: 'B1000005000P2000003500', // Two job codes
      };

      const values = { ...defaults, ...overrides };

      // Build the record - positions are 0-indexed
      let record = '';
      record += values.carMark.padEnd(4);           // 0-3
      record += values.carNumber.padEnd(6);         // 4-9
      record += values.billingDate.padEnd(7);       // 10-16
      record += values.completionDate.padEnd(7);    // 17-23
      record += values.shopCode.padEnd(4);          // 24-27
      record += values.cardType.padEnd(2);          // 28-29
      record += values.whyMadeCode.padEnd(2);       // 30-31
      record += values.laborAmount.padEnd(8);       // 32-39
      record += values.materialAmount.padEnd(8);    // 40-47
      record += values.totalAmount.padEnd(8);       // 48-55
      record += values.laborHours.padEnd(7);        // 56-62
      record += values.jobCodes.padEnd(110);        // 63-172

      // Pad to 500 bytes
      return record.padEnd(500);
    };

    it('should parse car mark and number correctly', () => {
      const record = createBRCRecord({ carMark: 'UTLX', carNumber: '123456' });
      const result = parseBRCRecord(record);

      expect(result.car_mark).toBe('UTLX');
      expect(result.car_number).toBe('123456');
      expect(result.car_id).toBe('UTLX123456');
    });

    it('should parse Julian billing date correctly', () => {
      // 2026032 = 32nd day of 2026 = Feb 1, 2026
      const record = createBRCRecord({ billingDate: '2026032' });
      const result = parseBRCRecord(record);

      expect(result.billing_date.getFullYear()).toBe(2026);
      expect(result.billing_date.getMonth()).toBe(1); // February (0-indexed)
      expect(result.billing_date.getDate()).toBe(1);
    });

    it('should parse Julian completion date correctly', () => {
      // 2026030 = 30th day of 2026 = Jan 30, 2026
      const record = createBRCRecord({ completionDate: '2026030' });
      const result = parseBRCRecord(record);

      expect(result.completion_date.getFullYear()).toBe(2026);
      expect(result.completion_date.getMonth()).toBe(0); // January
      expect(result.completion_date.getDate()).toBe(30);
    });

    it('should parse shop code correctly', () => {
      const record = createBRCRecord({ shopCode: 'ARIG' });
      const result = parseBRCRecord(record);

      expect(result.shop_code).toBe('ARIG');
    });

    it('should parse card type and why made code', () => {
      const record = createBRCRecord({ cardType: '02', whyMadeCode: 'H2' });
      const result = parseBRCRecord(record);

      expect(result.card_type).toBe('02');
      expect(result.why_made_code).toBe('H2');
    });

    it('should convert labor amount from cents to dollars', () => {
      const record = createBRCRecord({ laborAmount: '00015234' }); // $152.34
      const result = parseBRCRecord(record);

      expect(result.labor_amount).toBe(152.34);
    });

    it('should convert material amount from cents to dollars', () => {
      const record = createBRCRecord({ materialAmount: '00100000' }); // $1,000.00
      const result = parseBRCRecord(record);

      expect(result.material_amount).toBe(1000.00);
    });

    it('should convert total amount from cents to dollars', () => {
      const record = createBRCRecord({ totalAmount: '00036734' }); // $367.34
      const result = parseBRCRecord(record);

      expect(result.total_amount).toBe(367.34);
    });

    it('should convert labor hours from hundredths', () => {
      const record = createBRCRecord({ laborHours: '0001250' }); // 12.50 hours
      const result = parseBRCRecord(record);

      expect(result.labor_hours).toBe(12.50);
    });

    it('should parse job codes correctly', () => {
      // Job code format: 3 char code + 8 char amount (cents)
      const jobCodes = 'B1000005000' + 'P2000003500' + ' '.repeat(88);
      const record = createBRCRecord({ jobCodes });
      const result = parseBRCRecord(record);

      expect(result.job_codes).toHaveLength(2);
      expect(result.job_codes[0]).toEqual({ code: 'B10', amount: 50.00 });
      expect(result.job_codes[1]).toEqual({ code: 'P20', amount: 35.00 });
    });

    it('should handle empty job codes', () => {
      const record = createBRCRecord({ jobCodes: ' '.repeat(110) });
      const result = parseBRCRecord(record);

      expect(result.job_codes).toHaveLength(0);
    });

    it('should preserve raw record', () => {
      const record = createBRCRecord();
      const result = parseBRCRecord(record);

      expect(result.raw_record).toBe(record);
    });

    it('should handle trimmed values with spaces', () => {
      const record = createBRCRecord({
        carMark: 'UP  ',
        shopCode: 'TX  ',
      });
      const result = parseBRCRecord(record);

      expect(result.car_mark).toBe('UP');
      expect(result.shop_code).toBe('TX');
    });
  });

  describe('parseBRCFile', () => {
    const createBRCRecord = (carNumber: string): string => {
      let record = '';
      record += 'SHQX';                              // 0-3: car mark
      record += carNumber.padEnd(6);                 // 4-9: car number
      record += '2026032';                           // 10-16: billing date
      record += '2026030';                           // 17-23: completion date
      record += 'BUDE';                              // 24-27: shop code
      record += '01';                                // 28-29: card type
      record += 'H1';                                // 30-31: why made code
      record += '00015234';                          // 32-39: labor amount
      record += '00021500';                          // 40-47: material amount
      record += '00036734';                          // 48-55: total amount
      record += '0001250';                           // 56-62: labor hours
      record += ' '.repeat(110);                     // 63-172: job codes
      return record.padEnd(500);
    };

    it('should parse multiple continuous 500-byte records', () => {
      const content = createBRCRecord('001001') + createBRCRecord('001002') + createBRCRecord('001003');
      const results = parseBRCFile(content);

      expect(results).toHaveLength(3);
      expect(results[0].car_number).toBe('001001');
      expect(results[1].car_number).toBe('001002');
      expect(results[2].car_number).toBe('001003');
    });

    it('should parse newline-separated records', () => {
      const record1 = createBRCRecord('001001').trim();
      const record2 = createBRCRecord('001002').trim();
      const content = record1 + '\n' + record2;
      const results = parseBRCFile(content);

      expect(results).toHaveLength(2);
      expect(results[0].car_number).toBe('001001');
      expect(results[1].car_number).toBe('001002');
    });

    it('should handle Buffer input', () => {
      const content = Buffer.from(createBRCRecord('001001'));
      const results = parseBRCFile(content);

      expect(results).toHaveLength(1);
      expect(results[0].car_number).toBe('001001');
    });

    it('should skip short lines when newline-separated', () => {
      const validRecord = createBRCRecord('001001').trim();
      const content = 'short\n' + validRecord + '\n' + 'another short line\n';
      const results = parseBRCFile(content);

      // Only the valid record should be parsed (min 60 chars)
      expect(results).toHaveLength(1);
      expect(results[0].car_number).toBe('001001');
    });

    it('should return empty array for empty input', () => {
      const results = parseBRCFile('');
      expect(results).toHaveLength(0);
    });

    it('should handle partial records (less than 500 bytes at end)', () => {
      // One full record + partial data
      const content = createBRCRecord('001001') + 'PARTIAL_DATA';
      const results = parseBRCFile(content);

      // Should only parse the complete record
      expect(results).toHaveLength(1);
      expect(results[0].car_number).toBe('001001');
    });
  });

  describe('Julian date edge cases', () => {
    const createRecordWithDate = (julianDate: string): string => {
      let record = 'SHQX006002' + julianDate + julianDate;
      record += 'BUDE01H1001523400021500000367340001250';
      return record.padEnd(500);
    };

    it('should parse first day of year correctly', () => {
      const record = createRecordWithDate('2026001'); // Jan 1, 2026
      const result = parseBRCRecord(record);

      expect(result.billing_date.getMonth()).toBe(0); // January
      expect(result.billing_date.getDate()).toBe(1);
    });

    it('should parse last day of year correctly', () => {
      const record = createRecordWithDate('2026365'); // Dec 31, 2026
      const result = parseBRCRecord(record);

      expect(result.billing_date.getMonth()).toBe(11); // December
      expect(result.billing_date.getDate()).toBe(31);
    });

    it('should handle leap year correctly', () => {
      // 2024 is a leap year, day 60 = Feb 29
      const record = createRecordWithDate('2024060');
      const result = parseBRCRecord(record);

      expect(result.billing_date.getFullYear()).toBe(2024);
      expect(result.billing_date.getMonth()).toBe(1); // February
      expect(result.billing_date.getDate()).toBe(29);
    });
  });

  describe('Cost calculations', () => {
    const createRecordWithCosts = (labor: string, material: string, total: string): string => {
      let record = 'SHQX00600220260322026030BUDE01H1';
      record += labor.padStart(8, '0');
      record += material.padStart(8, '0');
      record += total.padStart(8, '0');
      record += '0001250';
      return record.padEnd(500);
    };

    it('should handle zero costs', () => {
      const record = createRecordWithCosts('0', '0', '0');
      const result = parseBRCRecord(record);

      expect(result.labor_amount).toBe(0);
      expect(result.material_amount).toBe(0);
      expect(result.total_amount).toBe(0);
    });

    it('should handle large costs', () => {
      // $999,999.99 = 99999999 cents
      const record = createRecordWithCosts('99999999', '99999999', '99999999');
      const result = parseBRCRecord(record);

      expect(result.labor_amount).toBe(999999.99);
      expect(result.material_amount).toBe(999999.99);
      expect(result.total_amount).toBe(999999.99);
    });

    it('should handle fractional cents correctly', () => {
      const record = createRecordWithCosts('1', '1', '2'); // 1 cent each
      const result = parseBRCRecord(record);

      expect(result.labor_amount).toBe(0.01);
      expect(result.material_amount).toBe(0.01);
      expect(result.total_amount).toBe(0.02);
    });
  });
});
