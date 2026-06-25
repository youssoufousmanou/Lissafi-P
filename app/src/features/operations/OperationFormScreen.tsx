import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { OperationType, OperationsStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme/theme';
import { createOperation, OperationPayload, updateOperation } from './api';

type Props = NativeStackScreenProps<OperationsStackParamList, 'OperationForm'>;

type FormErrors = Partial<Record<keyof OperationPayload, string>>;

type TypeOption = {
  label: string;
  value: OperationType;
};

const TYPE_OPTIONS: TypeOption[] = [
  { label: 'VENTE', value: 'VENTE' },
  { label: 'ACHAT', value: 'ACHAT' },
  { label: 'DÉPENSE', value: 'DEPENSE' },
  { label: 'RECETTE', value: 'RECETTE' },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeInteger(value: string) {
  return value.replace(/\D/g, '');
}

function validateDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

export function OperationFormScreen({ navigation, route }: Props) {
  const isEditing = Boolean(route.params?.operationId);
  const [type, setType] = useState<OperationType | null>(route.params?.initialOperationType ?? null);
  const [amount, setAmount] = useState('');
  const [articleName, setArticleName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [opDate, setOpDate] = useState(today());
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = useMemo(() => (isEditing ? 'Modifier l’opération' : 'Ajouter une opération'), [isEditing]);

  function validateForm() {
    const nextErrors: FormErrors = {};
    const parsedAmount = Number(amount);
    const parsedDate = new Date(`${opDate}T00:00:00`);
    const currentDate = new Date(`${today()}T00:00:00`);

    if (!type) {
      nextErrors.type = 'Choisissez un type.';
    }

    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      nextErrors.amount = 'Le montant doit être un entier positif.';
    }

    if (!articleName.trim()) {
      nextErrors.article_name = 'Le nom de l’article est obligatoire.';
    }

    if (!validateDate(opDate)) {
      nextErrors.op_date = 'Utilisez une date au format AAAA-MM-JJ.';
    } else if (parsedDate > currentDate) {
      nextErrors.op_date = 'La date ne peut pas être future.';
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function submit() {
    if (!validateForm() || !type) {
      return;
    }

    const payload: OperationPayload = {
      amount: Number(amount),
      article_name: articleName.trim(),
      description: description.trim() || undefined,
      op_date: opDate,
      quantity: quantity ? Number(quantity) : undefined,
      supplier_name: supplierName.trim() || undefined,
      type,
    };

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (route.params?.operationId) {
        await updateOperation(route.params.operationId, payload);
      } else {
        await createOperation(payload);
      }

      navigation.goBack();
    } catch (nextError) {
      setFormError(nextError instanceof Error ? nextError.message : 'Impossible d’enregistrer l’opération.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Renseignez les informations nécessaires au suivi de votre activité.</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Type d’opération *</Text>
        <View style={styles.typeGrid}>
          {TYPE_OPTIONS.map((option) => (
            <Pressable key={option.value} style={[styles.typeChip, type === option.value && styles.activeTypeChip]} onPress={() => setType(option.value)}>
              <Text style={[styles.typeChipText, type === option.value && styles.activeTypeChipText]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        {errors.type ? <Text style={styles.errorText}>{errors.type}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Montant entier *</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder="Ex. 15000"
          placeholderTextColor={colors.muted}
          value={amount}
          onChangeText={(value) => setAmount(normalizeInteger(value))}
        />
        {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Article / motif *</Text>
        <TextInput style={styles.input} placeholder="Nom de l’article" placeholderTextColor={colors.muted} value={articleName} onChangeText={setArticleName} />
        {errors.article_name ? <Text style={styles.errorText}>{errors.article_name}</Text> : null}
      </View>

      <View style={styles.twoColumns}>
        <View style={[styles.fieldGroup, styles.column]}>
          <Text style={styles.label}>Quantité</Text>
          <TextInput style={styles.input} keyboardType="number-pad" placeholder="1" placeholderTextColor={colors.muted} value={quantity} onChangeText={(value) => setQuantity(normalizeInteger(value))} />
        </View>
        <View style={[styles.fieldGroup, styles.column]}>
          <Text style={styles.label}>Date *</Text>
          <TextInput style={styles.input} placeholder="AAAA-MM-JJ" placeholderTextColor={colors.muted} value={opDate} onChangeText={setOpDate} />
          {errors.op_date ? <Text style={styles.errorText}>{errors.op_date}</Text> : null}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Fournisseur</Text>
        <TextInput style={styles.input} placeholder="Nom du fournisseur" placeholderTextColor={colors.muted} value={supplierName} onChangeText={setSupplierName} />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          placeholder="Note complémentaire"
          placeholderTextColor={colors.muted}
          value={description}
          onChangeText={setDescription}
        />
      </View>

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <Pressable style={[styles.submitButton, isSubmitting && styles.disabledButton]} onPress={() => void submit()} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color={colors.card} /> : <Text style={styles.submitButtonText}>{isEditing ? 'Enregistrer' : 'Ajouter'}</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl },
  header: { gap: spacing.sm },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  fieldGroup: { gap: spacing.sm },
  label: { color: colors.text, fontSize: 14, fontWeight: '800' },
  input: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, fontSize: 16, padding: 14 },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeChip: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  activeTypeChip: { backgroundColor: '#ccfbf1', borderColor: colors.primary },
  typeChipText: { color: colors.muted, fontWeight: '800' },
  activeTypeChipText: { color: colors.primaryDark },
  twoColumns: { flexDirection: 'row', gap: spacing.md },
  column: { flex: 1 },
  errorText: { color: '#dc2626', fontSize: 13 },
  formError: { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  submitButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 16, marginTop: spacing.sm, padding: 16 },
  disabledButton: { opacity: 0.7 },
  submitButtonText: { color: colors.card, fontSize: 16, fontWeight: '800' },
});
