import type { Product, Size } from '../lib/catalog-types.ts';
export type { Product, Size, ExtraId } from '../lib/catalog-types.ts';
// Все товары, составы, цены и условия — демонстрационные.
export const products: Product[] = [
  {
    id: 'pink-roses', name: 'Розовые розы', subtitle: 'Розы · светлая упаковка',
    description: 'Нежный розовый букет, который легко представить и на дне рождения, и в самый обычный вторник. Лёгкая упаковка оставляет всё внимание цветам.',
    composition: 'Розовые розы, декоративная зелень, бумажная упаковка, лента.',
    category: 'Монобукеты', tone: 'Розовые', image: '/images/pink.jpg', imagePosition: '50% 46%',
    prices: { S: 2490, M: 3490, L: 4890 }, readyToday: true, label: 'Выбор мастерской',
  },
  {
    id: 'cream-roses', name: 'Кремовые розы', subtitle: 'Розы · тёплые оттенки',
    description: 'Тёплые кремовые оттенки и простое оформление. Небольшой знак внимания, который подходит для дома, встречи и подарка без повода.',
    composition: 'Кремовые розы, зелень, бумажная упаковка, лента.',
    category: 'Монобукеты', tone: 'Светлые', image: '/images/cream.jpg', imagePosition: '52% 50%',
    prices: { S: 1990, M: 2590, L: 3690 }, readyToday: true,
  },
  {
    id: 'pink-lilac', name: 'Розовый и сиреневый', subtitle: 'Сборный букет · пастель',
    description: 'Розовые и сиреневые цветы в мягкой упаковке. Фактурный букет для тех, кому нравятся спокойные оттенки и чуть более свободная форма.',
    composition: 'Розы, сезонные цветы в сиреневых оттенках, зелень, упаковка.',
    category: 'Сборные букеты', tone: 'Розовые', image: '/images/lilac.jpg', imagePosition: '50% 58%',
    prices: { S: 3190, M: 4290, L: 5890 }, readyToday: true, label: 'Нежные оттенки',
  },
  {
    id: 'white-bouquet', name: 'Светлый букет', subtitle: 'Белые цветы · зелёные акценты',
    description: 'Светлая композиция с зелёными деталями. Сдержанный вариант для поздравления, благодарности или небольшого семейного праздника.',
    composition: 'Сезонные белые цветы, декоративная зелень, упаковка.',
    category: 'Сборные букеты', tone: 'Светлые', image: '/images/white.jpg', imagePosition: '70% 50%',
    prices: { S: 2890, M: 3890, L: 5290 }, readyToday: false,
  },
  {
    id: 'peach-purple', name: 'Персиковый и сливовый', subtitle: 'Розы · сезонные цветы',
    description: 'Персиковые розы и глубокие сливовые оттенки. Выразительный букет с интересным сочетанием цветов, который приятно рассматривать вблизи.',
    composition: 'Персиковые розы, сезонные цветы в сливовых оттенках, зелень, упаковка.',
    category: 'Сборные букеты', tone: 'Яркие', image: '/images/mix.jpg', imagePosition: '50% 60%',
    prices: { S: 4190, M: 5490, L: 7390 }, readyToday: false, label: 'Особенный повод',
  },
  {
    id: 'red-roses', name: 'Красные розы', subtitle: 'Розы · лаконичная упаковка',
    description: 'Красные розы в необычной бумажной упаковке. Классическое сочетание, в котором цвет и фактура говорят сами за себя.',
    composition: 'Красные розы, декоративные цветы и зелень, бумажная упаковка.',
    category: 'Монобукеты', tone: 'Яркие', image: '/images/red.jpg', imagePosition: '50% 65%',
    prices: { S: 2390, M: 3190, L: 4590 }, readyToday: true,
  },
  {
    id: 'pastel-mix', name: 'Пастельный микс', subtitle: 'Сборный букет · мягкие оттенки',
    description: 'Объёмный букет в розовых и сиреневых оттенках. Хорошо подходит для поздравления близкого человека и спокойного, красивого подарка.',
    composition: 'Розы, сезонные цветы, эвкалипт, бумажная упаковка, лента.',
    category: 'Сборные букеты', tone: 'Розовые', image: '/images/pastel.jpg', imagePosition: '52% 55%',
    prices: { S: 3390, M: 4490, L: 6190 }, readyToday: true,
  },
  {
    id: 'garden-bouquet', name: 'Садовый букет', subtitle: 'Сезонные цветы · свободная форма',
    description: 'Воздушный букет с зеленью и небольшими розовыми цветами. Для тех, кто любит живую, чуть небрежную форму садовых композиций.',
    composition: 'Розы, сезонные цветы, декоративная зелень, бумажная упаковка.',
    category: 'Сборные букеты', tone: 'Розовые', image: '/images/spring.jpg', imagePosition: '50% 50%',
    prices: { S: 2290, M: 2990, L: 4190 }, readyToday: true,
  },
].map((product, index) => ({ ...product, category: product.category as Product["category"], tone: product.tone as Product["tone"], images: [product.image], photoSize: "M" as const, sizeDescriptions: { S: "Небольшой букет", M: "Средний букет", L: "Большой букет" }, availability: product.readyToday ? "ready" as const : "preorder" as const, preparationDays: product.readyToday ? 0 : 1, published: true, sortOrder: index, version: 1 }));

export const extras = [
  { id: 'postcard', name: 'Открытка', price: 150, description: 'Добавим ваши слова к букету', symbol: 'card', enabled: true },
  { id: 'vase', name: 'Стеклянная ваза', price: 790, description: 'Чтобы сразу поставить цветы', symbol: 'vase', enabled: true },
] as const;

export const sizes: { id: Size; label: string; description: string }[] = [
  { id: 'S', label: 'Небольшой', description: 'Лёгкий знак внимания' },
  { id: 'M', label: 'Средний', description: 'На фото этот размер' },
  { id: 'L', label: 'Большой', description: 'Для особенного повода' },
];
export const formatPrice = (value: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' ₽';
export const getProduct = (id: string) => products.find((product) => product.id === id);
