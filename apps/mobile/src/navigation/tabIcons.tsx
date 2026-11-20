import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

const icons: Record<string, { focused: IconName; unfocused: IconName }> = {
  Today: { focused: 'sunny', unfocused: 'sunny-outline' },
  Attendance: { focused: 'checkmark-circle', unfocused: 'checkmark-circle-outline' },
  Log: { focused: 'clipboard', unfocused: 'clipboard-outline' },
  Photos: { focused: 'images', unfocused: 'images-outline' },
  Chat: { focused: 'chatbubbles', unfocused: 'chatbubbles-outline' },
  Child: { focused: 'heart', unfocused: 'heart-outline' },
  More: { focused: 'menu', unfocused: 'menu-outline' },
  Dash: { focused: 'stats-chart', unfocused: 'stats-chart-outline' },
};

export function makeTabIcon(routeName: string) {
  return ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
    const set = icons[routeName];
    if (!set) return null;
    return <Ionicons name={focused ? set.focused : set.unfocused} size={size} color={color} />;
  };
}