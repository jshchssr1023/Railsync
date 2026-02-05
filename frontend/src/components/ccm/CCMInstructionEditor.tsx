'use client';

import { useState, useEffect } from 'react';
import {
  CCMInstruction,
  CCMInstructionFields,
  CCMInstructionSealing,
  CCMInstructionLining,
  CCMScopeLevel,
} from '@/types';
import { InheritableTextField, InheritableBooleanField } from './FieldInheritanceToggle';

interface CCMInstructionEditorProps {
  instruction: CCMInstruction | null;
  parentCCM: CCMInstructionFields | null;
  fieldSources?: Record<string, CCMScopeLevel | null>;
  onChange: (data: Partial<CCMInstructionFields>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
  isNew?: boolean;
}

type TabId = 'contacts' | 'cleaning' | 'sealing' | 'lining' | 'dispo' | 'notes';

const TABS: { id: TabId; label: string }[] = [
  { id: 'contacts', label: 'Contacts' },
  { id: 'cleaning', label: 'Cleaning' },
  { id: 'sealing', label: 'Sealing' },
  { id: 'lining', label: 'Lining' },
  { id: 'dispo', label: 'Dispo' },
  { id: 'notes', label: 'Notes' },
];

export default function CCMInstructionEditor({
  instruction,
  parentCCM,
  fieldSources = {},
  onChange,
  onSave,
  onCancel,
  saving = false,
  isNew = false,
}: CCMInstructionEditorProps) {
  const [activeTab, setActiveTab] = useState<TabId>('contacts');
  const [formData, setFormData] = useState<Partial<CCMInstructionFields>>({});

  // Initialize form data from instruction
  useEffect(() => {
    if (instruction) {
      setFormData({
        food_grade: instruction.food_grade,
        mineral_wipe: instruction.mineral_wipe,
        kosher_wash: instruction.kosher_wash,
        kosher_wipe: instruction.kosher_wipe,
        shop_oil_material: instruction.shop_oil_material,
        oil_provider_contact: instruction.oil_provider_contact,
        rinse_water_test_procedure: instruction.rinse_water_test_procedure,
        primary_contact_name: instruction.primary_contact_name,
        primary_contact_email: instruction.primary_contact_email,
        primary_contact_phone: instruction.primary_contact_phone,
        estimate_approval_contact_name: instruction.estimate_approval_contact_name,
        estimate_approval_contact_email: instruction.estimate_approval_contact_email,
        estimate_approval_contact_phone: instruction.estimate_approval_contact_phone,
        dispo_contact_name: instruction.dispo_contact_name,
        dispo_contact_email: instruction.dispo_contact_email,
        dispo_contact_phone: instruction.dispo_contact_phone,
        decal_requirements: instruction.decal_requirements,
        nitrogen_applied: instruction.nitrogen_applied,
        nitrogen_psi: instruction.nitrogen_psi,
        outbound_dispo_contact_email: instruction.outbound_dispo_contact_email,
        outbound_dispo_contact_phone: instruction.outbound_dispo_contact_phone,
        documentation_required_prior_to_release: instruction.documentation_required_prior_to_release,
        special_fittings_vendor_requirements: instruction.special_fittings_vendor_requirements,
        additional_notes: instruction.additional_notes,
      });
    } else {
      setFormData({});
    }
  }, [instruction]);

  const handleFieldChange = <K extends keyof CCMInstructionFields>(
    field: K,
    value: CCMInstructionFields[K]
  ) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    onChange(newData);
  };

  const getInheritedFrom = (field: string): CCMScopeLevel | null => {
    return fieldSources[field] || null;
  };

