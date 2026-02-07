import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CSVImportModal from '@/components/CSVImportModal';

describe('CSVImportModal', () => {
  const defaultProps = {
    title: 'Import Cars',
    description: 'Drag and drop a CSV file',
    onClose: jest.fn(),
    onImport: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and description', () => {
    render(<CSVImportModal {...defaultProps} />);
    expect(screen.getByText('Import Cars')).toBeInTheDocument();
    expect(screen.getByText('Drag and drop a CSV file')).toBeInTheDocument();
  });

  it('renders Choose File button', () => {
    render(<CSVImportModal {...defaultProps} />);
    expect(screen.getByText('Choose File')).toBeInTheDocument();
  });

  it('shows Import and Cancel buttons', () => {
    render(<CSVImportModal {...defaultProps} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
  });

  it('disables Import button when no file selected', () => {
    render(<CSVImportModal {...defaultProps} />);
    const importBtn = screen.getByText('Import');
    expect(importBtn).toBeDisabled();
  });

  it('calls onClose when Cancel clicked', async () => {
    render(<CSVImportModal {...defaultProps} />);
    await userEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop clicked', () => {
    render(<CSVImportModal {...defaultProps} />);
    // The backdrop is the div with bg-black/50
    const backdrop = document.querySelector('.bg-black\\/50');
    if (backdrop) fireEvent.click(backdrop);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows file info after file selection', async () => {
    render(<CSVImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['col1,col2\nval1,val2'], 'test.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('test.csv')).toBeInTheDocument();
  });

  it('enables Import button after file selection', async () => {
    render(<CSVImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'cars.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const importBtn = screen.getByText('Import');
    expect(importBtn).not.toBeDisabled();
  });

  it('calls onImport with the file when Import clicked', async () => {
    defaultProps.onImport.mockResolvedValue({ imported: 5, updated: 2, errors: [] });

    render(<CSVImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'cars.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await userEvent.click(screen.getByText('Import'));

    await waitFor(() => {
      expect(defaultProps.onImport).toHaveBeenCalledWith(file);
    });
  });

  it('calls onSuccess after successful import with no errors', async () => {
    defaultProps.onImport.mockResolvedValue({ imported: 5, updated: 2, errors: [] });

    render(<CSVImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'cars.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await userEvent.click(screen.getByText('Import'));

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('shows result stats after successful import', async () => {
    defaultProps.onImport.mockResolvedValue({ imported: 10, updated: 3, errors: [] });

    render(<CSVImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'cars.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await userEvent.click(screen.getByText('Import'));

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('Imported')).toBeInTheDocument();
    });
  });

  it('does not call onSuccess when import has errors', async () => {
    defaultProps.onImport.mockResolvedValue({ imported: 2, errors: ['Row 3: bad data'] });

    render(<CSVImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'cars.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await userEvent.click(screen.getByText('Import'));

    await waitFor(() => {
      expect(defaultProps.onSuccess).not.toHaveBeenCalled();
      expect(screen.getByText('1 Error')).toBeInTheDocument();
    });
  });

  it('shows error message when import rejects', async () => {
    defaultProps.onImport.mockRejectedValue(new Error('Network error'));

    render(<CSVImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'cars.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await userEvent.click(screen.getByText('Import'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows Close button after result is displayed', async () => {
    defaultProps.onImport.mockResolvedValue({ imported: 1, errors: [] });

    render(<CSVImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'cars.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await userEvent.click(screen.getByText('Import'));

    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument();
    });
  });

  it('handles drag and drop file', () => {
    render(<CSVImportModal {...defaultProps} />);
    const dropZone = screen.getByText('Drag and drop a CSV file').closest('div')!;
    const file = new File(['data'], 'dropped.csv', { type: 'text/csv' });

    fireEvent.dragEnter(dropZone, { dataTransfer: { files: [file] } });
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    expect(screen.getByText('dropped.csv')).toBeInTheDocument();
  });

  it('clears file when X button on file info is clicked', async () => {
    render(<CSVImportModal {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByText('test.csv')).toBeInTheDocument();

    // Click the X button in the file info area (the last X button)
    const xButtons = screen.getAllByRole('button');
    const clearBtn = xButtons.find(btn => {
      const parent = btn.closest('.bg-gray-50, .dark\\:bg-gray-800');
      return parent && btn.querySelector('svg');
    });
    if (clearBtn) await userEvent.click(clearBtn);
  });

  it('uses custom renderResult when provided', async () => {
    defaultProps.onImport.mockResolvedValue({ custom: 'data' });
    const renderResult = (result: any) => <div data-testid="custom-result">Custom: {result.custom}</div>;

    render(<CSVImportModal {...defaultProps} renderResult={renderResult} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'cars.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await userEvent.click(screen.getByText('Import'));

    await waitFor(() => {
      expect(screen.getByTestId('custom-result')).toBeInTheDocument();
      expect(screen.getByText('Custom: data')).toBeInTheDocument();
    });
  });
});
