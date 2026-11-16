import React from 'react';
import {
  AlertTriangle,
  Bell,
  Bug,
  Droplets,
  Flame,
  HelpCircle,
  ShieldAlert,
  Sparkles,
  Utensils,
  Volume2,
  Wifi,
  Wind,
  Wrench,
} from 'lucide-react';

interface CategoryIconProps {
  name: string;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ name, className = 'w-5 h-5' }) => {
  switch (name) {
    case 'Bug':
      return <Bug className={className} />;
    case 'AlertTriangle':
      return <AlertTriangle className={className} />;
    case 'Volume2':
      return <Volume2 className={className} />;
    case 'Wind':
      return <Wind className={className} />;
    case 'Droplets':
      return <Droplets className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'Wrench':
      return <Wrench className={className} />;
    case 'Utensils':
      return <Utensils className={className} />;
    case 'Wifi':
      return <Wifi className={className} />;
    case 'Flame':
      return <Flame className={className} />;
    case 'ShieldAlert':
      return <ShieldAlert className={className} />;
    case 'Bell':
      return <Bell className={className} />;
    default:
      return <HelpCircle className={className} />;
  }
};

export const AVAILABLE_CATEGORY_ICONS = [
  'Bug',
  'AlertTriangle',
  'Volume2',
  'Wind',
  'Droplets',
  'Sparkles',
  'Wrench',
  'Utensils',
  'Wifi',
  'Flame',
  'ShieldAlert',
];
