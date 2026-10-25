import React, { useEffect, useState } from 'react';
import { Alert, Image, Platform, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { api, resolveAssetUrl, uploadBrandingLogo } from '../api';
import { colors, space } from '../theme';
import { ChildHealthPanel } from '../components/ChildHealthPanel';
import { AddAction, AppHeader, Card, Chip, EditAction, Field, Muted, PrimaryButton, Screen, SectionLabel, StatCard, Title } from '../ui';

type Classroom = { id: string; name: string; minAgeMonths?: number; maxAgeMonths?: number };
type Person = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  phone?: string;
  preferredLanguage?: string;
  classroomId?: string;
  classroomName?: string;
};

function formatDob(d: unknown) {
  if (typeof d === 'string') return d.slice(0, 10);
  if (d && typeof d === 'object' && 'year' in (d as object)) {
    const x = d as { year: number; month: number; day: number };
    const m = String(x.month).padStart(2, '0');
    const day = String(x.day).padStart(2, '0');
    return `${x.year}-${m}-${day}`;
  }
  return '';
}

export function AdminScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'dash' | 'kids' | 'parents' | 'classes' | 'bill' | 'staff' | 'wait' | 'brand'>('dash');
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<any>({});
  const [children, setChildren] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any>({ staff: [], shifts: [] });
  const [wait, setWait] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [parents, setParents] = useState<Person[]>([]);

  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editingChildDetail, setEditingChildDetail] = useState<any>(null);
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  const [showAddChild, setShowAddChild] = useState(false);
  const [childForm, setChildForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    classroomId: '',
    notes: '',
    parentIds: [] as string[],
  });

  const [showAddClass, setShowAddClass] = useState(false);
  const [classForm, setClassForm] = useState({ name: '', minAgeMonths: '24', maxAgeMonths: '48' });

  const [showAddParent, setShowAddParent] = useState(false);
  const [parentForm, setParentForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    preferredLanguage: 'en',
  });

  const [showAddUser, setShowAddUser] = useState(false);
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'Educator' as 'Educator' | 'Admin',
    classroomId: '',
    preferredLanguage: 'en',
  });

  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({ childId: '', period: '', amount: '', dueDate: '', status: 'Pending' });

  const [showAddWait, setShowAddWait] = useState(false);
  const [waitForm, setWaitForm] = useState({
    childName: '',
    dateOfBirth: '',
    parentName: '',
    parentEmail: '',
    phone: '',
  });

  const [showAddShift, setShowAddShift] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftForm, setShiftForm] = useState({
    userId: '',
    date: '',
    start: '09:00',
    end: '17:00',
    status: 'Scheduled',
    absenceReason: '',
  });

  const load = async () => {
    setStats(await api('/api/stats'));
    setChildren(await api('/api/children'));
    setInvoices(await api('/api/invoices'));
    setStaff(await api('/api/staff'));
    setWait(await api('/api/waitlist'));
    const rooms = await api('/api/classrooms');
    setClassrooms(
      rooms.map((r: any) => ({
        id: r.id,
        name: r.name,
        minAgeMonths: r.minAgeMonths,
        maxAgeMonths: r.maxAgeMonths,
      })),
    );
    try {
      setParents(await api('/api/users?role=Parent'));
    } catch {
      setParents([]);
    }
    const brand = await api('/api/branding');
    setLogoUrl(resolveAssetUrl(brand.logoUrl));
  };

  useEffect(() => {
    void load();
  }, []);

  const notify = (kind: 'ok' | 'err', text: string) => {
    setBanner({ kind, text });
    if (Platform.OS !== 'web') Alert.alert(kind === 'ok' ? 'OK' : t('staff'), text);
  };

  const toggleParent = (id: string) => {
    setChildForm((f) => ({
      ...f,
      parentIds: f.parentIds.includes(id) ? f.parentIds.filter((x) => x !== id) : [...f.parentIds, id],
    }));
  };

  const emptyChildForm = () => ({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    classroomId: '',
    notes: '',
    parentIds: [] as string[],
  });

  const resetChildEditor = () => {
    setEditingChildId(null);
    setEditingChildDetail(null);
    setShowAddChild(false);
    setChildForm(emptyChildForm());
  };

  const reloadEditingChildDetail = async () => {
    if (!editingChildId) return;
    setEditingChildDetail(await api(`/api/children/${editingChildId}`));
  };

  const openAddChild = () => {
    setEditingChildId(null);
    setChildForm(emptyChildForm());
    setShowAddChild(true);
  };

  const startEditChild = async (c: any) => {
    setEditingChildId(c.id);
    setShowAddChild(true);
    let notes = '';
    try {
      const d = await api(`/api/children/${c.id}`);
      setEditingChildDetail(d);
      notes = d.notes ?? '';
    } catch {
      setEditingChildDetail(null);
    }
    setChildForm({
      firstName: c.firstName,
      lastName: c.lastName,
      dateOfBirth: formatDob(c.dateOfBirth),
      classroomId: c.classroomId ?? '',
      notes,
      parentIds: c.parentIds ?? [],
    });
  };

  const emptyParentForm = () => ({ email: '', password: '', fullName: '', phone: '', preferredLanguage: 'en' });

  const resetParentEditor = () => {
    setEditingParentId(null);
    setShowAddParent(false);
    setParentForm(emptyParentForm());
  };

  const openAddParent = () => {
    setEditingParentId(null);
    setParentForm(emptyParentForm());
    setShowAddParent(true);
  };

  const startEditParent = (p: Person) => {
    setEditingParentId(p.id);
    setShowAddParent(true);
    setParentForm({
      email: p.email,
      password: '',
      fullName: p.fullName,
      phone: p.phone ?? '',
      preferredLanguage: p.preferredLanguage ?? 'en',
    });
  };

  const resetClassEditor = () => {
    setEditingClassId(null);
    setShowAddClass(false);
    setClassForm({ name: '', minAgeMonths: '24', maxAgeMonths: '48' });
  };

  const openAddClass = () => {
    setEditingClassId(null);
    setClassForm({ name: '', minAgeMonths: '24', maxAgeMonths: '48' });
    setShowAddClass(true);
  };

  const startEditClass = (r: Classroom) => {
    setEditingClassId(r.id);
    setShowAddClass(true);
    setClassForm({
      name: r.name,
      minAgeMonths: String(r.minAgeMonths ?? 24),
      maxAgeMonths: String(r.maxAgeMonths ?? 48),
    });
  };

  const emptyStaffForm = () => ({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'Educator' as 'Educator' | 'Admin',
    classroomId: '',
    preferredLanguage: 'en',
  });

  const resetStaffEditor = () => {
    setEditingStaffId(null);
    setShowAddUser(false);
    setUserForm(emptyStaffForm());
  };

  const openAddStaff = () => {
    setEditingStaffId(null);
    setUserForm(emptyStaffForm());
    setShowAddUser(true);
  };

  const startEditStaff = (s: any) => {
    setEditingStaffId(s.id);
    setShowAddUser(true);
    setUserForm({
      email: s.email,
      password: '',
      fullName: s.fullName,
      phone: s.phone ?? '',
      role: s.role === 'Admin' ? 'Admin' : 'Educator',
      classroomId: s.classroomId ?? '',
      preferredLanguage: s.preferredLanguage ?? 'en',
    });
  };

  const saveChild = async () => {
    if (!childForm.firstName.trim() || !childForm.lastName.trim() || !childForm.classroomId) {
      notify('err', t('enrollChildRequired'));
      return;
    }
    const dob = childForm.dateOfBirth.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      notify('err', t('enrollDobHint'));
      return;
    }
    try {
      const body = {
        firstName: childForm.firstName.trim(),
        lastName: childForm.lastName.trim(),
        dateOfBirth: dob,
        classroomId: childForm.classroomId,
        parentIds: childForm.parentIds,
        notes: childForm.notes.trim() || null,
      };
      const wasEdit = !!editingChildId;
      if (editingChildId) {
        await api(`/api/children/${editingChildId}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await api('/api/children', { method: 'POST', body: JSON.stringify(body) });
      }
      resetChildEditor();
      await load();
      notify('ok', wasEdit ? t('recordUpdated') : t('enrollChildSaved'));
    } catch (e: any) {
      notify('err', e.message ?? 'Error');
    }
  };

  const saveClassroom = async () => {
    if (!classForm.name.trim()) {
      notify('err', t('classroomNameRequired'));
      return;
    }
    const min = parseInt(classForm.minAgeMonths, 10);
    const max = parseInt(classForm.maxAgeMonths, 10);
    if (Number.isNaN(min) || Number.isNaN(max) || max < min) {
      notify('err', t('classroomAgeInvalid'));
      return;
    }
    try {
      const body = { name: classForm.name.trim(), minAgeMonths: min, maxAgeMonths: max };
      const wasEdit = !!editingClassId;
      if (editingClassId) {
        await api(`/api/classrooms/${editingClassId}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await api('/api/classrooms', { method: 'POST', body: JSON.stringify(body) });
      }
      resetClassEditor();
      await load();
      notify('ok', wasEdit ? t('recordUpdated') : t('classroomSaved'));
    } catch (e: any) {
      notify('err', e.message ?? 'Error');
    }
  };

  const saveParent = async () => {
    if (!parentForm.email.trim() || !parentForm.fullName.trim()) {
      notify('err', t('enrollUserRequired'));
      return;
    }
    if (!editingParentId && !parentForm.password) {
      notify('err', t('enrollUserRequired'));
      return;
    }
    if (parentForm.password && parentForm.password.length < 8) {
      notify('err', t('enrollPasswordHint'));
      return;
    }
    try {
      const wasEdit = !!editingParentId;
      if (editingParentId) {
        const patch: Record<string, string> = {
          email: parentForm.email.trim(),
          fullName: parentForm.fullName.trim(),
          phone: parentForm.phone.trim() || '',
          preferredLanguage: parentForm.preferredLanguage,
        };
        if (parentForm.password) patch.password = parentForm.password;
        await api(`/api/users/${editingParentId}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        });
      } else {
        await api('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            email: parentForm.email.trim(),
            password: parentForm.password,
            fullName: parentForm.fullName.trim(),
            phone: parentForm.phone.trim() || null,
            role: 'Parent',
            preferredLanguage: parentForm.preferredLanguage,
            classroomId: null,
          }),
        });
      }
      resetParentEditor();
      await load();
      notify('ok', wasEdit ? t('recordUpdated') : t('enrollParentSaved'));
    } catch (e: any) {
      notify('err', e.message ?? 'Error');
    }
  };

  const saveUser = async () => {
    if (!userForm.email.trim() || !userForm.fullName.trim()) {
      notify('err', t('enrollUserRequired'));
      return;
    }
    if (!editingStaffId && !userForm.password) {
      notify('err', t('enrollUserRequired'));
      return;
    }
    if (userForm.password && userForm.password.length < 8) {
      notify('err', t('enrollPasswordHint'));
      return;
    }
    if (userForm.role === 'Educator' && !userForm.classroomId) {
      notify('err', t('enrollClassroomRequired'));
      return;
    }
    try {
      const wasEdit = !!editingStaffId;
      if (editingStaffId) {
        const patch: Record<string, string> = {
          email: userForm.email.trim(),
          fullName: userForm.fullName.trim(),
          phone: userForm.phone.trim() || '',
          preferredLanguage: userForm.preferredLanguage,
        };
        if (userForm.password) patch.password = userForm.password;
        if (userForm.role === 'Educator' && userForm.classroomId) patch.classroomId = userForm.classroomId;
        await api(`/api/users/${editingStaffId}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        });
      } else {
        await api('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            email: userForm.email.trim(),
            password: userForm.password,
            fullName: userForm.fullName.trim(),
            phone: userForm.phone.trim() || null,
            role: userForm.role,
            preferredLanguage: userForm.preferredLanguage,
            classroomId: userForm.role === 'Educator' ? userForm.classroomId : null,
          }),
        });
      }
      resetStaffEditor();
      await load();
      notify('ok', wasEdit ? t('recordUpdated') : t('enrollStaffSaved'));
    } catch (e: any) {
      notify('err', e.message ?? 'Error');
    }
  };

  return (
    <Screen>
      <AppHeader title={t('dashboard')} subtitle={t('admin')} />
      <Title>{t('dashboard')}</Title>
      {banner ? (
        <View
          style={{
            marginBottom: space.sm,
            padding: 12,
            borderRadius: 12,
            backgroundColor: banner.kind === 'ok' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
            borderWidth: 1,
            borderColor: banner.kind === 'ok' ? colors.emerald : '#fca5a5',
          }}
        >
          <Text style={{ color: banner.kind === 'ok' ? colors.emerald : '#b91c1c', fontWeight: '600' }}>{banner.text}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label={t('dashboard')} selected={tab === 'dash'} variant="nav" onPress={() => setTab('dash')} />
        <Chip label={t('children')} selected={tab === 'kids'} variant="nav" onPress={() => setTab('kids')} />
        <Chip label={t('parents')} selected={tab === 'parents'} variant="nav" onPress={() => setTab('parents')} />
        <Chip label={t('classroom')} selected={tab === 'classes'} variant="nav" onPress={() => setTab('classes')} />
        <Chip label={t('billing')} selected={tab === 'bill'} variant="nav" onPress={() => setTab('bill')} />
        <Chip label={t('staff')} selected={tab === 'staff'} variant="nav" onPress={() => setTab('staff')} />
        <Chip label={t('waitlist')} selected={tab === 'wait'} variant="nav" onPress={() => setTab('wait')} />
        <Chip label={t('branding')} selected={tab === 'brand'} variant="nav" onPress={() => setTab('brand')} />
      </View>

      {tab === 'dash' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <StatCard
            label={t('checkedIn')}
            value={`${stats.checkedIn ?? 0}/${stats.children ?? 0}`}
            hint={t('attendanceRate')}
            valueColor={colors.emerald}
          />
          <StatCard label={t('attendanceRate')} value={`${stats.attendanceRate ?? 0}%`} valueColor={colors.indigo} />
          <StatCard label={t('children')} value={String(stats.children ?? 0)} />
          <StatCard
            label={t('overdueInvoices')}
            value={String(stats.overdueInvoices ?? 0)}
            hint={`${t('waitlist')}: ${stats.waitlist ?? 0}`}
            valueColor={colors.primary}
          />
        </View>
      ) : null}

      {tab === 'kids' ? (
        <View>
          <Muted>{t('enrollClassroomHint')}</Muted>
          <AddAction
            label={showAddChild ? t('cancel') : t('addChild')}
            mode={showAddChild ? 'cancel' : 'add'}
            onPress={() => (showAddChild ? resetChildEditor() : openAddChild())}
          />
          {showAddChild ? (
            <Card style={{ marginTop: space.sm }}>
              <SectionLabel>{editingChildId ? t('editChild') : t('addChild')}</SectionLabel>
              <Field value={childForm.firstName} onChangeText={(v) => setChildForm({ ...childForm, firstName: v })} placeholder={t('firstName')} />
              <Field value={childForm.lastName} onChangeText={(v) => setChildForm({ ...childForm, lastName: v })} placeholder={t('lastName')} />
              <Field
                value={childForm.dateOfBirth}
                onChangeText={(v) => setChildForm({ ...childForm, dateOfBirth: v })}
                placeholder={t('enrollDobPlaceholder')}
              />
              <SectionLabel>{t('classroom')}</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {classrooms.map((r) => (
                  <Chip
                    key={r.id}
                    label={r.name}
                    selected={childForm.classroomId === r.id}
                    variant="nav"
                    onPress={() => setChildForm({ ...childForm, classroomId: r.id })}
                  />
                ))}
              </View>
              <SectionLabel>{t('linkParents')}</SectionLabel>
              {parents.length === 0 ? <Muted>{t('enrollNoParentsYet')}</Muted> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {parents.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.fullName}
                    selected={childForm.parentIds.includes(p.id)}
                    variant="soft"
                    onPress={() => toggleParent(p.id)}
                  />
                ))}
              </View>
              <Field value={childForm.notes} onChangeText={(v) => setChildForm({ ...childForm, notes: v })} placeholder={t('staffNotes')} />
              <PrimaryButton label={t('save')} onPress={() => void saveChild()} />
            </Card>
          ) : null}
          {editingChildId && editingChildDetail ? (
            <ChildHealthPanel
              childId={editingChildId}
              child={editingChildDetail}
              canEdit
              onReload={reloadEditingChildDetail}
            />
          ) : null}
          {children.map((c) => (
            <Card key={c.id}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: colors.inkLight }}>{c.firstName} {c.lastName}</Text>
                  <Muted>{c.classroom} · QR {c.qrCode}</Muted>
                  {c.parentIds?.length ? <Muted>{t('linkedParents')}: {c.parentIds.length}</Muted> : <Muted>{t('noParentsLinked')}</Muted>}
                </View>
                <EditAction label={t('edit')} onPress={() => void startEditChild(c)} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {tab === 'parents' ? (
        <View>
          <Muted>{t('enrollParentsHint')}</Muted>
          <AddAction
            label={showAddParent ? t('cancel') : t('addParent')}
            mode={showAddParent ? 'cancel' : 'add'}
            onPress={() => (showAddParent ? resetParentEditor() : openAddParent())}
          />
          {showAddParent ? (
            <Card style={{ marginTop: space.sm }}>
              <SectionLabel>{editingParentId ? t('editParent') : t('addParent')}</SectionLabel>
              <Field value={parentForm.fullName} onChangeText={(v) => setParentForm({ ...parentForm, fullName: v })} placeholder={t('fullName')} />
              <Field value={parentForm.email} onChangeText={(v) => setParentForm({ ...parentForm, email: v })} placeholder={t('email')} />
              <Field
                value={parentForm.password}
                onChangeText={(v) => setParentForm({ ...parentForm, password: v })}
                placeholder={editingParentId ? t('enrollPasswordOptional') : t('enrollPasswordPlaceholder')}
                secure
              />
              <Muted>{editingParentId ? t('enrollPasswordOptional') : t('enrollPasswordHint')}</Muted>
              <Field value={parentForm.phone} onChangeText={(v) => setParentForm({ ...parentForm, phone: v })} placeholder={t('phone')} />
              <PrimaryButton label={t('save')} onPress={() => void saveParent()} />
            </Card>
          ) : null}
          {parents.length === 0 ? <Muted>{t('enrollNoParentsYet')}</Muted> : null}
          {parents.map((p) => (
            <Card key={p.id}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: colors.inkLight }}>{p.fullName}</Text>
                  <Muted>{p.email}{p.phone ? ` · ${p.phone}` : ''}</Muted>
                </View>
                <EditAction label={t('edit')} onPress={() => startEditParent(p)} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {tab === 'classes' ? (
        <View>
          <AddAction
            label={showAddClass ? t('cancel') : t('addClassroom')}
            mode={showAddClass ? 'cancel' : 'add'}
            onPress={() => (showAddClass ? resetClassEditor() : openAddClass())}
          />
          {showAddClass ? (
            <Card style={{ marginTop: space.sm }}>
              <SectionLabel>{editingClassId ? t('editClassroom') : t('addClassroom')}</SectionLabel>
              <Field value={classForm.name} onChangeText={(v) => setClassForm({ ...classForm, name: v })} placeholder={t('classroomName')} />
              <Field
                value={classForm.minAgeMonths}
                onChangeText={(v) => setClassForm({ ...classForm, minAgeMonths: v })}
                placeholder={t('minAgeMonths')}
              />
              <Field
                value={classForm.maxAgeMonths}
                onChangeText={(v) => setClassForm({ ...classForm, maxAgeMonths: v })}
                placeholder={t('maxAgeMonths')}
              />
              <PrimaryButton label={t('save')} onPress={() => void saveClassroom()} />
            </Card>
          ) : null}
          {classrooms.map((r) => (
            <Card key={r.id}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: colors.inkLight }}>{r.name}</Text>
                  <Muted>
                    {t('minAgeMonths')}: {r.minAgeMonths ?? '—'} · {t('maxAgeMonths')}: {r.maxAgeMonths ?? '—'}
                  </Muted>
                </View>
                <EditAction label={t('edit')} onPress={() => startEditClass(r)} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {tab === 'bill' ? (
        <View>
          <AddAction
            label={showAddInvoice ? t('cancel') : t('addInvoice')}
            mode={showAddInvoice ? 'cancel' : 'add'}
            onPress={() => {
              if (showAddInvoice) {
                setShowAddInvoice(false);
                setEditingInvoiceId(null);
                setInvoiceForm({ childId: '', period: '', amount: '', dueDate: '', status: 'Pending' });
              } else {
                setEditingInvoiceId(null);
                setInvoiceForm({ childId: children[0]?.id ?? '', period: '', amount: '', dueDate: '', status: 'Pending' });
                setShowAddInvoice(true);
              }
            }}
          />
          {showAddInvoice ? (
            <Card style={{ marginTop: space.sm }}>
              <SectionLabel>{editingInvoiceId ? t('editInvoice') : t('addInvoice')}</SectionLabel>
              {!editingInvoiceId ? (
                <>
                  <SectionLabel>{t('child')}</SectionLabel>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {children.map((c) => (
                      <Chip
                        key={c.id}
                        label={`${c.firstName} ${c.lastName}`}
                        selected={invoiceForm.childId === c.id}
                        variant="nav"
                        onPress={() => setInvoiceForm({ ...invoiceForm, childId: c.id })}
                      />
                    ))}
                  </View>
                </>
              ) : null}
              <Field value={invoiceForm.period} onChangeText={(v) => setInvoiceForm({ ...invoiceForm, period: v })} placeholder={t('invoicePeriod')} />
              <Field value={invoiceForm.amount} onChangeText={(v) => setInvoiceForm({ ...invoiceForm, amount: v })} placeholder={t('amount')} />
              <Field value={invoiceForm.dueDate} onChangeText={(v) => setInvoiceForm({ ...invoiceForm, dueDate: v })} placeholder={t('enrollDobPlaceholder')} />
              {editingInvoiceId ? (
                <Field value={invoiceForm.status} onChangeText={(v) => setInvoiceForm({ ...invoiceForm, status: v })} placeholder={`${t('status')} (Pending/Paid/Overdue)`} />
              ) : null}
              <PrimaryButton
                label={t('save')}
                onPress={async () => {
                  try {
                    if (editingInvoiceId) {
                      await api(`/api/children/invoices/${editingInvoiceId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                          period: invoiceForm.period.trim(),
                          amount: parseFloat(invoiceForm.amount),
                          dueDate: invoiceForm.dueDate.trim(),
                          status: invoiceForm.status,
                        }),
                      });
                    } else {
                      if (!invoiceForm.childId || !invoiceForm.period.trim()) {
                        notify('err', t('enrollChildRequired'));
                        return;
                      }
                      await api(`/api/children/${invoiceForm.childId}/invoices`, {
                        method: 'POST',
                        body: JSON.stringify({
                          period: invoiceForm.period.trim(),
                          amount: parseFloat(invoiceForm.amount),
                          dueDate: invoiceForm.dueDate.trim(),
                        }),
                      });
                    }
                    setShowAddInvoice(false);
                    setEditingInvoiceId(null);
                    await load();
                    notify('ok', t('recordUpdated'));
                  } catch (e: any) {
                    notify('err', e.message ?? 'Error');
                  }
                }}
              />
            </Card>
          ) : null}
          {invoices.map((i) => (
            <Card key={i.id}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: colors.inkLight }}>{i.child}</Text>
                  <Muted>{i.period} · {i.amount} · {String(i.status)}</Muted>
                </View>
                <EditAction
                  label={t('edit')}
                  onPress={() => {
                    setEditingInvoiceId(i.id);
                    setShowAddInvoice(true);
                    setInvoiceForm({
                      childId: i.childId ?? '',
                      period: i.period ?? '',
                      amount: String(i.amount ?? ''),
                      dueDate: formatDob(i.dueDate),
                      status: String(i.status ?? 'Pending'),
                    });
                  }}
                />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {tab === 'staff' ? (
        <View>
          <Muted>{t('enrollStaffHint')}</Muted>
          <AddAction
            label={showAddUser ? t('cancel') : t('addEmployee')}
            mode={showAddUser ? 'cancel' : 'add'}
            onPress={() => (showAddUser ? resetStaffEditor() : openAddStaff())}
          />
          {showAddUser ? (
            <Card style={{ marginTop: space.sm }}>
              <SectionLabel>{editingStaffId ? t('editEmployee') : t('addEmployee')}</SectionLabel>
              {!editingStaffId ? (
                <>
                  <SectionLabel>{t('role')}</SectionLabel>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {(['Educator', 'Admin'] as const).map((r) => (
                      <Chip
                        key={r}
                        label={r === 'Educator' ? t('educator') : t('admin')}
                        selected={userForm.role === r}
                        variant="nav"
                        onPress={() => setUserForm({ ...userForm, role: r, classroomId: r === 'Educator' ? userForm.classroomId : '' })}
                      />
                    ))}
                  </View>
                </>
              ) : (
                <Muted>{userForm.role === 'Admin' ? t('admin') : t('educator')}</Muted>
              )}
              <Field value={userForm.fullName} onChangeText={(v) => setUserForm({ ...userForm, fullName: v })} placeholder={t('fullName')} />
              <Field value={userForm.email} onChangeText={(v) => setUserForm({ ...userForm, email: v })} placeholder={t('email')} />
              <Field
                value={userForm.password}
                onChangeText={(v) => setUserForm({ ...userForm, password: v })}
                placeholder={editingStaffId ? t('enrollPasswordOptional') : t('enrollPasswordPlaceholder')}
                secure
              />
              <Muted>{editingStaffId ? t('enrollPasswordOptional') : t('enrollPasswordHint')}</Muted>
              <Field value={userForm.phone} onChangeText={(v) => setUserForm({ ...userForm, phone: v })} placeholder={t('phone')} />
              {userForm.role === 'Educator' ? (
                <>
                  <SectionLabel>{t('classroom')}</SectionLabel>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {classrooms.map((r) => (
                      <Chip
                        key={r.id}
                        label={r.name}
                        selected={userForm.classroomId === r.id}
                        variant="nav"
                        onPress={() => setUserForm({ ...userForm, classroomId: r.id })}
                      />
                    ))}
                  </View>
                </>
              ) : null}
              <PrimaryButton label={t('save')} onPress={() => void saveUser()} />
            </Card>
          ) : null}
          {staff.staff?.map((s: any) => (
            <Card key={s.id}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: colors.inkLight }}>{s.fullName}</Text>
                  <Muted>{s.role} · {s.email}</Muted>
                </View>
                <EditAction label={t('edit')} onPress={() => startEditStaff(s)} />
              </View>
            </Card>
          ))}
          <AddAction
            label={showAddShift ? t('cancel') : t('addShift')}
            mode={showAddShift ? 'cancel' : 'add'}
            onPress={() => {
              if (showAddShift) {
                setShowAddShift(false);
                setEditingShiftId(null);
                setShiftForm({ userId: '', date: '', start: '09:00', end: '17:00', status: 'Scheduled', absenceReason: '' });
              } else {
                setEditingShiftId(null);
                setShiftForm({
                  userId: staff.staff?.[0]?.id ?? '',
                  date: '',
                  start: '09:00',
                  end: '17:00',
                  status: 'Scheduled',
                  absenceReason: '',
                });
                setShowAddShift(true);
              }
            }}
          />
          {showAddShift ? (
            <Card style={{ marginTop: space.sm }}>
              <SectionLabel>{editingShiftId ? t('editShift') : t('addShift')}</SectionLabel>
              <SectionLabel>{t('staff')}</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {staff.staff?.map((u: any) => (
                  <Chip
                    key={u.id}
                    label={u.fullName}
                    selected={shiftForm.userId === u.id}
                    variant="nav"
                    onPress={() => setShiftForm({ ...shiftForm, userId: u.id })}
                  />
                ))}
              </View>
              <Field value={shiftForm.date} onChangeText={(v) => setShiftForm({ ...shiftForm, date: v })} placeholder={t('enrollDobPlaceholder')} />
              <Field value={shiftForm.start} onChangeText={(v) => setShiftForm({ ...shiftForm, start: v })} placeholder={t('shiftStart')} />
              <Field value={shiftForm.end} onChangeText={(v) => setShiftForm({ ...shiftForm, end: v })} placeholder={t('shiftEnd')} />
              <Field value={shiftForm.status} onChangeText={(v) => setShiftForm({ ...shiftForm, status: v })} placeholder={`${t('status')} (Scheduled/Completed/Absent)`} />
              <Field value={shiftForm.absenceReason} onChangeText={(v) => setShiftForm({ ...shiftForm, absenceReason: v })} placeholder={t('absenceReason')} />
              <PrimaryButton
                label={t('save')}
                onPress={async () => {
                  try {
                    const body = {
                      userId: shiftForm.userId,
                      date: shiftForm.date.trim(),
                      start: shiftForm.start.trim(),
                      end: shiftForm.end.trim(),
                      status: shiftForm.status,
                      absenceReason: shiftForm.absenceReason.trim() || null,
                    };
                    if (editingShiftId) {
                      await api(`/api/staff/shifts/${editingShiftId}`, { method: 'PATCH', body: JSON.stringify(body) });
                    } else {
                      await api('/api/staff/shifts', { method: 'POST', body: JSON.stringify(body) });
                    }
                    setShowAddShift(false);
                    setEditingShiftId(null);
                    await load();
                    notify('ok', t('recordUpdated'));
                  } catch (e: any) {
                    notify('err', e.message ?? 'Error');
                  }
                }}
              />
            </Card>
          ) : null}
          {staff.shifts?.map((s: any) => (
            <Card key={s.id}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Muted>{s.userName ?? s.userId} · {formatDob(s.date)} {s.start}–{s.end} · {s.status}</Muted>
                </View>
                <EditAction
                  label={t('edit')}
                  onPress={() => {
                    setEditingShiftId(s.id);
                    setShowAddShift(true);
                    setShiftForm({
                      userId: s.userId,
                      date: formatDob(s.date),
                      start: s.start ?? '09:00',
                      end: s.end ?? '17:00',
                      status: s.status ?? 'Scheduled',
                      absenceReason: s.absenceReason ?? '',
                    });
                  }}
                />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {tab === 'brand' ? (
        <Card>
          <Text style={{ fontWeight: '800', color: colors.inkLight }}>{t('branding')}</Text>
          <Muted>{t('logoHint')}</Muted>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={{ width: 200, height: 88, resizeMode: 'contain', marginVertical: 12 }} />
          ) : (
            <Muted>{t('noLogo')}</Muted>
          )}
          <Chip
            label={t('changeLogo')}
            variant="soft"
            onPress={async () => {
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) return;
              const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
              if (pick.canceled) return;
              const asset = pick.assets[0];
              try {
                const res = await uploadBrandingLogo(asset.uri, asset.fileName ?? 'logo.png', asset.mimeType ?? 'image/png');
                setLogoUrl(resolveAssetUrl(res.logoUrl));
                Alert.alert(t('branding'), t('logoSaved'));
              } catch (e: any) {
                Alert.alert(t('branding'), e.message);
              }
            }}
          />
        </Card>
      ) : null}

      {tab === 'wait' ? (
        <View>
          <AddAction
            label={showAddWait ? t('cancel') : t('addWaitlist')}
            mode={showAddWait ? 'cancel' : 'add'}
            onPress={() => {
              if (showAddWait) {
                setShowAddWait(false);
                setWaitForm({ childName: '', dateOfBirth: '', parentName: '', parentEmail: '', phone: '' });
              } else {
                setShowAddWait(true);
              }
            }}
          />
          {showAddWait ? (
            <Card style={{ marginTop: space.sm }}>
              <SectionLabel>{t('addWaitlist')}</SectionLabel>
              <Field value={waitForm.childName} onChangeText={(v) => setWaitForm({ ...waitForm, childName: v })} placeholder={t('child')} />
              <Field value={waitForm.dateOfBirth} onChangeText={(v) => setWaitForm({ ...waitForm, dateOfBirth: v })} placeholder={t('enrollDobPlaceholder')} />
              <Field value={waitForm.parentName} onChangeText={(v) => setWaitForm({ ...waitForm, parentName: v })} placeholder={t('fullName')} />
              <Field value={waitForm.parentEmail} onChangeText={(v) => setWaitForm({ ...waitForm, parentEmail: v })} placeholder={t('email')} />
              <Field value={waitForm.phone} onChangeText={(v) => setWaitForm({ ...waitForm, phone: v })} placeholder={t('phone')} />
              <PrimaryButton
                label={t('save')}
                onPress={async () => {
                  try {
                    await api('/api/waitlist', {
                      method: 'POST',
                      body: JSON.stringify({
                        childName: waitForm.childName.trim(),
                        dateOfBirth: waitForm.dateOfBirth.trim(),
                        parentName: waitForm.parentName.trim(),
                        parentEmail: waitForm.parentEmail.trim(),
                        phone: waitForm.phone.trim() || null,
                      }),
                    });
                    setShowAddWait(false);
                    setWaitForm({ childName: '', dateOfBirth: '', parentName: '', parentEmail: '', phone: '' });
                    await load();
                    notify('ok', t('recordUpdated'));
                  } catch (e: any) {
                    notify('err', e.message ?? 'Error');
                  }
                }}
              />
            </Card>
          ) : null}
          {wait.map((w) => (
            <Card key={w.id}>
              <Text style={{ fontWeight: '800', color: colors.inkLight }}>{w.childName}</Text>
              <Muted>{w.parentName} · {w.status}</Muted>
              <View style={{ flexDirection: 'row', marginTop: 8, flexWrap: 'wrap' }}>
                <Chip
                  label={t('approve')}
                  variant="soft"
                  onPress={async () => {
                    await api(`/api/waitlist/${w.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Approved' }) });
                    await load();
                  }}
                />
                <Chip
                  label={t('reject')}
                  variant="nav"
                  onPress={async () => {
                    await api(`/api/waitlist/${w.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Rejected' }) });
                    await load();
                  }}
                />
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
