import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space } from '../theme';
import { Muted } from '../ui';

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const LOG_KEYS = ['log', 'notes', 'body', 'plan', 'description', 'text'];

function titleLabel(key: string): string {
  const lower = key.toLowerCase();
  const day = WEEKDAYS.find((d) => d === lower);
  if (day) return day.charAt(0).toUpperCase() + day.slice(1);
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatScalar(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : formatObject(item)))
      .filter(Boolean)
      .join(' · ');
  }
  if (typeof value === 'object') return formatObject(value as Record<string, unknown>);
  return String(value);
}

function formatObject(o: Record<string, unknown>): string {
  const keys = Object.keys(o);
  if (keys.length === 0) return '';

  const weekdayKeys = keys.filter((k) => WEEKDAYS.includes(k.toLowerCase()));
  if (weekdayKeys.length >= 2) {
    return WEEKDAYS
      .map((day) => {
        const key = keys.find((k) => k.toLowerCase() === day);
        if (!key) return null;
        const text = formatScalar(o[key]);
        if (!text) return null;
        return `${titleLabel(day)}: ${text}`;
      })
      .filter(Boolean)
      .join('\n');
  }

  return keys
    .map((key) => {
      const text = formatScalar(o[key]);
      if (!text) return null;
      return `${titleLabel(key)}: ${text}`;
    })
    .filter(Boolean)
    .join('\n');
}

/** Turn stored plan JSON into parent-friendly log text (no raw JSON). */
export function formatActivityPlan(planJson: string | undefined | null): string {
  const raw = (planJson ?? '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'string') return parsed.trim();
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === 'string') return `• ${item.trim()}`;
          if (item && typeof item === 'object') {
            const line = formatObject(item as Record<string, unknown>);
            return line ? `• ${line}` : null;
          }
          return null;
        })
        .filter(Boolean)
        .join('\n');
    }
    if (parsed && typeof parsed === 'object') {
      const o = parsed as Record<string, unknown>;
      for (const key of LOG_KEYS) {
        if (typeof o[key] === 'string' && (o[key] as string).trim()) return (o[key] as string).trim();
      }
      return formatObject(o);
    }
  } catch {
    return raw;
  }
  return raw;
}

export function FeedDetailItem({
  title,
  meta,
  detail,
  expanded,
  onToggle,
  trailing,
}: {
  title: string;
  meta?: string;
  detail: string;
  expanded: boolean;
  onToggle: () => void;
  trailing?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const hasDetail = detail.trim().length > 0;

  return (
    <View style={{ marginTop: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Pressable
          onPress={hasDetail ? onToggle : undefined}
          style={{ flex: 1, minWidth: 0 }}
          accessibilityRole={hasDetail ? 'button' : undefined}
        >
          <Text style={{ fontWeight: '700', color: colors.inkLight, fontSize: 15 }}>{title}</Text>
          {meta ? <Muted>{meta}</Muted> : null}
          {hasDetail ? (
            <Text style={{ marginTop: 4, fontSize: 13, fontWeight: '600', color: colors.primaryDark }}>
              {expanded ? t('hideDetails') : t('viewDetails')}
            </Text>
          ) : null}
        </Pressable>
        {trailing}
      </View>
      {expanded && hasDetail ? (
        <View
          style={{
            marginTop: space.xs,
            padding: space.sm,
            backgroundColor: colors.surfaceMuted,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 14, lineHeight: 22 }}>{detail}</Text>
        </View>
      ) : null}
    </View>
  );
}
