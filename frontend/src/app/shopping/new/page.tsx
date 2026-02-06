'use client';

import { Suspense } from 'react';
import ShoppingRequestForm from '@/components/shopping-request/ShoppingRequestForm';

export default function NewShoppingRequestPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6">Loading form...</div>}>
      <ShoppingRequestForm />
    </Suspense>
  );
}
