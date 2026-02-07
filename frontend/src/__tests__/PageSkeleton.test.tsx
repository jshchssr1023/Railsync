import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  DashboardSkeleton,
  ListSkeleton,
  DetailSkeleton,
  FormSkeleton,
} from '@/components/PageSkeleton';

describe('PageSkeleton components', () => {
  it('DashboardSkeleton renders with loading role', () => {
    render(<DashboardSkeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading dashboard')).toBeInTheDocument();
  });

  it('ListSkeleton renders with loading role', () => {
    render(<ListSkeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading list')).toBeInTheDocument();
  });

  it('DetailSkeleton renders with loading role', () => {
    render(<DetailSkeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('FormSkeleton renders with loading role', () => {
    render(<FormSkeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
