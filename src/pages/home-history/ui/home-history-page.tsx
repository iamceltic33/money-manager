import { usePathname, useRouter } from 'expo-router';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useHistoryTransition } from '../model/use-history-transition';
import { createHistoryWheel } from '../model/create-history-wheel';
import { OperationSwitcher } from '@/widgets/operation-switcher';
import { Totals } from '@/widgets/totals';
import { QueryStatus } from '@/shared/ui/query-status';
import { Check, ChevronDown, ChevronRight, ChevronUp, SlidersHorizontal, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type WheelEvent } from 'react';
import { BackHandler, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, View, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryIcon, useCategoryStore } from '@/entities/category';
import { type LocalTransaction, type LocalTransactionType, TransactionRow, useTransactionPages, useTransactionsStore } from '@/entities/transaction';
import { MaxContentWidth, Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { DateField } from '@/shared/ui/date-field';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';

type DateFilterPreset = 'today' | 'week' | 'month';
type DateFilterMode = DateFilterPreset | 'custom' | null;

type TransactionFilters = {
  categoryIds: string[];
  type: LocalTransactionType | null;
  date: {
    mode: DateFilterMode;
    from: Date;
    to: Date;
  };
};

const TYPE_FILTER_OPTIONS: {
  label: string;
  value: LocalTransactionType | null;
}[] = [
  { label: 'Все', value: null },
  { label: 'Расходы', value: 'expense' },
  { label: 'Доходы', value: 'income' },
];

const DATE_FILTER_OPTIONS: {
  label: string;
  value: DateFilterPreset;
}[] = [
  { label: 'Сегодня', value: 'today' },
  { label: 'Неделя', value: 'week' },
  { label: 'Месяц', value: 'month' },
];

export function HomeHistoryPage({ mode, active }: { mode: 'home' | 'history'; active: boolean }) {
  const expanded = mode === 'history';
  const router = useRouter();
  const pathname = usePathname();
  const balance = useTransactionsStore(state => state.balance);
  const recentTransactions = useTransactionsStore(state => state.recentTransactions);
  useEffect(() => {
    if (!active || pathname !== '/transactions') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.dismissTo('/');
      return true;
    });
    return () => subscription.remove();
  }, [active, pathname, router]);

  const theme = useTheme();
  const categories = useCategoryStore((state) => state.categories);
  const [isFiltersVisible, setIsFiltersVisible] = useState(false);
  const changeMode = useCallback((next: boolean) => {
    if (next) router.navigate('/transactions');
    else router.dismissTo('/');
  }, [router]);
  const transition = useHistoryTransition({ expanded, enabled: active && !isFiltersVisible, onChange: changeMode });
  const [wheel] = useState(createHistoryWheel);
  useEffect(() => { wheel.reset(); }, [wheel, mode, active, isFiltersVisible]);
  const handleWheel = (event: WheelEvent<HTMLElement>) => {
    if (active && !expanded && !isFiltersVisible && wheel.update(event.nativeEvent, Date.now())) changeMode(true);
  };
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>(createDefaultFilters);
  const { mode: filterMode, from: dateFrom, to: dateTo } = filters.date;
  const hasActiveFilters = filters.date.mode !== null || filters.type !== null
    || filters.categoryIds.length > 0;
  const categoryGroups = TYPE_FILTER_OPTIONS.filter((option) => option.value !== null
    && (filters.type === null || option.value === filters.type));

  const filterRange = useMemo(() => {
    if (!filterMode) return null;

    if (filterMode === 'custom') {
      return {
        from: startOfDay(dateFrom),
        to: endOfDay(dateTo),
      };
    }

    return getPresetRange(filterMode);
  }, [dateFrom, dateTo, filterMode]);

  const pageFilters = useMemo(() => ({
    type: filters.type,
    categoryIds: filters.categoryIds,
    dateFrom: filterRange?.from,
    dateTo: filterRange?.to,
  }), [filters.type, filters.categoryIds, filterRange]);
  const pages = useTransactionPages(pageFilters, expanded && active);
  const listRef = useRef<FlatList<LocalTransaction>>(null);
  const categoryMap = useMemo(() => new Map(categories.map(category => [category.id, category])), [categories]);
  const offsets = useRef({ home: 0, history: 0 });
  const restorePending = useRef(true);
  const anchors = useRef<{ home?: string; history?: string }>({});
  const listState = useRef({ mode, active, loading: pages.loading });
  useEffect(() => {
    listState.current = { mode, active, loading: pages.loading };
  }, [mode, active, pages.loading]);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<LocalTransaction>[] }) => {
    const current = listState.current;
    if (current.active && (current.mode === 'home' || !current.loading) && !restorePending.current && viewableItems[0]) {
      anchors.current[current.mode] = viewableItems[0].item.id;
    }
  }, []);
  useEffect(() => {
    restorePending.current = true;
  }, [pages.queryKey]);
  useEffect(() => {
    offsets.current.history = 0;
    anchors.current.history = undefined;
    restorePending.current = true;
  }, [pageFilters]);
  useEffect(() => {
    if (active) {
      restorePending.current = true;
    }
  }, [mode, active]);
  const restorePosition = useCallback(() => {
    if (!active || !restorePending.current || (expanded && pages.loading)) return;
    const data = expanded ? pages.items : recentTransactions;
    const index = data.findIndex(item => item.id === anchors.current[mode]);
    if (index >= 0) listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0 });
    else listRef.current?.scrollToOffset({ offset: offsets.current[mode], animated: false });
    restorePending.current = false;
  }, [active, expanded, pages.loading, pages.items, recentTransactions, mode]);
  useEffect(() => {
    restorePosition();
  }, [restorePosition]);


  const typeLabel = filters.type === null
    ? 'Все операции'
    : TYPE_FILTER_OPTIONS.find((option) => option.value === filters.type)!.label;
  const filterLabel = [
    typeLabel,
    filterMode ? getFilterLabel(filterMode) : null,
    filters.categoryIds.length > 0 ? `Категории: ${filters.categoryIds.length}` : null,
  ].filter(Boolean).join(' · ');

  const handleTypePress = (type: LocalTransactionType | null) => {
    setFilters((previous) => ({
      ...previous,
      type,
      categoryIds: type === null ? previous.categoryIds : previous.categoryIds.filter(
        (id) => categories.some((category) => category.id === id && category.type === type)
      ),
    }));
  };

  const handleCategoryPress = (id: string) => {
    setFilters((previous) => ({
      ...previous,
      categoryIds: previous.categoryIds.includes(id)
        ? previous.categoryIds.filter((categoryId) => categoryId !== id)
        : [...previous.categoryIds, id],
    }));
  };

  const handlePresetPress = (preset: DateFilterPreset) => {
    const range = getPresetRange(preset);

    setFilters((previous) => ({
      ...previous,
      date: { mode: preset, ...range },
    }));
  };

  const handleDateFromChange = (date: Date) => {
    const nextDate = startOfDay(date);

    setFilters((previous) => ({
      ...previous,
      date: {
        mode: 'custom',
        from: nextDate,
        to: nextDate > previous.date.to ? endOfDay(nextDate) : previous.date.to,
      },
    }));
  };

  const handleDateToChange = (date: Date) => {
    const nextDate = endOfDay(date);

    setFilters((previous) => ({
      ...previous,
      date: {
        mode: 'custom',
        from: nextDate < previous.date.from ? startOfDay(nextDate) : previous.date.from,
        to: nextDate,
      },
    }));
  };

  const resetFilter = () => {
    setFilters(createDefaultFilters());
  };

  const handleCustomPress = () => {
    setFilters((previous) => ({
      ...previous,
      date: { ...previous.date, mode: 'custom' },
    }));
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.historyContent}>
        <Animated.View
          pointerEvents={expanded ? 'none' : 'auto'}
          accessibilityElementsHidden={expanded}
          importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'}
          style={[styles.summaryClip, transition.summaryStyle]}
        >
          <View style={styles.homeSummary} onLayout={event => { transition.measureSummary(event.nativeEvent.layout.height); }}>
            <OperationSwitcher />
            <Totals balance={balance} />
          </View>
        </Animated.View>
        <View style={styles.headers}>
          <Animated.View
            pointerEvents={expanded ? 'auto' : 'none'}
            accessibilityElementsHidden={!expanded}
            importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
            style={[styles.pageHeader, styles.headerOverlay, transition.historyHeaderStyle]}
          >
            <View style={styles.titleBlock}>
              <ThemedText type="subtitle" style={styles.title}>
                Операции
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {filterLabel}
              </ThemedText>
            </View>

            <View style={styles.filterActions}>
              <Pressable
                accessibilityLabel={hasActiveFilters ? 'Фильтры, есть активные' : 'Фильтры'}
                accessibilityRole="button"
                onPress={() => setIsFiltersVisible(true)}
                style={({ pressed }) => [
                  styles.filterButton,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: hasActiveFilters ? '#2563EB' : theme.backgroundSelected,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <SlidersHorizontal
                  color={hasActiveFilters ? '#2563EB' : theme.text}
                  size={18}
                  strokeWidth={2.3}
                />
                <ThemedText
                  numberOfLines={1}
                  type="smallBold"
                  style={hasActiveFilters ? styles.filterButtonActiveText : undefined}
                >
                  Фильтры
                </ThemedText>
                {hasActiveFilters ? <View style={styles.filterActiveIndicator} /> : null}
              </Pressable>
              {hasActiveFilters ? (
                <Pressable
                  accessibilityLabel="Сбросить все фильтры"
                  accessibilityRole="button"
                  onPress={resetFilter}
                  style={({ pressed }) => [
                    styles.resetFiltersButton,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.backgroundSelected,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <X color={theme.text} size={18} strokeWidth={2.3} />
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
          <Animated.View
            pointerEvents={expanded ? 'none' : 'auto'}
            accessibilityElementsHidden={expanded}
            importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'}
            style={[styles.pageHeader, styles.headerOverlay, transition.homeHeaderStyle]}
          >
            <View style={styles.titleBlock}>
              <ThemedText type="smallBold">Последние операции</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Все операции"
                accessibilityHint="Открыть историю операций с фильтрами"
                onPress={() => changeMode(true)}
                style={({ pressed }) => [styles.openHistoryButton, pressed && styles.pressed]}
              >
                <ThemedText type="smallBold" style={styles.openHistoryText}>Все операции</ThemedText>
                <ChevronRight color="#2563EB" size={16} />
              </Pressable>
            </View>
            <Pressable
              onPress={() => router.push('/reports')}
              accessibilityRole="button"
              accessibilityLabel="Открыть отчёты"
              style={[styles.reportsButton, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="smallBold">Отчёты</ThemedText>
            </Pressable>
          </Animated.View>
        </View>
        <GestureDetector gesture={transition.pan}>
          <View style={styles.listContainer} collapsable={false} {...(Platform.OS === 'web' ? { onWheel: handleWheel } : {})}>
            <GestureDetector gesture={transition.native}>
              <FlatList
                ref={listRef}
                data={expanded ? pages.items : recentTransactions}
                keyExtractor={item => item.id}
                extraData={categoryMap}
                renderItem={({ item }) => <TransactionRow transaction={item} category={categoryMap.get(item.category_id ?? '')} />}
                ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />}
                style={[styles.historyList, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
                contentContainerStyle={styles.historyListContent}
                onScroll={event => {
                  transition.updateScroll(event.nativeEvent.contentOffset.y);
                  if (active && (!expanded || !pages.loading) && !restorePending.current) offsets.current[mode] = event.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
                onViewableItemsChanged={onViewableItemsChanged}
                onScrollToIndexFailed={info => {
                  listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
                }}
                onContentSizeChange={restorePosition}
                scrollEnabled={expanded}
                bounces={false}
                overScrollMode="never"
                showsVerticalScrollIndicator={false}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={7}
                onEndReached={() => { if (expanded && active) void pages.loadMore(); }}
                onEndReachedThreshold={0.5}
                ListEmptyComponent={(!expanded || (!pages.loading && !pages.error)) ? (
                  <View style={styles.emptyState}>
                    <ThemedText type="smallBold">{expanded && hasActiveFilters ? 'Нет операций по выбранным фильтрам' : 'Операций пока нет'}</ThemedText>
                  </View>
                ) : null}
                ListFooterComponent={expanded && (pages.loading || pages.error) ? (
                  <QueryStatus loading={pages.loading} error={pages.error} retry={() => { void pages.loadMore(true); }} />
                ) : null}
              />
            </GestureDetector>
          </View>
        </GestureDetector>
      </View>

      <Modal
        animationType="fade"
        hardwareAccelerated
        onRequestClose={() => setIsFiltersVisible(false)}
        transparent
        visible={isFiltersVisible && expanded && active}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Закрыть фильтры"
            onPress={() => setIsFiltersVisible(false)}
            style={styles.backdrop}
          />

          <SafeAreaView
            edges={['bottom']}
            style={[styles.modalSafeArea, { backgroundColor: theme.background }]}
          >
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.backgroundSelected,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <View>
                  <ThemedText type="smallBold">Фильтры</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Тип, категории и период операций
                  </ThemedText>
                </View>

                <Pressable
                  accessibilityLabel="Закрыть фильтры"
                  accessibilityRole="button"
                  onPress={() => setIsFiltersVisible(false)}
                  style={({ pressed }) => [
                    styles.closeButton,
                    { backgroundColor: theme.backgroundElement },
                    pressed && styles.pressed,
                  ]}
                >
                  <X color={theme.text} size={20} strokeWidth={2.2} />
                </Pressable>
              </View>

              <ScrollView style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
                <ThemedText type="smallBold">Тип операции</ThemedText>
                <View style={styles.presetGrid}>
                  {TYPE_FILTER_OPTIONS.map((option) => {
                    const isSelected = filters.type === option.value;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={option.value ?? 'all'}
                        onPress={() => handleTypePress(option.value)}
                        style={({ pressed }) => [
                          styles.presetButton,
                          {
                            backgroundColor: isSelected ? '#2563EB' : theme.backgroundElement,
                            borderColor: isSelected ? '#2563EB' : theme.backgroundSelected,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <ThemedText
                          type="smallBold"
                          style={isSelected ? styles.presetButtonSelectedText : undefined}
                        >
                          {option.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isCategoriesExpanded }}
                  onPress={() => setIsCategoriesExpanded((previous) => !previous)}
                  style={({ pressed }) => [styles.categoryRow, pressed && styles.pressed]}
                >
                  <View style={styles.rowContent}>
                    <ThemedText type="smallBold">Категории</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {filters.categoryIds.length === 0
                        ? 'Все категории'
                        : `Выбрано: ${filters.categoryIds.length}`}
                    </ThemedText>
                  </View>
                  {isCategoriesExpanded
                    ? <ChevronUp color={theme.text} size={20} />
                    : <ChevronDown color={theme.text} size={20} />}
                </Pressable>

                {isCategoriesExpanded ? categoryGroups.map((group) => {
                  const groupCategories = categories.filter((category) => category.type === group.value);

                  return (
                    <View key={group.value} style={styles.categoryGroup}>
                      <ThemedText type="smallBold">{group.label}</ThemedText>
                      {groupCategories.length === 0 ? (
                        <ThemedText type="small" themeColor="textSecondary">Категорий пока нет</ThemedText>
                      ) : null}
                      {groupCategories.map((category) => {
                        const isSelected = filters.categoryIds.includes(category.id);

                        return (
                          <Pressable
                            key={category.id}
                            accessibilityRole="checkbox"
                            accessibilityLabel={category.name}
                            accessibilityState={{ checked: isSelected }}
                            onPress={() => handleCategoryPress(category.id)}
                            style={({ pressed }) => [styles.categoryRow, pressed && styles.pressed]}
                          >
                            <CategoryIcon name={category.icon} color={category.color ?? theme.text} />
                            <ThemedText type="small" style={styles.categoryName}>{category.name}</ThemedText>
                            <View style={[
                              styles.categoryCheckbox,
                              {
                                borderColor: isSelected ? '#2563EB' : theme.textSecondary,
                                backgroundColor: isSelected ? '#2563EB' : 'transparent',
                              },
                            ]}>
                              {isSelected ? <Check color="#FFFFFF" size={16} /> : null}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                }) : null}

                <ThemedText type="smallBold">Период</ThemedText>
                <View style={styles.presetGrid}>
                  {DATE_FILTER_OPTIONS.map((option) => {
                    const isSelected = filterMode === option.value;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={option.value}
                        onPress={() => handlePresetPress(option.value)}
                        style={({ pressed }) => [
                          styles.presetButton,
                          {
                            backgroundColor: isSelected ? '#2563EB' : theme.backgroundElement,
                            borderColor: isSelected ? '#2563EB' : theme.backgroundSelected,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <ThemedText
                          type="smallBold"
                          style={isSelected ? styles.presetButtonSelectedText : undefined}
                        >
                          {option.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={handleCustomPress}
                  style={({ pressed }) => [
                    styles.customButton,
                    {
                      backgroundColor: filterMode === 'custom' ? '#2563EB' : theme.backgroundElement,
                      borderColor: filterMode === 'custom' ? '#2563EB' : theme.backgroundSelected,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText
                    type="smallBold"
                    style={filterMode === 'custom' ? styles.presetButtonSelectedText : undefined}
                  >
                    Выбрать дату
                  </ThemedText>
                </Pressable>

                {filterMode === 'custom' ? (
                  <View style={styles.customRange}>
                    <DateField
                      label="От"
                      maximumDate={dateTo}
                      onChange={handleDateFromChange}
                      value={dateFrom}
                    />
                    <DateField
                      label="До"
                      minimumDate={dateFrom}
                      onChange={handleDateToChange}
                      value={dateTo}
                    />
                  </View>
                ) : null}

              </ScrollView>

              <View style={styles.modalActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={resetFilter}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.backgroundSelected,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">Сбросить</ThemedText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIsFiltersVisible(false)}
                  style={({ pressed }) => [
                    styles.applyButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText style={styles.applyButtonText}>Готово</ThemedText>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </ThemedView>
  );
}

function createDefaultFilters(): TransactionFilters {
  const now = new Date();

  return {
    categoryIds: [],
    type: null,
    date: { mode: null, from: startOfDay(now), to: endOfDay(now) },
  };
}

function getFilterLabel(filterMode: DateFilterMode) {
  if (filterMode === 'today') return 'Сегодня';
  if (filterMode === 'week') return 'Неделя';
  if (filterMode === 'month') return 'Месяц';
  if (filterMode === 'custom') return 'Выбранный период';

  return 'Все операции';
}

function getPresetRange(preset: DateFilterPreset) {
  const now = new Date();
  const from = startOfDay(now);
  const to = endOfDay(now);

  if (preset === 'week') {
    from.setDate(from.getDate() - 6);
  }

  if (preset === 'month') {
    from.setMonth(from.getMonth() - 1);
  }

  return { from, to };
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

function endOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);

  return nextDate;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  historyContent: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  summaryClip: { overflow: 'hidden' },
  // Measure the natural content height independently of the collapsing wrapper.
  homeSummary: { position: 'absolute', top: 0, left: 0, right: 0, gap: Spacing.three },
  headers: { minHeight: 72, marginBottom: Spacing.three },
  headerOverlay: { ...StyleSheet.absoluteFill },
  listContainer: { flex: 1 },
  openHistoryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.one, alignSelf: 'flex-start' },
  openHistoryText: { color: '#2563EB' },
  reportsButton: { minHeight: 56, paddingHorizontal: Spacing.three, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  historyList: { flex: 1, borderWidth: 1, borderRadius: 8 },
  historyListContent: { padding: Spacing.four },
  pageHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    textAlign: 'left',
  },
  filterButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  filterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  resetFiltersButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActiveText: {
    color: '#2563EB',
  },
  filterActiveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  emptyState: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  divider: {
    height: 1,
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.78,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
  },
  modalSafeArea: {
    width: '100%',
    maxHeight: '92%',
    overflow: 'hidden',
  },
  modalCard: {
    flexShrink: 1,
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  presetButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  presetButtonSelectedText: {
    color: '#FFFFFF',
  },
  customButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  customRange: {
    gap: Spacing.three,
  },
  modalActions: {
    flexShrink: 0,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  filtersScroll: {
    flexShrink: 1,
  },
  filtersContent: {
    gap: Spacing.three,
  },
  categoryGroup: {
    gap: Spacing.two,
  },
  categoryRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  categoryName: {
    flex: 1,
  },
  categoryCheckbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
