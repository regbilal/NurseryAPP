import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { colors, radius, space } from '../theme';
import {
  Card,
  Field,
  InlineAction,
  Muted,
  PrimaryButton,
  RowActions,
  SectionLabel,
  TextLinkButton,
} from '../ui';

type ChildHealth = {
  allergies?: { id: string; name: string; severity: string }[];
  vaccines?: { id: string; name: string; administeredOn?: string; dueOn?: string }[];
  medications?: { id: string; name: string; dosage: string; schedule: string; active: boolean }[];
  pickups?: { id: string; fullName: string; relation: string; phone: string; pin: string }[];
};

function fmtDate(d: unknown) {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  return String(d);
}

function HealthRecordRow({
  title,
  subtitle,
  canEdit,
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
}: {
  title: string;
  subtitle?: string;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
  editLabel: string;
  deleteLabel: string;
}) {
  return (
    <View style={rowStyles.wrap}>
      <View style={rowStyles.body}>
        <Text style={rowStyles.title} numberOfLines={2}>{title}</Text>
        {subtitle ? <Muted>{subtitle}</Muted> : null}
      </View>
      {canEdit ? (
        <RowActions>
          <InlineAction label={editLabel} onPress={onEdit} />
          <InlineAction label={deleteLabel} variant="delete" onPress={() => void onDelete()} />
        </RowActions>
      ) : null}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.sm,
    marginBottom: space.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  body: { flex: 1, minWidth: 0, paddingRight: space.xs },
  title: { color: colors.ink, fontWeight: '700', fontSize: 15 },
});