  const renderContactsTab = () => (
    <div className="space-y-6">
      {/* Primary Contact */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Primary Contact
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InheritableTextField
            label="Name"
            fieldKey="primary_contact_name"
            value={formData.primary_contact_name}
            inheritedValue={parentCCM?.primary_contact_name}
            inheritedFrom={getInheritedFrom('primary_contact_name')}
            onChange={(v) => handleFieldChange('primary_contact_name', v)}
            placeholder="Contact name"
          />
          <InheritableTextField
            label="Email"
            fieldKey="primary_contact_email"
            value={formData.primary_contact_email}
            inheritedValue={parentCCM?.primary_contact_email}
            inheritedFrom={getInheritedFrom('primary_contact_email')}
            onChange={(v) => handleFieldChange('primary_contact_email', v)}
            placeholder="email@example.com"
          />
          <InheritableTextField
            label="Phone"
            fieldKey="primary_contact_phone"
            value={formData.primary_contact_phone}
            inheritedValue={parentCCM?.primary_contact_phone}
            inheritedFrom={getInheritedFrom('primary_contact_phone')}
            onChange={(v) => handleFieldChange('primary_contact_phone', v)}
            placeholder="(555) 123-4567"
          />
        </div>
      </div>

      {/* Estimate Approval Contact */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Estimate Approval Contact
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InheritableTextField
            label="Name"
            fieldKey="estimate_approval_contact_name"
            value={formData.estimate_approval_contact_name}
            inheritedValue={parentCCM?.estimate_approval_contact_name}
            inheritedFrom={getInheritedFrom('estimate_approval_contact_name')}
            onChange={(v) => handleFieldChange('estimate_approval_contact_name', v)}
            placeholder="Contact name"
          />
          <InheritableTextField
            label="Email"
            fieldKey="estimate_approval_contact_email"
            value={formData.estimate_approval_contact_email}
            inheritedValue={parentCCM?.estimate_approval_contact_email}
            inheritedFrom={getInheritedFrom('estimate_approval_contact_email')}
            onChange={(v) => handleFieldChange('estimate_approval_contact_email', v)}
            placeholder="email@example.com"
          />
          <InheritableTextField
            label="Phone"
            fieldKey="estimate_approval_contact_phone"
            value={formData.estimate_approval_contact_phone}
            inheritedValue={parentCCM?.estimate_approval_contact_phone}
            inheritedFrom={getInheritedFrom('estimate_approval_contact_phone')}
            onChange={(v) => handleFieldChange('estimate_approval_contact_phone', v)}
            placeholder="(555) 123-4567"
          />
        </div>
      </div>

      {/* Dispo Contact */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
          </svg>
          Disposition Contact
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InheritableTextField
            label="Name"
            fieldKey="dispo_contact_name"
            value={formData.dispo_contact_name}
            inheritedValue={parentCCM?.dispo_contact_name}
            inheritedFrom={getInheritedFrom('dispo_contact_name')}
            onChange={(v) => handleFieldChange('dispo_contact_name', v)}
            placeholder="Contact name"
          />
          <InheritableTextField
            label="Email"
            fieldKey="dispo_contact_email"
            value={formData.dispo_contact_email}
            inheritedValue={parentCCM?.dispo_contact_email}
            inheritedFrom={getInheritedFrom('dispo_contact_email')}
            onChange={(v) => handleFieldChange('dispo_contact_email', v)}
            placeholder="email@example.com"
          />
          <InheritableTextField
            label="Phone"
            fieldKey="dispo_contact_phone"
            value={formData.dispo_contact_phone}
            inheritedValue={parentCCM?.dispo_contact_phone}
            inheritedFrom={getInheritedFrom('dispo_contact_phone')}
            onChange={(v) => handleFieldChange('dispo_contact_phone', v)}
            placeholder="(555) 123-4567"
          />
        </div>
      </div>
    </div>
  );

  const renderCleaningTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <InheritableBooleanField
          label="Food Grade"
          fieldKey="food_grade"
          value={formData.food_grade}
          inheritedValue={parentCCM?.food_grade}
          inheritedFrom={getInheritedFrom('food_grade')}
          onChange={(v) => handleFieldChange('food_grade', v)}
          helpText="Requires food-grade cleaning certification"
        />
        <InheritableBooleanField
          label="Mineral Wipe"
          fieldKey="mineral_wipe"
          value={formData.mineral_wipe}
          inheritedValue={parentCCM?.mineral_wipe}
          inheritedFrom={getInheritedFrom('mineral_wipe')}
          onChange={(v) => handleFieldChange('mineral_wipe', v)}
        />
        <InheritableBooleanField
          label="Kosher Wash"
          fieldKey="kosher_wash"
          value={formData.kosher_wash}
          inheritedValue={parentCCM?.kosher_wash}
          inheritedFrom={getInheritedFrom('kosher_wash')}
          onChange={(v) => handleFieldChange('kosher_wash', v)}
        />
        <InheritableBooleanField
          label="Kosher Wipe"
          fieldKey="kosher_wipe"
          value={formData.kosher_wipe}
          inheritedValue={parentCCM?.kosher_wipe}
          inheritedFrom={getInheritedFrom('kosher_wipe')}
          onChange={(v) => handleFieldChange('kosher_wipe', v)}
        />
        <InheritableBooleanField
          label="Shop Oil Material"
          fieldKey="shop_oil_material"
          value={formData.shop_oil_material}
          inheritedValue={parentCCM?.shop_oil_material}
          inheritedFrom={getInheritedFrom('shop_oil_material')}
          onChange={(v) => handleFieldChange('shop_oil_material', v)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InheritableTextField
          label="Oil Provider Contact"
          fieldKey="oil_provider_contact"
          value={formData.oil_provider_contact}
          inheritedValue={parentCCM?.oil_provider_contact}
          inheritedFrom={getInheritedFrom('oil_provider_contact')}
          onChange={(v) => handleFieldChange('oil_provider_contact', v)}
          placeholder="If customer provides own oil, specify contact/address"
          multiline
        />
        <InheritableTextField
          label="Rinse Water Test Procedure"
          fieldKey="rinse_water_test_procedure"
          value={formData.rinse_water_test_procedure}
          inheritedValue={parentCCM?.rinse_water_test_procedure}
          inheritedFrom={getInheritedFrom('rinse_water_test_procedure')}
          onChange={(v) => handleFieldChange('rinse_water_test_procedure', v)}
          placeholder="External rinse water test procedure if required"
          multiline
        />
      </div>
    </div>
  );

  const renderSealingTab = () => (
    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
      <p>Sealing sections are managed separately per commodity.</p>
      <p className="text-sm mt-2">Use the Sealing Sections panel to add/edit commodity-specific sealing requirements.</p>
    </div>
  );

  const renderLiningTab = () => (
    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
      <p>Lining sections are managed separately per commodity.</p>
      <p className="text-sm mt-2">Use the Lining Sections panel to add/edit commodity-specific lining requirements.</p>
    </div>
  );

  const renderDispoTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InheritableBooleanField
          label="Nitrogen Applied"
          fieldKey="nitrogen_applied"
          value={formData.nitrogen_applied}
          inheritedValue={parentCCM?.nitrogen_applied}
          inheritedFrom={getInheritedFrom('nitrogen_applied')}
          onChange={(v) => handleFieldChange('nitrogen_applied', v)}
          helpText="Apply nitrogen pad to car"
        />
        <InheritableTextField
          label="Nitrogen PSI"
          fieldKey="nitrogen_psi"
          value={formData.nitrogen_psi}
          inheritedValue={parentCCM?.nitrogen_psi}
          inheritedFrom={getInheritedFrom('nitrogen_psi')}
          onChange={(v) => handleFieldChange('nitrogen_psi', v)}
          placeholder="e.g., 3 PSI"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InheritableTextField
          label="Outbound Dispo Email"
          fieldKey="outbound_dispo_contact_email"
          value={formData.outbound_dispo_contact_email}
          inheritedValue={parentCCM?.outbound_dispo_contact_email}
          inheritedFrom={getInheritedFrom('outbound_dispo_contact_email')}
          onChange={(v) => handleFieldChange('outbound_dispo_contact_email', v)}
          placeholder="email@example.com"
        />
        <InheritableTextField
          label="Outbound Dispo Phone"
          fieldKey="outbound_dispo_contact_phone"
          value={formData.outbound_dispo_contact_phone}
          inheritedValue={parentCCM?.outbound_dispo_contact_phone}
          inheritedFrom={getInheritedFrom('outbound_dispo_contact_phone')}
          onChange={(v) => handleFieldChange('outbound_dispo_contact_phone', v)}
          placeholder="(555) 123-4567"
        />
      </div>

      <InheritableTextField
        label="Decal Requirements"
        fieldKey="decal_requirements"
        value={formData.decal_requirements}
        inheritedValue={parentCCM?.decal_requirements}
        inheritedFrom={getInheritedFrom('decal_requirements')}
        onChange={(v) => handleFieldChange('decal_requirements', v)}
        placeholder="Decal application requirements"
        multiline
      />

      <InheritableTextField
        label="Documentation Required Prior to Release"
        fieldKey="documentation_required_prior_to_release"
        value={formData.documentation_required_prior_to_release}
        inheritedValue={parentCCM?.documentation_required_prior_to_release}
        inheritedFrom={getInheritedFrom('documentation_required_prior_to_release')}
        onChange={(v) => handleFieldChange('documentation_required_prior_to_release', v)}
        placeholder="List required documentation before car release"
        multiline
      />
    </div>
  );

  const renderNotesTab = () => (
    <div className="space-y-6">
      <InheritableTextField
        label="Special Fittings Vendor Requirements"
        fieldKey="special_fittings_vendor_requirements"
        value={formData.special_fittings_vendor_requirements}
        inheritedValue={parentCCM?.special_fittings_vendor_requirements}
        inheritedFrom={getInheritedFrom('special_fittings_vendor_requirements')}
        onChange={(v) => handleFieldChange('special_fittings_vendor_requirements', v)}
        placeholder="Special fittings vendor requirements and specifications"
        multiline
      />

      <InheritableTextField
        label="Additional Notes"
        fieldKey="additional_notes"
        value={formData.additional_notes}
        inheritedValue={parentCCM?.additional_notes}
        inheritedFrom={getInheritedFrom('additional_notes')}
        onChange={(v) => handleFieldChange('additional_notes', v)}
        placeholder="Any additional notes or instructions"
        multiline
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4 -mb-px overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'contacts' && renderContactsTab()}
        {activeTab === 'cleaning' && renderCleaningTab()}
        {activeTab === 'sealing' && renderSealingTab()}
        {activeTab === 'lining' && renderLiningTab()}
        {activeTab === 'dispo' && renderDispoTab()}
        {activeTab === 'notes' && renderNotesTab()}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? 'Saving...' : isNew ? 'Create CCM' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
