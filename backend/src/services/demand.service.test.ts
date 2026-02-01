import { Demand, DemandStatus, DemandPriority, EventType } from '../types';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
}));

import { query, queryOne } from '../config/database';
import {
  listDemands,
  getDemandById,
  createDemand,
  updateDemand,
  updateDemandStatus,
  deleteDemand,
} from './demand.service';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;

describe('Demand Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sampleDemand: Demand = {
    id: 'demand-123',
    name: 'Q2 Tank Qualifications',
    description: 'Quarterly tank qualification batch',
    fiscal_year: 2026,
    target_month: '2026-04',
    car_count: 50,
    event_type: 'Qualification' as EventType,
    car_type: 'General Service Tank',
    priority: 'Medium' as DemandPriority,
    status: 'Forecast' as DemandStatus,
    created_at: new Date('2026-01-15'),
    updated_at: new Date('2026-01-15'),
  };

  describe('listDemands', () => {
    it('should return demands with total count', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '2' });
      mockQuery.mockResolvedValueOnce([sampleDemand, { ...sampleDemand, id: 'demand-456' }]);

      const result = await listDemands({ fiscal_year: 2026 });

      expect(result.total).toBe(2);
      expect(result.demands).toHaveLength(2);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)'),
        [2026]
      );
    });

    it('should apply status filter', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '1' });
      mockQuery.mockResolvedValueOnce([sampleDemand]);

      await listDemands({ status: 'Forecast' });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        expect.arrayContaining(['Forecast'])
      );
    });

    it('should apply event_type filter', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '1' });
      mockQuery.mockResolvedValueOnce([sampleDemand]);

      await listDemands({ event_type: 'Qualification' });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('event_type = $'),
        expect.arrayContaining(['Qualification'])
      );
    });

    it('should apply pagination', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '100' });
      mockQuery.mockResolvedValueOnce([sampleDemand]);

      await listDemands({ limit: 10, offset: 20 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 20])
      );
    });

    it('should return empty array when no demands found', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: '0' });
      mockQuery.mockResolvedValueOnce([]);

      const result = await listDemands({});

      expect(result.total).toBe(0);
      expect(result.demands).toHaveLength(0);
    });
  });

  describe('getDemandById', () => {
    it('should return demand when found', async () => {
      mockQueryOne.mockResolvedValueOnce(sampleDemand);

      const result = await getDemandById('demand-123');

      expect(result).toEqual(sampleDemand);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['demand-123']
      );
    });

    it('should return null when not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getDemandById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createDemand', () => {
    it('should create demand with required fields', async () => {
      mockQuery.mockResolvedValueOnce([sampleDemand]);

      const result = await createDemand({
        name: 'Q2 Tank Qualifications',
        fiscal_year: 2026,
        target_month: '2026-04',
        car_count: 50,
        event_type: 'Qualification',
      });

      expect(result).toEqual(sampleDemand);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO demands'),
        expect.arrayContaining(['Q2 Tank Qualifications', 2026, '2026-04', 50, 'Qualification'])
      );
    });

    it('should set default priority to Medium', async () => {
      mockQuery.mockResolvedValueOnce([sampleDemand]);

      await createDemand({
        name: 'Test',
        fiscal_year: 2026,
        target_month: '2026-04',
        car_count: 10,
        event_type: 'Qualification',
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['Medium'])
      );
    });

    it('should set default material type to Carbon Steel', async () => {
      mockQuery.mockResolvedValueOnce([sampleDemand]);

      await createDemand({
        name: 'Test',
        fiscal_year: 2026,
        target_month: '2026-04',
        car_count: 10,
        event_type: 'Qualification',
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['Carbon Steel'])
      );
    });

    it('should accept optional fields', async () => {
      mockQuery.mockResolvedValueOnce([sampleDemand]);

      await createDemand({
        name: 'Test',
        description: 'Test description',
        fiscal_year: 2026,
        target_month: '2026-04',
        car_count: 10,
        event_type: 'Qualification',
        car_type: 'Tank',
        priority: 'High',
        required_network: 'AITX',
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['Test description', 'Tank', 'High', 'AITX'])
      );
    });
  });

  describe('updateDemand', () => {
    it('should update specified fields', async () => {
      const updatedDemand = { ...sampleDemand, car_count: 75 };
      mockQuery.mockResolvedValueOnce([updatedDemand]);

      const result = await updateDemand('demand-123', { car_count: 75 });

      expect(result?.car_count).toBe(75);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE demands'),
        expect.arrayContaining(['demand-123', 75])
      );
    });

    it('should return null when demand not found', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await updateDemand('nonexistent', { car_count: 75 });

      expect(result).toBeNull();
    });

    it('should return existing demand when no updates provided', async () => {
      mockQueryOne.mockResolvedValueOnce(sampleDemand);

      const result = await updateDemand('demand-123', {});

      expect(result).toEqual(sampleDemand);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('updateDemandStatus', () => {
    it('should update status', async () => {
      const updatedDemand = { ...sampleDemand, status: 'Confirmed' as DemandStatus };
      mockQuery.mockResolvedValueOnce([updatedDemand]);

      const result = await updateDemandStatus('demand-123', 'Confirmed');

      expect(result?.status).toBe('Confirmed');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE demands SET status'),
        ['demand-123', 'Confirmed']
      );
    });

    it('should return null when demand not found', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await updateDemandStatus('nonexistent', 'Confirmed');

      expect(result).toBeNull();
    });
  });

  describe('deleteDemand', () => {
    it('should delete demand and return true', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await deleteDemand('demand-123');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM demands'),
        ['demand-123']
      );
    });
  });
});