export function ChildHealthPanel({
  childId,
  child,
  canEdit,
  onReload,
}: {
  childId: string;
  child: ChildHealth;
  canEdit: boolean;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [allergyForm, setAllergyForm] = useState({ name: '', severity: '' });
  const [editingAllergyId, setEditingAllergyId] = useState<string | null>(null);
  const [vaccineForm, setVaccineForm] = useState({ name: '', administeredOn: '', dueOn: '' });
  const [editingVaccineId, setEditingVaccineId] = useState<string | null>(null);
  const [medForm, setMedForm] = useState({ name: '', dosage: '', schedule: '', active: true });
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [pickupForm, setPickupForm] = useState({ fullName: '', relation: '', phone: '', pin: '' });
  const [editingPickupId, setEditingPickupId] = useState<string | null>(null);

  const resetAllergy = () => {
    setEditingAllergyId(null);
    setAllergyForm({ name: '', severity: '' });
  };
  const resetVaccine = () => {
    setEditingVaccineId(null);
    setVaccineForm({ name: '', administeredOn: '', dueOn: '' });
  };
  const resetMed = () => {
    setEditingMedId(null);
    setMedForm({ name: '', dosage: '', schedule: '', active: true });
  };
  const resetPickup = () => {
    setEditingPickupId(null);
    setPickupForm({ fullName: '', relation: '', phone: '', pin: '' });
  };

  const saveAllergy = async () => {
    const body = { name: allergyForm.name.trim(), severity: allergyForm.severity.trim() || t('high') };
    if (editingAllergyId) {
      await api(`/api/children/${childId}/allergies/${editingAllergyId}`, { method: 'PATCH', body: JSON.stringify(body) });
    } else {
      await api(`/api/children/${childId}/allergies`, { method: 'POST', body: JSON.stringify(body) });
    }
    resetAllergy();
    await onReload();
  };

  const saveVaccine = async () => {
    const body = {
      name: vaccineForm.name.trim(),
      administeredOn: vaccineForm.administeredOn.trim() || null,
      dueOn: vaccineForm.dueOn.trim() || null,
    };
    if (editingVaccineId) {
      await api(`/api/children/${childId}/vaccines/${editingVaccineId}`, { method: 'PATCH', body: JSON.stringify(body) });
    } else {
      await api(`/api/children/${childId}/vaccines`, { method: 'POST', body: JSON.stringify(body) });
    }
    resetVaccine();
    await onReload();
  };

  const saveMed = async () => {
    const body = {
      name: medForm.name.trim(),
      dosage: medForm.dosage.trim(),
      schedule: medForm.schedule.trim(),
      active: medForm.active,
    };
    if (editingMedId) {
      await api(`/api/children/${childId}/medications/${editingMedId}`, { method: 'PATCH', body: JSON.stringify(body) });
    } else {
      await api(`/api/children/${childId}/medications`, { method: 'POST', body: JSON.stringify(body) });
    }
    resetMed();
    await onReload();
  };

  const savePickup = async () => {
    const body = {
      fullName: pickupForm.fullName.trim(),
      relation: pickupForm.relation.trim(),
      phone: pickupForm.phone.trim(),
      pin: pickupForm.pin.trim() || undefined,
    };
    if (editingPickupId) {
      await api(`/api/children/${childId}/pickups/${editingPickupId}`, { method: 'PATCH', body: JSON.stringify(body) });
    } else {
      await api(`/api/children/${childId}/pickups`, { method: 'POST', body: JSON.stringify(body) });
    }
    resetPickup();
    await onReload();
  };

  const actionLabels = { edit: t('edit'), delete: t('delete') };

  return (
    <>
      <Card>
        <SectionLabel>{t('health')}</SectionLabel>
        <View style={{ marginBottom: space.sm }}><Muted>{t('allergies')}</Muted></View>
        {(child.allergies ?? []).map((a) => (
          <HealthRecordRow
            key={a.id}
            title={a.name}
            subtitle={a.severity}
            canEdit={canEdit}
            editLabel={actionLabels.edit}
            deleteLabel={actionLabels.delete}
            onEdit={() => {
              setEditingAllergyId(a.id);
              setAllergyForm({ name: a.name, severity: a.severity });
            }}
            onDelete={async () => {
              await api(`/api/children/${childId}/allergies/${a.id}`, { method: 'DELETE' });
              await onReload();
            }}
          />
        ))}
        {canEdit ? (
          <>
            <Field value={allergyForm.name} onChangeText={(v) => setAllergyForm({ ...allergyForm, name: v })} placeholder={t('allergies')} />
            <Field value={allergyForm.severity} onChangeText={(v) => setAllergyForm({ ...allergyForm, severity: v })} placeholder={t('severity')} />
            <PrimaryButton label={editingAllergyId ? t('save') : t('addAllergy')} onPress={() => void saveAllergy()} />
            {editingAllergyId ? <TextLinkButton label={t('cancel')} onPress={resetAllergy} /> : null}
          </>
        ) : null}

        <View style={{ marginTop: space.md, marginBottom: space.sm }}><Muted>{t('vaccines')}</Muted></View>
        {(child.vaccines ?? []).map((v) => (
          <HealthRecordRow
            key={v.id}
            title={v.name}
            subtitle={v.administeredOn ? fmtDate(v.administeredOn) : `${t('due')} ${fmtDate(v.dueOn)}`}
            canEdit={canEdit}
            editLabel={actionLabels.edit}
            deleteLabel={actionLabels.delete}
            onEdit={() => {
              setEditingVaccineId(v.id);
              setVaccineForm({
                name: v.name,
                administeredOn: fmtDate(v.administeredOn),
                dueOn: fmtDate(v.dueOn),
              });
            }}
            onDelete={async () => {
              await api(`/api/children/${childId}/vaccines/${v.id}`, { method: 'DELETE' });
              await onReload();
            }}
          />
        ))}
        {canEdit ? (
          <>
            <Field value={vaccineForm.name} onChangeText={(v) => setVaccineForm({ ...vaccineForm, name: v })} placeholder={t('vaccineName')} />
            <Field value={vaccineForm.administeredOn} onChangeText={(v) => setVaccineForm({ ...vaccineForm, administeredOn: v })} placeholder={t('administeredOn')} />
            <Field value={vaccineForm.dueOn} onChangeText={(v) => setVaccineForm({ ...vaccineForm, dueOn: v })} placeholder={t('dueOn')} />
            <PrimaryButton label={editingVaccineId ? t('save') : t('addVaccine')} onPress={() => void saveVaccine()} />
            {editingVaccineId ? <TextLinkButton label={t('cancel')} onPress={resetVaccine} /> : null}
          </>
        ) : null}

        <View style={{ marginTop: space.md, marginBottom: space.sm }}><Muted>{t('medications')}</Muted></View>
        {(child.medications ?? []).map((m) => (
          <HealthRecordRow
            key={m.id}
            title={m.name}
            subtitle={`${m.dosage} · ${m.schedule}${m.active ? '' : ` · ${t('inactive')}`}`}
            canEdit={canEdit}
            editLabel={actionLabels.edit}
            deleteLabel={actionLabels.delete}
            onEdit={() => {
              setEditingMedId(m.id);
              setMedForm({ name: m.name, dosage: m.dosage, schedule: m.schedule, active: m.active });
            }}
            onDelete={async () => {
              await api(`/api/children/${childId}/medications/${m.id}`, { method: 'DELETE' });
              await onReload();
            }}
          />
        ))}
        {canEdit ? (
          <>
            <Field value={medForm.name} onChangeText={(v) => setMedForm({ ...medForm, name: v })} placeholder={t('medicationName')} />
            <Field value={medForm.dosage} onChangeText={(v) => setMedForm({ ...medForm, dosage: v })} placeholder={t('dosage')} />
            <Field value={medForm.schedule} onChangeText={(v) => setMedForm({ ...medForm, schedule: v })} placeholder={t('schedule')} />
            <PrimaryButton label={editingMedId ? t('save') : t('addMedication')} onPress={() => void saveMed()} />
            {editingMedId ? <TextLinkButton label={t('cancel')} onPress={resetMed} /> : null}
          </>
        ) : null}
      </Card>

      <Card>
        <SectionLabel>{t('pickup')}</SectionLabel>
        {(child.pickups ?? []).map((p) => (
          <HealthRecordRow
            key={p.id}
            title={p.fullName}
            subtitle={`${p.relation} · ${t('pin')} ${p.pin}${p.phone ? ` · ${p.phone}` : ''}`}
            canEdit={canEdit}
            editLabel={actionLabels.edit}
            deleteLabel={actionLabels.delete}
            onEdit={() => {
              setEditingPickupId(p.id);
              setPickupForm({ fullName: p.fullName, relation: p.relation, phone: p.phone ?? '', pin: p.pin });
            }}
            onDelete={async () => {
              await api(`/api/children/${childId}/pickups/${p.id}`, { method: 'DELETE' });
              await onReload();
            }}
          />
        ))}
        {canEdit ? (
          <>
            <Field value={pickupForm.fullName} onChangeText={(v) => setPickupForm({ ...pickupForm, fullName: v })} placeholder={t('fullName')} />
            <Field value={pickupForm.relation} onChangeText={(v) => setPickupForm({ ...pickupForm, relation: v })} placeholder={t('relation')} />
            <Field value={pickupForm.phone} onChangeText={(v) => setPickupForm({ ...pickupForm, phone: v })} placeholder={t('phone')} />
            <Field value={pickupForm.pin} onChangeText={(v) => setPickupForm({ ...pickupForm, pin: v })} placeholder={t('pinOptional')} />
            <PrimaryButton label={editingPickupId ? t('save') : t('addPickup')} onPress={() => void savePickup()} />
            {editingPickupId ? <TextLinkButton label={t('cancel')} onPress={resetPickup} /> : null}
          </>
        ) : null}
      </Card>
    </>
  );
}
