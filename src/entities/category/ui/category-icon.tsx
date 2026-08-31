import { HelpCircle } from 'lucide-react-native';
import { CATEGORY_ICONS } from '../consts';
import type { CategoryIconName } from '../consts/icons';


type Props = {
  name?: string | null;
  color: string;
  size?: number;
  strokeWidth?: number;
};

export function CategoryIcon({ name, color, size = 20, strokeWidth = 2.3 }: Props) {
  const Icon =
    name && name in CATEGORY_ICONS
      ? CATEGORY_ICONS[name as CategoryIconName]
      : HelpCircle;

  return <Icon color={color} size={size} strokeWidth={strokeWidth} />;
}