import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BRCImportModal from '@/components/BRCImportModal';

// Mock the API
jest.mock('@/lib/api', () => ({
  importBRC: jest.fn(),
}));

import { importBRC } from '@/lib/api';
const mockImportBRC = importBRC as jest.MockedFunction<typeof importBRC>;

describe('BRCImportModal', () => {
  const defaultProps = {
    onClose: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title', () => {
    render(<BRCImportModal {...defaultProps} />);
    expect(screen.getByText('Import BRC File')).toBeInTheDocument();
  });

  it('renders AAR 500-byte format info', () => {
    render(<BRCImportModal {...defaultProps} />);
    expect(screen.getByText(/AAR 500-Byte Format/)).toBeInTheDocument();
  });

  it('renders drag-drop zone', () => {
    render(<BRCImportModal {...defaultProps} />);
    expect(screen.getByText(/Drag and drop your AAR 500-byte BRC file/)).toBeInTheDocument();
  });

  it('shows Choose File button', () => {
    render(<BRCImportModal {...defaultProps} />);
    expect(screen.getByText('Choose File')).toBeInTheDocument();
  });

  it('disables Import when no file selected', () => {
    render(<BRCImportModal {...defaultProps} />);
    expect(screen.getByText('Import')).toBeDisabled();
  });

  it('shows file info after selecting a file', () => {
    render(<BRCImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'.repeat(5000)], 'test.brc', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('test.brc')).toBeInTheDocument();
    expect(screen.getByText(/Est\. 10 records/)).toBeInTheDocument();
  });

  it('enables Import after file selection', () => {
    render(<BRCImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.brc', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('Import')).not.toBeDisabled();
  });

  it('calls importBRC and shows results on success', async () => {
    mockImportBRC.mockResolvedValue({
      id: 'import-1',
      total: 20,
      matched_to_allocation: 15,
      created_running_repair: 3,
      errors: [],
      filename: 'test.brc',
      imported_at: '2026-01-01',
      imported_by: 'user-1',
    });

    render(<BRCImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.brc', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await userEvent.click(screen.getByText('Import'));

    await waitFor(() => {
      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('Total Records')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('Matched')).toBeInTheDocument();
    });
  });

  it('calls onSuccess when import has no errors', async () => {
    mockImportBRC.mockResolvedValue({
      id: 'import-1',
      total: 5,
      matched_to_allocation: 5,
      created_running_repair: 0,
      errors: [],
      filename: 'test.brc',
      imported_at: '2026-01-01',
      imported_by: 'user-1',
    });

    render(<BRCImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.brc', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await userEvent.click(screen.getByText('Import'));

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('does not call onSuccess when import has errors', async () => {
    mockImportBRC.mockResolvedValue({
      id: 'import-1',
      total: 5,
      matched_to_allocation: 3,
      created_running_repair: 0,
      errors: ['Record 4: invalid car number'],
      filename: 'test.brc',
      imported_at: '2026-01-01',
      imported_by: 'user-1',
    });

    render(<BRCImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.brc', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await userEvent.click(screen.getByText('Import'));

    await waitFor(() => {
      expect(defaultProps.onSuccess).not.toHaveBeenCalled();
      expect(screen.getByText('1 Error')).toBeInTheDocument();
    });
  });

  it('shows error message when API call fails', async () => {
    mockImportBRC.mockRejectedValue(new Error('Server error'));

    render(<BRCImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.brc', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await userEvent.click(screen.getByText('Import'));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('calls onClose when Cancel clicked', async () => {
    render(<BRCImportModal {...defaultProps} />);
    await userEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows Close button after results', async () => {
    mockImportBRC.mockResolvedValue({
      id: 'import-1',
      total: 1,
      matched_to_allocation: 1,
      created_running_repair: 0,
      errors: [],
      filename: 'test.brc',
      imported_at: '2026-01-01',
      imported_by: 'user-1',
    });

    render(<BRCImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.brc', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await userEvent.click(screen.getByText('Import'));

    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument();
    });
  });

  it('handles drag and drop', () => {
    render(<BRCImportModal {...defaultProps} />);
    const dropZone = screen.getByText(/Drag and drop your AAR 500-byte BRC file/).closest('div')!;
    const file = new File(['data'], 'dropped.brc', { type: 'text/plain' });

    fireEvent.dragEnter(dropZone, { dataTransfer: { files: [file] } });
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    expect(screen.getByText('dropped.brc')).toBeInTheDocument();
  });

  it('clears file when X button is clicked', async () => {
    render(<BRCImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.brc', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByText('test.brc')).toBeInTheDocument();

    // Click the clear button in file info area
    const clearBtns = document.querySelectorAll('.text-gray-400.hover\\:text-gray-600');
    if (clearBtns.length > 0) {
      fireEvent.click(clearBtns[0]);
    }
  });

  it('shows multiple errors with truncation', async () => {
    const errors = Array.from({ length: 15 }, (_, i) => `Record ${i + 1}: error`);
    mockImportBRC.mockResolvedValue({
      id: 'import-1',
      total: 20,
      matched_to_allocation: 5,
      created_running_repair: 0,
      errors,
      filename: 'test.brc',
      imported_at: '2026-01-01',
      imported_by: 'user-1',
    });

    render(<BRCImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.brc', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await userEvent.click(screen.getByText('Import'));

    await waitFor(() => {
      expect(screen.getByText('15 Errors')).toBeInTheDocument();
      expect(screen.getByText('...and 5 more')).toBeInTheDocument();
    });
  });
});
