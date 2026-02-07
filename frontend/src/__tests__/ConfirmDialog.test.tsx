import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '@/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    title: 'Confirm Action',
    description: 'Are you sure you want to proceed?',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title and description when open', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', async () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Yes, do it" />);
    await userEvent.click(screen.getByText('Yes, do it'));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', async () => {
    render(<ConfirmDialog {...defaultProps} />);
    await userEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel on Escape key', () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders summary items when provided', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        summaryItems={[
          { label: 'Total Records', value: '1,500' },
          { label: 'Affected Cars', value: '42' },
        ]}
      />
    );
    expect(screen.getByText('Total Records')).toBeInTheDocument();
    expect(screen.getByText('1,500')).toBeInTheDocument();
    expect(screen.getByText('Affected Cars')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('shows irreversible warning when enabled', () => {
    render(<ConfirmDialog {...defaultProps} irreversibleWarning />);
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('disables confirm button until typed confirmation matches', async () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        requireTypedConfirmation="DELETE"
        confirmLabel="Delete"
      />
    );

    const confirmBtn = screen.getByText('Delete');
    expect(confirmBtn).toBeDisabled();

    const input = screen.getByPlaceholderText('DELETE');
    await userEvent.type(input, 'DELETE');
    expect(confirmBtn).not.toBeDisabled();
  });

  it('disables confirm button when loading', () => {
    render(
      <ConfirmDialog {...defaultProps} loading confirmLabel="Confirm" />
    );
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });
});
