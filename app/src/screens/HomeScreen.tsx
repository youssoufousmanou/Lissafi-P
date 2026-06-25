import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DailySummary, getDailySummary } from '../features/operations/api';
import { MainTabParamList, OperationType } from '../navigation/types';
import { colors, spacing } from '../theme/theme';
import { formatCurrency } from '../utils/formatCurrency';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

type SummaryMetric = {
  label: string;
  value: number;
  accent: string;
  helper?: string;
};

type QuickAction = {
  label: string;
  type: OperationType;
  icon: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { icon: '🛒', label: 'VENTE', type: 'VENTE' },
  { icon: '📦', label: 'ACHAT', type: 'ACHAT' },
  { icon: '💸', label: 'DÉPENSE', type: 'DEPENSE' },
  { icon: '💰', label: 'RECETTE', type: 'RECETTE' },
];

function getSummaryValue(summary: DailySummary | null, key: keyof NonNullable<DailySummary['totals']>) {
  return summary?.[key] ?? summary?.totals?.[key] ?? 0;
}

export function HomeScreen({ navigation }: Props) {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDailySummary = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    try {
      const nextSummary = await getDailySummary();
      setSummary(nextSummary);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Impossible de charger les indicateurs du jour.');
      setSummary(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDailySummary();
  }, [loadDailySummary]);

  const metrics = useMemo<SummaryMetric[]>(
    () => [
      { accent: colors.primary, label: 'Bénéfice du jour', value: getSummaryValue(summary, 'profit') },
      { accent: '#16a34a', label: 'Recettes', value: getSummaryValue(summary, 'revenue') },
      { accent: '#dc2626', label: 'Dépenses', value: getSummaryValue(summary, 'expenses') },
      { accent: '#2563eb', label: 'Ventes', value: getSummaryValue(summary, 'sales') },
      { accent: '#9333ea', label: 'Achats', value: getSummaryValue(summary, 'purchases') },
      { accent: '#f59e0b', helper: 'Suivi Pro bientôt disponible', label: 'Dettes', value: getSummaryValue(summary, 'debts') },
    ],
    [summary],
  );

  const hasActivity = metrics.some((metric) => metric.value !== 0);

  function openOperationForm(type: OperationType) {
    navigation.navigate('Operations', { screen: 'OperationForm', params: { initialOperationType: type } });
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} tintColor={colors.primary} onRefresh={() => void loadDailySummary('refresh')} />}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Aujourd’hui</Text>
        <Text style={styles.title}>Tableau de bord</Text>
        <Text style={styles.subtitle}>Suivez votre activité et ajoutez rapidement vos opérations.</Text>
      </View>

      {isLoading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Chargement des indicateurs financiers…</Text>
        </View>
      ) : null}

      {!isLoading && error ? (
        <View style={styles.offlineCard}>
          <Text style={styles.offlineTitle}>Données indisponibles</Text>
          <Text style={styles.offlineText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadDailySummary()}>
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !error ? (
        <View style={styles.metricsContainer}>
          {!hasActivity ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Aucune opération aujourd’hui</Text>
              <Text style={styles.emptyText}>Ajoutez une vente, un achat, une dépense ou une recette pour alimenter vos indicateurs.</Text>
            </View>
          ) : null}
          <View style={styles.metricsGrid}>
            {metrics.map((metric) => (
              <View key={metric.label} style={styles.metricCard}>
                <View style={[styles.metricAccent, { backgroundColor: metric.accent }]} />
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text style={styles.metricValue}>{formatCurrency(metric.value)}</Text>
                {metric.helper ? <Text style={styles.metricHelper}>{metric.helper}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.quickActionsSection}>
        <View>
          <Text style={styles.sectionTitle}>Actions rapides</Text>
          <Text style={styles.sectionSubtitle}>Préparez le formulaire avec le bon type d’opération.</Text>
        </View>
        <View style={styles.quickActionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable key={action.type} style={styles.quickAction} onPress={() => openOperationForm(action.type)}>
              <Text style={styles.quickActionIcon}>{action.icon}</Text>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xl },
  header: { gap: spacing.sm },
  eyebrow: { color: colors.primaryDark, fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  stateCard: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  stateText: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  offlineCard: { backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderRadius: 20, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  offlineTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  offlineText: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  retryButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: 14, marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  retryButtonText: { color: colors.card, fontSize: 14, fontWeight: '800' },
  metricsContainer: { gap: spacing.md },
  emptyCard: { backgroundColor: '#f0fdfa', borderColor: '#99f6e4', borderRadius: 18, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 18, borderWidth: 1, flexBasis: '47%', flexGrow: 1, gap: spacing.sm, minHeight: 136, padding: spacing.md },
  metricAccent: { borderRadius: 999, height: 5, width: 44 },
  metricLabel: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  metricValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  metricHelper: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  quickActionsSection: { gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  sectionSubtitle: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 2 },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  quickAction: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 18, borderWidth: 1, flexBasis: '47%', flexGrow: 1, gap: spacing.sm, padding: spacing.md },
  quickActionIcon: { fontSize: 26 },
  quickActionLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
});
