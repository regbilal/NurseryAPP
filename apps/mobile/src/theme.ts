/** Design tokens aligned with little_stars_nursery_ui_ux_prototype (Tailwind stone + amber). */
export const colors = {
  bg: '#FAF8F5',
  card: '#FFFFFF',
  surfaceMuted: '#FAFAF9',
  ink: '#292524',
  inkLight: '#1C1917',
  muted: '#78716C',
  mutedLight: '#A8A29E',
  primary: '#F59E0B',
  primaryDark: '#D97706',
  primarySoft: '#FEF3C7',
  primaryBorder: '#FCD34D',
  sage: '#059669',
  sageSoft: '#D1FAE5',
  sageBorder: '#A7F3D0',
  danger: '#E11D48',
  dangerSoft: '#FFF1F2',
  dangerBorder: '#FECDD3',
  line: '#E7E5E4',
  white: '#FFFFFF',
  dark: '#1C1917',
  darkMuted: '#44403C',
  indigo: '#4F46E5',
  cyan: '#0891B2',
  emerald: '#059669',
  care: {
    meal: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
    nap: { bg: '#E0E7FF', text: '#3730A3', border: '#C7D2FE' },
    diaper: { bg: '#CFFAFE', text: '#155E75', border: '#A5F3FC' },
    mood: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
    note: { bg: '#F3E8FF', text: '#6B21A8', border: '#E9D5FF' },
  },
};

export const space = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 12, md: 16, lg: 24, pill: 999 };

export const shadow = {
  card: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  lifted: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
};
