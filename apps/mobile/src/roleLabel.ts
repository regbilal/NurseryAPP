export function roleBadgeLabel(role: string | undefined, t: (key: string) => string): string | undefined {
  if (role === 'Admin') return t('admin');
  if (role === 'Educator') return t('educator');
  if (role === 'Parent') return t('parent');
  return undefined;
}