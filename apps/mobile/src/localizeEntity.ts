import { TFunction } from 'i18next';

/** Maps API enum / label strings to i18n keys (English values from the API). */
const KEY_MAP: Record<string, string> = {
  Breakfast: 'breakfast',
  Lunch: 'lunch',
  Snack: 'snack',
  Nap: 'nap',
  Happy: 'happy',
  Calm: 'calm',
  Sad: 'sad',
  Tired: 'tired',
  Upset: 'upset',
  Wet: 'wet',
  Soiled: 'soiled',
  Dry: 'dry',
  All: 'all',
  Most: 'most',
  Some: 'some',
  None: 'none',
  'None / refused': 'none',
  CheckIn: 'arrived',
  CheckOut: 'left',
  Pending: 'pending',
  Paid: 'paid',
  Overdue: 'overdue',
  Approved: 'approve',
  Rejected: 'reject',
  Scheduled: 'shiftScheduled',
  Completed: 'shiftCompleted',
  Absent: 'shiftAbsent',
  Vaccine: 'vaccines',
  Invoice: 'invoices',
  Meeting: 'reminderMeeting',
  Medication: 'medications',
  Photo: 'photos',
  Educator: 'educator',
  Admin: 'admin',
  Parent: 'parent',
};

export function localizeEntityLabel(t: TFunction, value?: string | null): string {
  if (!value?.trim()) return '';
  const key = KEY_MAP[value.trim()];
  if (key) {
    const translated = t(key);
    if (translated !== key) return translated;
  }
  const slug = value.trim().toLowerCase().replace(/\s+/g, '');
  const tryKey = t(slug, { defaultValue: value.trim() });
  return tryKey;
}

export function localizeCareLine(
  t: TFunction,
  parts: { subtype?: string; amount?: string; notes?: string },
): string {
  const bits = [
    parts.subtype ? localizeEntityLabel(t, parts.subtype) : '',
    parts.amount ? localizeEntityLabel(t, parts.amount) : '',
    parts.notes ?? '',
  ].filter(Boolean);
  return bits.join(' · ');
}
