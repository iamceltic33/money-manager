import {
    BadgeDollarSign,
    Banknote,
    BriefcaseBusiness,
    Bus,
    Car,
    Coffee,
    Dumbbell,
    Gift,
    GraduationCap,
    HeartPulse,
    Home,
    Info,
    Landmark,
    Plane,
    Receipt,
    ShoppingBag,
    User,
    UsersRound,
    Utensils,
} from 'lucide-react-native';

export const CATEGORY_ICONS = {
  shopping: ShoppingBag,
  food: Utensils,
  coffee: Coffee,
  transport: Bus,
  car: Car,
  home: Home,
  health: HeartPulse,
  education: GraduationCap,
  travel: Plane,
  sport: Dumbbell,
  gift: Gift,
  salary: BriefcaseBusiness,
  cash: Banknote,
  bank: Landmark,
  receipt: Receipt,
  money: BadgeDollarSign,
  person: User,
  default: Info,
  people: UsersRound,
} as const;

export type CategoryIconName = keyof typeof CATEGORY_ICONS;

export const CATEGORY_ICON_OPTIONS = Object.keys(CATEGORY_ICONS) as CategoryIconName[];

export const FALLBACK_CATEGORY_ICON: CategoryIconName = 'receipt';
