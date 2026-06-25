import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { OperationsStackParamList, OperationType } from '../../navigation/types';
import { colors, spacing } from '../../theme/theme';
import { formatCurrency } from '../../utils/formatCurrency';
import { deleteOperation, getOperationsLimit, listOperations, Operation, OperationsLimit } from './api';

type Props = NativeStackScreenProps<OperationsStackParamList, 'OperationsList'>;

type TypeFilter = OperationType | 'ALL';
type PeriodFilter = 'ALL' | 'TODAY' | '7_DAYS' | 'THIS_MONTH';

type FilterOption<T> = {
  label: string;
  value: T;
};

const PAGE_SIZE = 20;

const TYPE_FILTERS: FilterOption<TypeFilter>[] = [
  { label: 'Tout', value: 'ALL' },
  { label: 'Ventes', value: 'VENTE' },
  { label: 'Achats', value: 'ACHAT' },
  { label: 'Dépenses', value: 'DEPENSE' },
  { label: 'Recettes', value: 'RECETTE' },
];

const PERIOD_FILTERS: FilterOption<PeriodFilter>[] = [
  { label: 'Tout', value: 'ALL' },
  { label: 'Aujourd’hui', value: 'TODAY' },
  { label: '7 jours', value: '7_DAYS' },
  { label: 'Ce mois', value: 'THIS_MONTH' },
];

const INCOME_TYPES: OperationType[] = ['VENTE', 'RECETTE'];

function toApiDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPeriodParams(period: PeriodFilter) {
  const today = new Date();

  if (period === 'TODAY') {
    const date = toApiDate(today);
    return { date_from: date, date_to: date };
  }

  if (period === '7_DAYS') {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return { date_from: toApiDate(start), date_to: toApiDate(today) };
  }

  if (period === 'THIS_MONTH') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { date_from: toApiDate(start), date_to: toApiDate(today) };
  }

  return {};
}

function getOperationSign(type: OperationType) {
  return INCOME_TYPES.includes(type) ? 1 : -1;
}

function getOperationTitle(operation: Operation) {
  return operation.article_name || operation.description || operation.type;
}

function shouldShowLimitWarning(limit: OperationsLimit | null) {
  if (!limit || limit.limit <= 0) {
    return false;
  }

  return limit.remaining <= 5 || limit.used / limit.limit >= 0.8;
}

