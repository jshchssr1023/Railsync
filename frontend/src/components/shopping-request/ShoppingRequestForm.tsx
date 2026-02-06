'use client';

import { useReducer, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { createShoppingRequest, uploadShoppingRequestAttachment } from '@/lib/api';

import CustomerInfoSection from './CustomerInfoSection';
import CarInfoSection from './CarInfoSection';
import CarShoppingStatusSection from './CarShoppingStatusSection';
import ShoppingFacilitiesNotice from './ShoppingFacilitiesNotice';
import MobileRepairSection from './MobileRepairSection';
import ReasonForShoppingSection from './ReasonForShoppingSection';
import ReturnDispositionSection from './ReturnDispositionSection';
import AttachmentsSection from './AttachmentsSection';
import OneTimeMovementSection from './OneTimeMovementSection';
import CommentsSection from './CommentsSection';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface FormState {
  customer_company: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  car_number: string;
  current_railroad: string;
  current_location_city: string;
  current_location_state: string;
  next_railroad: string;
  next_location_city: string;
  next_location_state: string;
  stcc_or_un_number: string;
  residue_clean: string;
  gasket: string;
  o_rings: string;
  last_known_commodity: string;
  lining_current: string;
  lining_alternative: string;
  preferred_shop_code: string;
  mobile_repair_unit: boolean;
  shopping_type_code: string;
  shopping_reason_code: string;
  clean_grade: string;
  is_kosher: boolean;
  is_food_grade: boolean;
  dry_grade: string;
  disposition_city: string;
  disposition_state: string;
  disposition_route: string;
  disposition_payer_of_freight: string;
  disposition_comment: string;
  one_time_movement_approval: boolean;
  comments: string;
  attachments: File[];
}

type FormAction =
  | { type: 'SET_FIELD'; field: string; value: string | boolean }
  | { type: 'SET_FIELDS'; fields: Partial<FormState> }
  | { type: 'ADD_FILES'; files: File[] }
  | { type: 'REMOVE_FILE'; index: number }
  | { type: 'RESET' };

const INITIAL_STATE: FormState = {
  customer_company: 'all_customers',
  customer_first_name: '',
  customer_last_name: '',
  customer_email: '',
  customer_phone: '',
  car_number: '',
  current_railroad: '',
  current_location_city: '',
  current_location_state: '',
  next_railroad: '',
  next_location_city: '',
  next_location_state: '',
  stcc_or_un_number: '',
  residue_clean: 'unknown',
  gasket: 'unknown',
  o_rings: 'unknown',
  last_known_commodity: '',
  lining_current: '',
  lining_alternative: '',
  preferred_shop_code: '',
  mobile_repair_unit: false,
  shopping_type_code: '',
  shopping_reason_code: '',
  clean_grade: '',
  is_kosher: false,
  is_food_grade: false,
  dry_grade: '',
  disposition_city: '',
  disposition_state: '',
  disposition_route: '',
  disposition_payer_of_freight: '',
  disposition_comment: '',
  one_time_movement_approval: false,
  comments: '',
  attachments: [],
};

function reducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_FIELDS':
      return { ...state, ...action.fields };
    case 'ADD_FILES':
      return { ...state, attachments: [...state.attachments, ...action.files] };
    case 'REMOVE_FILE':
      return { ...state, attachments: state.attachments.filter((_, i) => i !== action.index) };
    case 'RESET':
      return INITIAL_STATE;
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ShoppingRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // Pre-fill from URL params
  const initialCar = searchParams.get('car') || '';
  const badOrderId = searchParams.get('boId') || '';

  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_STATE,
    car_number: initialCar,
  });

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = useCallback((field: string, value: string | boolean) => {
    dispatch({ type: 'SET_FIELD', field, value });
    setErrors((prev) => {
      if (prev[field]) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return prev;
    });
  }, []);

  const handleCarSelected = useCallback((car: { car_number: string; car_mark: string; car_type: string; lessee_name: string }) => {
    dispatch({
      type: 'SET_FIELDS',
      fields: {
        car_number: car.car_number,
        customer_company: car.lessee_name?.toLowerCase().includes('aitx') ? 'aitx_only' : 'all_customers',
      },
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!state.car_number.trim()) {
      newErrors.car_number = 'Car number is required';
    }
    if (state.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.customer_email)) {
      newErrors.customer_email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Build payload (exclude attachments — those are uploaded separately)
      const { attachments, ...formData } = state;
      const payload: Record<string, unknown> = { ...formData };
      if (badOrderId) {
        payload.bad_order_report_id = badOrderId;
      }

      const result = await createShoppingRequest(payload);

      // Upload attachments
      if (attachments.length > 0) {
        for (const file of attachments) {
          try {
            await uploadShoppingRequestAttachment(result.id, file, 'other');
          } catch (uploadErr) {
            console.error('Attachment upload failed:', uploadErr);
          }
        }
      }

      toast.success(`Shopping request ${result.request_number} submitted successfully`);
      router.push('/shopping');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit shopping request');
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    dispatch({ type: 'RESET' });
    setErrors({});
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">New Shopping Request</h1>
        <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
          Submit a car shopping request. All required fields are marked with an asterisk.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Customer Information */}
        <CustomerInfoSection
          values={{
            customer_company: state.customer_company,
            customer_first_name: state.customer_first_name,
            customer_last_name: state.customer_last_name,
            customer_email: state.customer_email,
            customer_phone: state.customer_phone,
          }}
          onChange={setField}
        />

        {/* Section 2: Car Information */}
        <CarInfoSection
          values={{
            car_number: state.car_number,
            current_railroad: state.current_railroad,
            current_location_city: state.current_location_city,
            current_location_state: state.current_location_state,
            next_railroad: state.next_railroad,
            next_location_city: state.next_location_city,
            next_location_state: state.next_location_state,
            stcc_or_un_number: state.stcc_or_un_number,
          }}
          onChange={setField}
          onCarSelected={handleCarSelected}
        />
        {errors.car_number && (
          <p className="text-sm text-red-600 -mt-4 ml-1">{errors.car_number}</p>
        )}

        {/* Section 3: Car Shopping Status */}
        <CarShoppingStatusSection
          values={{
            residue_clean: state.residue_clean,
            gasket: state.gasket,
            o_rings: state.o_rings,
            last_known_commodity: state.last_known_commodity,
            lining_current: state.lining_current,
            lining_alternative: state.lining_alternative,
            preferred_shop_code: state.preferred_shop_code,
          }}
          onChange={setField}
        />

        {/* Section 4: Shopping Facilities Notice */}
        <ShoppingFacilitiesNotice />

        {/* Section 5: Mobile Repair Unit */}
        <MobileRepairSection
          value={state.mobile_repair_unit}
          onChange={(val) => setField('mobile_repair_unit', val)}
        />

        {/* Section 6: Reason for Shopping */}
        <ReasonForShoppingSection
          values={{
            shopping_type_code: state.shopping_type_code,
            shopping_reason_code: state.shopping_reason_code,
            clean_grade: state.clean_grade,
            is_kosher: state.is_kosher,
            is_food_grade: state.is_food_grade,
            dry_grade: state.dry_grade,
          }}
          onChange={setField}
        />

        {/* Section 7: Return Disposition */}
        <ReturnDispositionSection
          values={{
            disposition_city: state.disposition_city,
            disposition_state: state.disposition_state,
            disposition_route: state.disposition_route,
            disposition_payer_of_freight: state.disposition_payer_of_freight,
            disposition_comment: state.disposition_comment,
          }}
          onChange={setField}
        />

        {/* Section 8: Attachments */}
        <AttachmentsSection
          files={state.attachments}
          onAddFiles={(files) => dispatch({ type: 'ADD_FILES', files })}
          onRemoveFile={(index) => dispatch({ type: 'REMOVE_FILE', index })}
        />

        {/* Section 9: One Time Movement Approval */}
        <OneTimeMovementSection
          value={state.one_time_movement_approval}
          onChange={(val) => setField('one_time_movement_approval', val)}
        />

        {/* Section 10: Comments */}
        <CommentsSection
          value={state.comments}
          onChange={(val) => setField('comments', val)}
        />

        {/* Section 11: Actions */}
        <div className="flex items-center gap-4 pt-4 border-t border-[var(--color-border)]">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={submitting}
            className="px-6 py-2.5 border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-bg-tertiary)] font-medium text-sm"
          >
            Reset
          </button>
        </div>
      </form>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-[var(--color-border)] text-center text-xs text-[var(--color-text-tertiary)] space-y-1">
        <p>Terms and Conditions &middot; Contact Support &middot; Provide Feedback</p>
        <p>&copy; 2026 American Industrial Transport, Inc. All rights reserved.</p>
      </div>
    </div>
  );
}
