'use client';

import { useState, useEffect } from 'react';
import { Car, EvaluationOverrides } from '@/types';

interface EvaluationWizardProps {
  onComplete: (data: { car: Partial<Car>; overrides: EvaluationOverrides }) => void;
  onSkip: () => void;
}

const MATERIAL_TYPES = ['Carbon Steel', 'Stainless', 'Aluminum'] as const;
const LINING_TYPES = ['None', 'High Bake', 'Plasite', 'Rubber', 'Vinyl Ester', 'Epoxy'] as const;
const CAR_TYPES = ['Tank', 'Hopper', 'Covered Hopper', 'Boxcar', 'Gondola', 'Flatcar', 'Autorack'] as const;

type WizardStep = 'intro' | 'car-type' | 'attributes' | 'services' | 'review';

const WIZARD_SEEN_KEY = 'railsync_wizard_seen';

export default function EvaluationWizard({ onComplete, onSkip }: EvaluationWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('intro');
  const [carData, setCarData] = useState<Partial<Car>>({
    product_code: '',
    material_type: 'Carbon Steel',
    lining_type: undefined,
  });
  const [overrides, setOverrides] = useState<EvaluationOverrides>({
    exterior_paint: false,
    new_lining: false,
    interior_blast: false,
    kosher_cleaning: false,
    primary_network: false,
  });
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const steps: WizardStep[] = ['intro', 'car-type', 'attributes', 'services', 'review'];
  const currentStepIndex = steps.indexOf(currentStep);

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  const handleComplete = () => {
    if (dontShowAgain) {
      localStorage.setItem(WIZARD_SEEN_KEY, 'true');
    }
    onComplete({ car: carData, overrides });
  };

  const handleSkip = () => {
    if (dontShowAgain) {
      localStorage.setItem(WIZARD_SEEN_KEY, 'true');
    }
    onSkip();
  };

  // Check if should show wizard
  useEffect(() => {
    const seen = localStorage.getItem(WIZARD_SEEN_KEY);
    if (seen === 'true') {
      onSkip();
    }
  }, [onSkip]);

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              index <= currentStepIndex
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}
          >
            {index + 1}
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-12 h-1 mx-1 transition-colors ${
                index < currentStepIndex
                  ? 'bg-primary-600'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderIntro = () => (
    <div className="text-center">
      <div className="w-20 h-20 mx-auto mb-6 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center">
        <svg className="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
        Welcome to RailSync Shop Finder
      </h2>
      <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">
        Let&apos;s find the best shop for your railcar service needs. This wizard will guide you
        through entering your car information in just a few steps.
      </p>
      <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Takes less than 1 minute
      </div>
    </div>
  );

  const renderCarType = () => (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">
        What type of railcar?
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
        Select the car type that needs service
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {CAR_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setCarData({ ...carData, product_code: type })}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              carData.product_code === type
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="font-medium text-gray-900 dark:text-gray-100">{type}</div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderAttributes = () => (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">
        Car Attributes
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
        Tell us about the car&apos;s construction
      </p>
      <div className="space-y-6">
        {/* Material Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Shell Material
          </label>
          <div className="grid grid-cols-3 gap-3">
            {MATERIAL_TYPES.map((material) => (
              <button
                key={material}
                onClick={() => setCarData({ ...carData, material_type: material })}
                className={`py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                  carData.material_type === material
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                {material}
              </button>
            ))}
          </div>
        </div>

        {/* Lining Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Interior Lining (if any)
          </label>
          <div className="grid grid-cols-3 gap-3">
            {LINING_TYPES.map((lining) => (
              <button
                key={lining}
                onClick={() =>
                  setCarData({
                    ...carData,
                    lining_type: lining === 'None' ? undefined : lining,
                  })
                }
                className={`py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                  (lining === 'None' && !carData.lining_type) ||
                  carData.lining_type === lining
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                {lining}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderServices = () => (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">
        Service Requirements
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
        What services does this car need? (Select all that apply)
      </p>
      <div className="space-y-3">
        {[
          { key: 'interior_blast', label: 'Interior Blast', desc: 'Remove rust and old coatings' },
          { key: 'new_lining', label: 'New Lining Application', desc: 'Apply new interior lining' },
          { key: 'exterior_paint', label: 'Exterior Paint', desc: 'Repaint exterior surfaces' },
          { key: 'kosher_cleaning', label: 'Kosher Certification', desc: 'Kosher-certified cleaning process' },
          { key: 'primary_network', label: 'Preferred Network Only', desc: 'Limit to preferred shop network' },
        ].map((option) => (
          <label
            key={option.key}
            className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
              overrides[option.key as keyof EvaluationOverrides]
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <input
              type="checkbox"
              checked={overrides[option.key as keyof EvaluationOverrides] || false}
              onChange={(e) =>
                setOverrides({ ...overrides, [option.key]: e.target.checked })
              }
              className="mt-1 h-5 w-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{option.label}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{option.desc}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );

  const renderReview = () => (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">
        Review Your Selection
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
        Confirm the details before finding shops
      </p>
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 space-y-4">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Car Type</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {carData.product_code || 'Not specified'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Material</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {carData.material_type}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Lining</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {carData.lining_type || 'None'}
          </span>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Services Requested:
          </div>
          {Object.entries(overrides).filter(([, value]) => value).length === 0 ? (
            <span className="text-gray-500 dark:text-gray-400 text-sm">Standard cleaning only</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {overrides.interior_blast && (
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded">
                  Interior Blast
                </span>
              )}
              {overrides.new_lining && (
                <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 rounded">
                  New Lining
                </span>
              )}
              {overrides.exterior_paint && (
                <span className="px-2 py-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded">
                  Exterior Paint
                </span>
              )}
              {overrides.kosher_cleaning && (
                <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 rounded">
                  Kosher
                </span>
              )}
              {overrides.primary_network && (
                <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300 rounded">
                  Preferred Network
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 mt-6 cursor-pointer">
        <input
          type="checkbox"
          checked={dontShowAgain}
          onChange={(e) => setDontShowAgain(e.target.checked)}
          className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
        />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Don&apos;t show this wizard again (use compact form)
        </span>
      </label>
    </div>
  );

  const renderContent = () => {
    switch (currentStep) {
      case 'intro':
        return renderIntro();
      case 'car-type':
        return renderCarType();
      case 'attributes':
        return renderAttributes();
      case 'services':
        return renderServices();
      case 'review':
        return renderReview();
      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'intro':
        return true;
      case 'car-type':
        return !!carData.product_code;
      case 'attributes':
        return !!carData.material_type;
      case 'services':
        return true;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-6 md:p-8">
          {renderStepIndicator()}
          <div className="min-h-[300px]">{renderContent()}</div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
          <div>
            {currentStep === 'intro' ? (
              <button
                onClick={handleSkip}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Skip wizard, use compact form
              </button>
            ) : (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                Back
              </button>
            )}
          </div>
          <div>
            {currentStep === 'review' ? (
              <button
                onClick={handleComplete}
                className="px-6 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                Find Shops
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="px-6 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentStep === 'intro' ? 'Get Started' : 'Continue'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
