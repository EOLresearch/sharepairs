import React, { useEffect, useState } from 'react';
import { FaUserAlt } from 'react-icons/fa';
import InputField from '../../UserAuth/UserDetailsForm/InputField';
import SelectField from '../../UserAuth/UserDetailsForm/SelectField';
import SystemMessage from '../../SystemMessage/SystemMessage';
import { useAuth } from '../../UserAuth/AuthContext';
import { updateUserProfile, changePassword } from '../../../services/authService';
import {
  US_STATES_EN,
  RACE_OPTIONS_EN,
  ETHNICITY_OPTIONS_EN,
  BIOLOGICAL_SEX_OPTIONS_EN,
  EDUCATION_OPTIONS_EN,
  HOUSEHOLD_OPTIONS_EN,
  KINSHIP_OPTIONS_EN,
  CAUSE_OPTIONS_EN,
} from '../../../helpers/optionsArrays';
import { isLocalApp } from '../../../helpers/localEnv';
import en from '../../../translations/en';
import '../../UserAuth/UserDetailsForm/userdetailsform.css';
import './profile.css';

const TABS = {
  account: 'account',
  personal: 'personal',
  story: 'story',
};

function ProfilePage() {
  const t = en;
  const badge = t.register.visibility.partner_badge;
  const { user, userData, refreshAuth } = useAuth();
  const [activeTab, setActiveTab] = useState(TABS.account);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [form, setForm] = useState({
    displayName: '',
    residence: '',
    birthDate: '',
    race: '',
    ethnicity: '',
    bioSex: '',
    education: '',
    household: '',
    hobbies: '',
    lossDate: '',
    kinship: '',
    cause: '',
    deceasedAge: '',
    lossExp: '',
  });

  useEffect(() => {
    if (!userData) return;
    setForm({
      displayName: userData.displayName || '',
      residence: userData.residence || '',
      birthDate: userData.birthDate || '',
      race: userData.race || '',
      ethnicity: userData.ethnicity || '',
      bioSex: userData.bioSex || '',
      education: userData.education || '',
      household: userData.household || '',
      hobbies: userData.hobbies || '',
      lossDate: userData.lossDate || '',
      kinship: userData.kinship || '',
      cause: userData.cause || '',
      deceasedAge: userData.deceasedAge || '',
      lossExp: userData.lossExp || '',
    });
  }, [userData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const over18 = (bdayString) => {
    if (!bdayString) return true;
    const today = new Date();
    const birthDate = new Date(bdayString);
    if (Number.isNaN(birthDate.getTime())) return false;
    let age = today.getFullYear() - birthDate.getFullYear();
    const month = today.getMonth() - birthDate.getMonth();
    if (month < 0 || (month === 0 && today.getDate() < birthDate.getDate())) age -= 1;
    return age >= 18;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.birthDate && !over18(form.birthDate)) {
      setError(t.register.errors.must_be_18);
      setActiveTab(TABS.personal);
      return;
    }

    setLoading(true);
    try {
      await updateUserProfile(userData?.authId || user?.uid, form);
      await refreshAuth?.();
      setSuccess(t.profile.saved);
    } catch (err) {
      console.error(err);
      setError(err?.message || t.profile.error_generic);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordSubmit = async () => {
    setError('');
    setSuccess('');
    if (passwordForm.next !== passwordForm.confirm) {
      setError(t.profile.password_mismatch);
      return;
    }
    setPasswordBusy(true);
    try {
      await changePassword(passwordForm.current, passwordForm.next);
      setPasswordForm({ current: '', next: '', confirm: '' });
      await refreshAuth?.();
      setSuccess(t.profile.password_saved);
    } catch (err) {
      console.error(err);
      setError(err?.message || t.profile.password_error);
    } finally {
      setPasswordBusy(false);
    }
  };

  const tabItems = [
    { id: TABS.account, label: t.register.sections.account_info },
    { id: TABS.personal, label: t.register.sections.personal_info },
    { id: TABS.story, label: t.register.sections.your_story },
  ];

  return (
    <div className="profile-page">
      <header className="profile-page-header">
        <h2>{t.profile.title}</h2>
        <p>{t.profile.subtitle}</p>
        <p className="profile-visibility-note">{t.register.visibility.partner_note}</p>
      </header>

      <div className="fields-container register profile-form">
        <form onSubmit={handleSubmit}>
          <div className="reg-tabs" role="tablist" aria-label="Profile sections">
            {tabItems.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`profile-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`profile-panel-${tab.id}`}
                className={`reg-tab${activeTab === tab.id ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="reg-tab-panels">
            <div
              className={`reg-tab-panel${activeTab === TABS.account ? ' is-active' : ''}`}
              role="tabpanel"
              id={`profile-panel-${TABS.account}`}
              aria-labelledby={`profile-tab-${TABS.account}`}
              hidden={activeTab !== TABS.account}
            >
              <InputField
                label={t.register.labels.email}
                type="text"
                name="email"
                id="profile-email"
                value={userData?.email || user?.email || ''}
                disabled
                hint={t.profile.email_readonly}
              />
              <div
                className="profile-password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handlePasswordSubmit();
                  }
                }}
              >
                <h3>{t.profile.password_title}</h3>
                {userData?.usingAccessCode ? <p className="field-hint">{t.profile.password_hint}</p> : null}
                {!isLocalApp() ? <p className="field-hint">{t.profile.password_rules}</p> : null}
                <InputField
                  label={t.profile.password_current}
                  type="password"
                  name="current"
                  id="profile-password-current"
                  value={passwordForm.current}
                  onChange={handlePasswordChange}
                  autoComplete="current-password"
                />
                <InputField
                  label={t.profile.password_new}
                  type="password"
                  name="next"
                  id="profile-password-new"
                  value={passwordForm.next}
                  onChange={handlePasswordChange}
                  autoComplete="new-password"
                />
                <InputField
                  label={t.profile.password_confirm}
                  type="password"
                  name="confirm"
                  id="profile-password-confirm"
                  value={passwordForm.confirm}
                  onChange={handlePasswordChange}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="btn sub-btn"
                  onClick={handlePasswordSubmit}
                  disabled={passwordBusy}
                >
                  {passwordBusy ? t.profile.password_saving : t.profile.password_save}
                </button>
              </div>
              <InputField
                label={t.register.labels.display_name}
                type="text"
                name="displayName"
                id="profile-name"
                value={form.displayName}
                icon={<FaUserAlt aria-hidden="true" />}
                onChange={handleChange}
                visibleToPartner
                partnerBadge={badge}
              />
            </div>

            <div
              className={`reg-tab-panel${activeTab === TABS.personal ? ' is-active' : ''}`}
              role="tabpanel"
              id={`profile-panel-${TABS.personal}`}
              aria-labelledby={`profile-tab-${TABS.personal}`}
              hidden={activeTab !== TABS.personal}
            >
              <SelectField
                label={t.register.labels.home_state}
                name="residence"
                id="profile-residence"
                value={form.residence}
                onChange={handleChange}
                options={US_STATES_EN}
                visibleToPartner
                partnerBadge={badge}
              />
              <InputField label={t.register.labels.birth_date} type="date" name="birthDate" id="profile-birthDate" value={form.birthDate} onChange={handleChange} />
              <SelectField label={t.register.labels.race} name="race" id="profile-race" value={form.race} onChange={handleChange} options={RACE_OPTIONS_EN} />
              <SelectField label={t.register.labels.ethnicity} name="ethnicity" id="profile-ethnicity" value={form.ethnicity} onChange={handleChange} options={ETHNICITY_OPTIONS_EN} />
              <SelectField label={t.register.labels.bio_sex} name="bioSex" id="profile-bioSex" value={form.bioSex} onChange={handleChange} options={BIOLOGICAL_SEX_OPTIONS_EN} />
              <SelectField label={t.register.labels.education} name="education" id="profile-education" value={form.education} onChange={handleChange} options={EDUCATION_OPTIONS_EN} />
              <SelectField label={t.register.labels.household} name="household" id="profile-household" value={form.household} onChange={handleChange} options={HOUSEHOLD_OPTIONS_EN} />
              <InputField label={t.register.labels.hobbies} type="textarea" name="hobbies" id="profile-hobbies" value={form.hobbies} onChange={handleChange} />
            </div>

            <div
              className={`reg-tab-panel${activeTab === TABS.story ? ' is-active' : ''}`}
              role="tabpanel"
              id={`profile-panel-${TABS.story}`}
              aria-labelledby={`profile-tab-${TABS.story}`}
              hidden={activeTab !== TABS.story}
            >
              <InputField label={t.register.labels.loss_date} type="date" name="lossDate" id="profile-lossDate" value={form.lossDate} onChange={handleChange} />
              <SelectField label={t.register.labels.kinship} name="kinship" id="profile-kinship" value={form.kinship} onChange={handleChange} options={KINSHIP_OPTIONS_EN} />
              <SelectField
                label={t.register.labels.cause}
                name="cause"
                id="profile-cause"
                value={form.cause}
                onChange={handleChange}
                options={CAUSE_OPTIONS_EN}
                hint={t.register.hints.cause}
              />
              <InputField label={t.register.labels.deceased_age} type="number" name="deceasedAge" id="profile-deceasedAge" value={form.deceasedAge} onChange={handleChange} />
              <InputField
                label={t.register.labels.loss_experience}
                type="textarea"
                name="lossExp"
                id="profile-lossExp"
                value={form.lossExp}
                onChange={handleChange}
                visibleToPartner
                partnerBadge={badge}
              />
            </div>
          </div>

          {error && <SystemMessage message={error} cancelMessage={() => setError('')} />}
          {success && (
            <SystemMessage message={success} type="success" cancelMessage={() => setSuccess('')} />
          )}

          <div className="btn-container">
            <input
              className="btn sub-btn"
              type="submit"
              value={loading ? t.profile.saving : t.profile.save}
              disabled={loading}
            />
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProfilePage;
