import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PartnerJoinApplicationItem } from '@sdkwork/partner-app-sdk';
import { partnerJoinMessages } from '../i18n';

// Real English message bundle so rendered copy matches i18n defaults.
const mockEnMessages = partnerJoinMessages.en;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string } & Record<string, unknown>) => {
      const message = mockEnMessages[key as keyof typeof mockEnMessages] ?? options?.defaultValue ?? key;
      return options ? message.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? '')) : message;
    },
  }),
}));

vi.mock('../services/partnerJoinService', () => ({
  fetchProgram: vi.fn(),
  submitApplication: vi.fn(),
  validateInviteCode: vi.fn(),
  isActiveApplicationConflict: vi.fn(),
  toMessage: (error: unknown, fallback: string) =>
    error instanceof Error && error.message.trim() ? error.message : fallback,
}));

import { isActiveApplicationConflict, submitApplication } from '../services/partnerJoinService';
import { ApplyPage, validateApplicationForm, type ApplyFormValues } from './applyPage';

const SubmitMock = vi.mocked(submitApplication);
const ConflictMock = vi.mocked(isActiveApplicationConflict);

function baseValues(overrides: Partial<ApplyFormValues> = {}): ApplyFormValues {
  return {
    applicantType: 'INDIVIDUAL',
    subjectName: '',
    contactName: 'Alice',
    contactPhone: '13800138000',
    contactEmail: 'alice@example.com',
    targetLevelNo: '3',
    inviteCode: '',
    businessIntro: '',
    ...overrides,
  };
}

function applicationItem(overrides: Partial<PartnerJoinApplicationItem> = {}): PartnerJoinApplicationItem {
  return {
    id: '42',
    uuid: 'uuid-42',
    applicantType: 'INDIVIDUAL',
    subjectName: 'Alice',
    contactName: 'Alice',
    contactPhone: '13800138000',
    contactEmail: 'alice@example.com',
    targetLevelNo: 3,
    inviteCode: '',
    inviterPartnerId: null,
    businessIntro: '',
    status: 'SUBMITTED',
    reviewComment: '',
    reviewedAt: null,
    approvedPartnerId: null,
    createdAt: '2026-08-12T00:00:00Z',
    updatedAt: '2026-08-12T00:00:00Z',
    ...overrides,
  };
}

describe('validateApplicationForm', () => {
  it('accepts a valid individual application', () => {
    expect(validateApplicationForm(baseValues())).toEqual({});
  });

  it('requires contact fields', () => {
    const errors = validateApplicationForm(baseValues({ contactName: '', contactPhone: '', contactEmail: '' }));
    expect(errors.contactName).toBe('partnerJoin.apply.errors.contactNameRequired');
    expect(errors.contactPhone).toBe('partnerJoin.apply.errors.contactPhoneRequired');
    expect(errors.contactEmail).toBe('partnerJoin.apply.errors.contactEmailRequired');
  });

  it('rejects malformed phone and email', () => {
    const errors = validateApplicationForm(
      baseValues({ contactPhone: 'abc', contactEmail: 'not-an-email' }),
    );
    expect(errors.contactPhone).toBe('partnerJoin.apply.errors.contactPhoneInvalid');
    expect(errors.contactEmail).toBe('partnerJoin.apply.errors.contactEmailInvalid');
  });

  it('requires a subject name for organization applications', () => {
    const errors = validateApplicationForm(baseValues({ applicantType: 'ORGANIZATION' }));
    expect(errors.subjectName).toBe('partnerJoin.apply.errors.subjectNameRequired');
  });

  it('requires a target level', () => {
    const errors = validateApplicationForm(baseValues({ targetLevelNo: '' }));
    expect(errors.targetLevelNo).toBe('partnerJoin.apply.errors.targetLevelRequired');
  });

  it('rejects a business introduction longer than 2000 characters', () => {
    const errors = validateApplicationForm(baseValues({ businessIntro: 'x'.repeat(2001) }));
    expect(errors.businessIntro).toBe('partnerJoin.apply.errors.businessIntroTooLong');
    expect(validateApplicationForm(baseValues({ businessIntro: 'x'.repeat(2000) })).businessIntro).toBeUndefined();
  });
});

describe('ApplyPage', () => {
  beforeEach(() => {
    SubmitMock.mockReset();
    ConflictMock.mockReset().mockReturnValue(false);
  });

  afterEach(() => {
    // RTL auto-cleanup needs vitest globals; register it explicitly so DOM
    // from one test never leaks into the next.
    cleanup();
  });

  it('blocks submission and shows validation errors for an incomplete form', () => {
    render(<ApplyPage />);
    fireEvent.change(screen.getByLabelText(/contact name/i), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/contact phone/i), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/contact email/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));
    expect(screen.getByText('Contact name is required')).toBeTruthy();
    expect(screen.getByText('Contact phone is required')).toBeTruthy();
    expect(screen.getByText('Contact email is required')).toBeTruthy();
    expect(SubmitMock).not.toHaveBeenCalled();
  });

  it('submits a valid form and shows the success screen with the application id', async () => {
    SubmitMock.mockResolvedValue(applicationItem());
    render(<ApplyPage />);
    fireEvent.change(screen.getByLabelText(/contact name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/contact phone/i), { target: { value: '13800138000' } });
    fireEvent.change(screen.getByLabelText(/contact email/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText(/target level/i), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));
    expect(await screen.findByText('Application submitted')).toBeTruthy();
    expect(screen.getByText(/Application ID 42/)).toBeTruthy();
    expect(SubmitMock).toHaveBeenCalledWith({
      applicantType: 'INDIVIDUAL',
      subjectName: undefined,
      contactName: 'Alice',
      contactPhone: '13800138000',
      contactEmail: 'alice@example.com',
      targetLevelNo: 3,
      inviteCode: undefined,
      businessIntro: undefined,
    });
  });

  it('shows the conflict screen when an active application blocks submission', async () => {
    SubmitMock.mockRejectedValue(new Error('409 conflict: an application is already submitted'));
    ConflictMock.mockReturnValue(true);
    render(<ApplyPage />);
    fireEvent.change(screen.getByLabelText(/contact name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/contact phone/i), { target: { value: '13800138000' } });
    fireEvent.change(screen.getByLabelText(/contact email/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText(/target level/i), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));
    expect(await screen.findByText('An application is already in progress')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View progress' })).toBeTruthy();
  });
});
