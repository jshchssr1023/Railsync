/**
 * Scope of Work Service Tests
 *
 * Tests SOW CRUD, item management, finalization, and template operations
 */

import {
  createSOW,
  getSOW,
  addSOWItem,
  updateSOWItem,
  removeSOWItem,
  populateFromLibrary,
  populateFromCCM,
  finalizeSOW,
  saveAsTemplate,
} from '../services/scope-of-work.service';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
  pool: { query: jest.fn() },
}));

// Mock dependent services
jest.mock('../services/scope-library.service', () => ({
  incrementUsage: jest.fn().mockResolvedValue(true),
}));

jest.mock('../services/transition-log.service', () => ({
  logTransition: jest.fn().mockResolvedValue({ id: 'log-1' }),
}));

import { query, queryOne, transaction } from '../config/database';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;

describe('Scope of Work Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Create SOW
  // ============================================================================
  describe('createSOW', () => {
    it('should create a new scope of work', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'sow-1',
        scope_library_id: null,
        status: 'draft',
        created_by_id: 'user-1',
      } as any);

      const result = await createSOW({}, 'user-1');

      expect(result).toBeDefined();
      expect(result.status).toBe('draft');
      expect(result.created_by_id).toBe('user-1');
    });

    it('should create SOW from scope library template', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'sow-1',
        scope_library_id: 'template-1',
        status: 'draft',
      } as any);

      const result = await createSOW({ scope_library_id: 'template-1' }, 'user-1');

      expect(result.scope_library_id).toBe('template-1');
    });
  });

  // ============================================================================
  // Get SOW
  // ============================================================================
  describe('getSOW', () => {
    it('should return SOW with items and job codes', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'sow-1',
        status: 'draft',
      } as any);

      mockQuery.mockResolvedValueOnce([
        {
          id: 'item-1',
          scope_of_work_id: 'sow-1',
          line_number: 1,
          instruction_text: 'Inspect tank',
          source: 'manual',
          jc_id: 'jc-1',
          jc_code: 'INSP-001',
          jc_code_type: 'shop',
          jc_description: 'Tank inspection',
          jc_is_expected: true,
          jc_notes: null,
        },
      ] as any);

      const result = await getSOW('sow-1');

      expect(result).toBeDefined();
      expect(result!.items).toHaveLength(1);
      expect(result!.items![0].job_codes).toHaveLength(1);
    });

    it('should return null when SOW not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await getSOW('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Add SOW Item
  // ============================================================================
  describe('addSOWItem', () => {
    it('should add item to scope of work', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'item-1',
        scope_of_work_id: 'sow-1',
        line_number: 1,
        instruction_text: 'Remove lining',
        source: 'manual',
      } as any);

      const result = await addSOWItem('sow-1', {
        line_number: 1,
        instruction_text: 'Remove lining',
        source: 'manual',
      });

      expect(result).toBeDefined();
      expect(result.instruction_text).toBe('Remove lining');
    });
  });

  // ============================================================================
  // Update SOW Item
  // ============================================================================
  describe('updateSOWItem', () => {
    it('should update SOW item when SOW is draft', async () => {
      mockQueryOne.mockResolvedValueOnce({ status: 'draft' } as any);
      mockQueryOne.mockResolvedValueOnce({
        id: 'item-1',
        instruction_text: 'Updated instruction',
      } as any);

      const result = await updateSOWItem('item-1', {
        instruction_text: 'Updated instruction',
      });

      expect(result).toBeDefined();
      expect(result!.instruction_text).toBe('Updated instruction');
    });

    it('should throw when updating finalized SOW', async () => {
      mockQueryOne.mockResolvedValueOnce({ status: 'finalized' } as any);

      await expect(
        updateSOWItem('item-1', { instruction_text: 'New text' })
      ).rejects.toThrow('Cannot update items on a finalized scope of work');
    });
  });

  // ============================================================================
  // Remove SOW Item
  // ============================================================================
  describe('removeSOWItem', () => {
    it('should remove SOW item', async () => {
      mockQuery.mockResolvedValueOnce([] as any);

      await removeSOWItem('item-1');

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM scope_of_work_items WHERE id = $1',
        ['item-1']
      );
    });
  });

  // ============================================================================
  // Populate From Library
  // ============================================================================
  describe('populateFromLibrary', () => {
    it('should populate SOW from library template', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({
            rows: [
              { id: 'lib-item-1', line_number: 1, instruction_text: 'Inspect', ccm_section_id: null },
            ],
          })
          .mockResolvedValueOnce({ rows: [{ id: 'new-item-1' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
      };

      mockTransaction.mockImplementation(async (callback) => {
        return callback(mockClient as any);
      });

      const result = await populateFromLibrary('sow-1', 'template-1');

      expect(result).toBe(1);
    });
  });

  // ============================================================================
  // Populate From CCM
  // ============================================================================
  describe('populateFromCCM', () => {
    it('should populate SOW from CCM sections', async () => {
      mockQueryOne.mockResolvedValueOnce({ max_line: 0 } as any);
      mockQueryOne.mockResolvedValueOnce({
        id: 'section-1',
        content: 'CCM instruction text',
      } as any);
      mockQuery.mockResolvedValueOnce([] as any);

      const result = await populateFromCCM('sow-1', ['section-1']);

      expect(result).toBe(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO scope_of_work_items'),
        expect.arrayContaining(['sow-1', 1, 'CCM instruction text', 'section-1'])
      );
    });
  });

  // ============================================================================
  // Finalize SOW
  // ============================================================================
  describe('finalizeSOW', () => {
    it('should finalize a draft SOW', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'sow-1',
        status: 'finalized',
        finalized_at: new Date(),
        finalized_by_id: 'user-1',
      } as any);

      const result = await finalizeSOW('sow-1', 'user-1');

      expect(result).toBeDefined();
      expect(result!.status).toBe('finalized');
      expect(result!.finalized_by_id).toBe('user-1');
    });

    it('should return null when SOW not found or already finalized', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await finalizeSOW('sow-1', 'user-1');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Save As Template
  // ============================================================================
  describe('saveAsTemplate', () => {
    it('should save SOW as reusable template', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'sow-1' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'template-1', name: 'My Template' }] })
          .mockResolvedValueOnce({
            rows: [
              { id: 'item-1', line_number: 1, instruction_text: 'Test', source: 'manual', ccm_section_id: null },
            ],
          })
          .mockResolvedValueOnce({ rows: [{ id: 'lib-item-1' }] })
          .mockResolvedValueOnce({ rows: [] }),
      };

      mockTransaction.mockImplementation(async (callback) => {
        return callback(mockClient as any);
      });

      const result = await saveAsTemplate('sow-1', 'My Template', 'user-1');

      expect(result).toBeDefined();
      expect(result.name).toBe('My Template');
    });

    it('should throw when SOW not found', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [] }),
      };

      mockTransaction.mockImplementation(async (callback) => {
        return callback(mockClient as any);
      });

      await expect(
        saveAsTemplate('nonexistent', 'Template', 'user-1')
      ).rejects.toThrow('Scope of work not found');
    });
  });
});