export function OperationsScreen({ navigation, route }: Props) {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [limit, setLimit] = useState<OperationsLimit | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOperations = useCallback(
    async (nextPage = 1, mode: 'initial' | 'refresh' | 'more' = 'initial') => {
      if (mode === 'more') {
        setIsLoadingMore(true);
      } else if (mode === 'refresh') {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);

      try {
        const [operationsResponse, limitResponse] = await Promise.all([
          listOperations({
            ...getPeriodParams(periodFilter),
            limit: PAGE_SIZE,
            page: nextPage,
            search: search.trim() || undefined,
            type: typeFilter === 'ALL' ? undefined : typeFilter,
          }),
          getOperationsLimit().catch(() => null),
        ]);

        setOperations((currentOperations) => (nextPage === 1 ? operationsResponse.items : [...currentOperations, ...operationsResponse.items]));
        setLimit(limitResponse);
        setPage(operationsResponse.page);
        setTotalPages(operationsResponse.totalPages);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Impossible de charger les opérations.');
        if (nextPage === 1) {
          setOperations([]);
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        setIsRefreshing(false);
      }
    },
    [periodFilter, search, typeFilter],
  );

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  useEffect(() => {
    if (route.params?.initialOperationType) {
      navigation.navigate('OperationForm', { initialOperationType: route.params.initialOperationType });
    }
  }, [navigation, route.params?.initialOperationType]);

  const totals = useMemo(() => {
    return operations.reduce(
      (accumulator, operation) => {
        const signedAmount = operation.amount * getOperationSign(operation.type);

        if (signedAmount >= 0) {
          accumulator.income += signedAmount;
        } else {
          accumulator.expenses += Math.abs(signedAmount);
        }

        accumulator.balance += signedAmount;

        return accumulator;
      },
      { balance: 0, expenses: 0, income: 0 },
    );
  }, [operations]);

  async function removeOperation(operation: Operation) {
    try {
      await deleteOperation(operation.id);
      setOperations((currentOperations) => currentOperations.filter((currentOperation) => currentOperation.id !== operation.id));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Suppression impossible.');
    }
  }

  function loadMore() {
    if (!isLoadingMore && page < totalPages) {
      void loadOperations(page + 1, 'more');
    }
  }

  function renderOperation({ item }: { item: Operation }) {
    const isIncome = getOperationSign(item.type) > 0;

    return (
      <View style={styles.operationCard}>
        <View style={styles.operationHeader}>
          <View style={styles.operationTitleBlock}>
            <Text style={styles.operationTitle}>{getOperationTitle(item)}</Text>
            <Text style={styles.operationMeta}>{`${item.type} • ${item.op_date}`}</Text>
          </View>
          <Text style={[styles.operationAmount, isIncome ? styles.incomeText : styles.expenseText]}>
            {`${isIncome ? '+' : '-'} ${formatCurrency(item.amount)}`}
          </Text>
        </View>
        {item.quantity || item.supplier_name || item.description ? (
          <Text style={styles.operationDescription}>
            {[item.quantity ? `Qté ${item.quantity}` : null, item.supplier_name, item.description].filter(Boolean).join(' • ')}
          </Text>
        ) : null}
        <View style={styles.operationActions}>
          <Pressable style={styles.secondaryAction} onPress={() => navigation.navigate('OperationForm', { operationId: item.id, initialOperationType: item.type })}>
            <Text style={styles.secondaryActionText}>Modifier</Text>
          </Pressable>
          <Pressable style={styles.dangerAction} onPress={() => void removeOperation(item)}>
            <Text style={styles.dangerActionText}>Supprimer</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={operations}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderOperation}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} tintColor={colors.primary} onRefresh={() => void loadOperations(1, 'refresh')} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une opération"
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />

            <View style={styles.filtersRow}>
              {TYPE_FILTERS.map((filter) => (
                <Pressable key={filter.value} style={[styles.filterChip, typeFilter === filter.value && styles.activeFilterChip]} onPress={() => setTypeFilter(filter.value)}>
                  <Text style={[styles.filterText, typeFilter === filter.value && styles.activeFilterText]}>{filter.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.filtersRow}>
              {PERIOD_FILTERS.map((filter) => (
                <Pressable key={filter.value} style={[styles.filterChip, periodFilter === filter.value && styles.activeFilterChip]} onPress={() => setPeriodFilter(filter.value)}>
                  <Text style={[styles.filterText, periodFilter === filter.value && styles.activeFilterText]}>{filter.label}</Text>
                </Pressable>
              ))}
            </View>

            {shouldShowLimitWarning(limit) ? (
              <View style={styles.limitCard}>
                <Text style={styles.limitTitle}>Quota gratuit bientôt atteint</Text>
                <Text style={styles.limitText}>{`${limit?.used ?? 0}/${limit?.limit ?? 0} opérations utilisées ce mois-ci. Il reste ${limit?.remaining ?? 0} opération(s).`}</Text>
              </View>
            ) : null}

            <View style={styles.totalsRow}>
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>Entrées</Text>
                <Text style={styles.incomeText}>{formatCurrency(totals.income)}</Text>
              </View>
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>Sorties</Text>
                <Text style={styles.expenseText}>{formatCurrency(totals.expenses)}</Text>
              </View>
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>Solde</Text>
                <Text style={totals.balance >= 0 ? styles.incomeText : styles.expenseText}>{formatCurrency(totals.balance)}</Text>
              </View>
            </View>

            {isLoading ? (
              <View style={styles.stateCard}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.stateText}>Chargement des opérations…</Text>
              </View>
            ) : null}

            {!isLoading && error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Opérations indisponibles</Text>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable style={styles.retryButton} onPress={() => void loadOperations()}>
                  <Text style={styles.retryButtonText}>Réessayer</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !isLoading && !error ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Aucune opération</Text>
              <Text style={styles.emptyText}>Ajoutez votre première vente, dépense, recette ou achat pour suivre votre activité.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={isLoadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerLoader} /> : null}
      />

      <Pressable style={styles.floatingButton} onPress={() => navigation.navigate('OperationForm')}>
        <Text style={styles.floatingButtonText}>+ Ajouter</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  listContent: { gap: spacing.md, padding: spacing.lg, paddingBottom: 96 },
  headerContent: { gap: spacing.md },
  searchInput: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, color: colors.text, fontSize: 16, padding: 14 },
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterChip: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  activeFilterChip: { backgroundColor: '#ccfbf1', borderColor: colors.primary },
  filterText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  activeFilterText: { color: colors.primaryDark },
  limitCard: { backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderRadius: 16, borderWidth: 1, gap: 4, padding: spacing.md },
  limitTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  limitText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  totalsRow: { flexDirection: 'row', gap: spacing.sm },
  totalCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, flex: 1, gap: 4, padding: spacing.md },
  totalLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  incomeText: { color: '#16a34a', fontSize: 15, fontWeight: '800' },
  expenseText: { color: '#dc2626', fontSize: 15, fontWeight: '800' },
  stateCard: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  stateText: { color: colors.muted, fontSize: 14 },
  errorCard: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderRadius: 18, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  errorTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  errorText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  retryButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  retryButtonText: { color: colors.card, fontWeight: '800' },
  emptyCard: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  operationCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  operationHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  operationTitleBlock: { flex: 1, gap: 2 },
  operationTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  operationMeta: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  operationAmount: { fontSize: 15, minWidth: 96, textAlign: 'right' },
  operationDescription: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  operationActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  secondaryAction: { borderColor: colors.border, borderRadius: 12, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  secondaryActionText: { color: colors.primaryDark, fontWeight: '800' },
  dangerAction: { borderColor: '#fecaca', borderRadius: 12, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  dangerActionText: { color: '#dc2626', fontWeight: '800' },
  footerLoader: { marginVertical: spacing.md },
  floatingButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 999, bottom: spacing.lg, elevation: 4, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, position: 'absolute', right: spacing.lg, shadowColor: colors.primary, shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.24, shadowRadius: 16 },
  floatingButtonText: { color: colors.card, fontSize: 16, fontWeight: '800' },
});
