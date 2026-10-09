export type Size = 'S' | 'M' | 'L';
export type ExtraId = 'postcard' | 'vase';
export type Availability = 'ready' | 'preorder' | 'unavailable';
export interface Product {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  composition: string;
  category: 'Монобукеты' | 'Сборные букеты';
  tone: 'Светлые' | 'Розовые' | 'Яркие';
  image: string;
  images: string[];
  imagePosition: string;
  photoSize: Size;
  prices: Record<Size, number>;
  sizeDescriptions: Record<Size, string>;
  availability: Availability;
  preparationDays: number;
  published: boolean;
  sortOrder: number;
  version: number;
  readyToday: boolean;
  label?: string;
}
export interface Extra {
  id: ExtraId;
  name: string;
  price: number;
  description: string;
  symbol: 'card' | 'vase';
  enabled: boolean;
}
export interface ShopSettings {
  demoMode: boolean;
  pickupEnabled: boolean;
  courierEnabled: boolean;
  deliveryPrice: number;
  pickupAddress: string;
  contactPhone: string;
  contactTelegram: string;
  timezone: 'Asia/Yekaterinburg';
  workingDays: number[];
  closedDates: string[];
  timeSlots: string[];
  sameDayCutoff: number;
  sameDayLeadHours: number;
  bookingDays: number;
  dailyCapacity: number;
  heroProductId: string;
}
export interface CatalogSnapshot {
  products: Product[];
  extras: Extra[];
  settings: ShopSettings;
  revision: number;
  serverTime: string;
}
export const defaultSettings: ShopSettings = {
  demoMode: true, pickupEnabled: true, courierEnabled: true,
  deliveryPrice: 400, pickupAddress: '', contactPhone: '', contactTelegram: '',
  timezone: 'Asia/Yekaterinburg', workingDays: [1, 2, 3, 4, 5, 6, 7], closedDates: [],
  timeSlots: ['10:00–13:00', '13:00–16:00', '16:00–19:00'],
  sameDayCutoff: 16, sameDayLeadHours: 2, bookingDays: 30, dailyCapacity: 20,
  heroProductId: 'pink-lilac',
};
export const orderStatuses = ['new', 'confirmed', 'preparing', 'delivery', 'completed', 'cancelled'] as const;
export type OrderStatus = typeof orderStatuses[number];
export const statusLabels: Record<OrderStatus, string> = {
  new: 'Новый', confirmed: 'Подтверждён', preparing: 'В работе',
  delivery: 'В доставке', completed: 'Завершён', cancelled: 'Отменён',
};
export const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'],
  preparing: ['delivery', 'completed', 'cancelled'], delivery: ['completed', 'cancelled'],
  completed: [], cancelled: [],
};
export interface OrderRecord {
  id: number;
  number: string;
  kind: 'catalog' | 'custom';
  status: OrderStatus;
  date: string;
  total: number | null;
  finalTotal: number | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  data: {
    buyerName: string; buyerPhone: string;
    recipientName?: string; recipientPhone?: string;
    delivery?: 'courier' | 'pickup'; address?: string; timeSlot?: string;
    comment: string; budget?: number; contactMethod?: 'phone' | 'telegram'; contact?: string;
    demo: boolean; deliveryPrice?: number;
    lines?: { productId: string; name: string; size: Size; quantity: number;
      unitPrice: number; bouquetPrice: number; extras: { id: ExtraId; name: string; price: number }[] }[];
  };
  events: { at: string; status: OrderStatus; note: string }[];
  notification: { state: string; attempts: number } | null;
}
