import React, { useState, useEffect } from "react";
import PropTypes from 'prop-types';
import { FaEnvelope, FaLock, FaUserAlt, FaKey } from 'react-icons/fa';
import SystemMessage from '../../SystemMessage/SystemMessage';
import './userdetailsform.css';

import InputField from './InputField';
import SelectField from './SelectField';
import { useAuth } from '../AuthContext';

import {
  US_STATES_EN,
  RACE_OPTIONS_EN,
  ETHNICITY_OPTIONS_EN,
  BIOLOGICAL_SEX_OPTIONS_EN,
  EDUCATION_OPTIONS_EN,
  HOUSEHOLD_OPTIONS_EN,
  KINSHIP_OPTIONS_EN,
  CAUSE_OPTIONS_EN,
} from "../../../helpers/optionsArrays";

import en from '../../../translations/en';
import { isLocalApp } from '../../../helpers/localEnv';

const TABS = {
  account: 'account',
  personal: 'personal',
  story: 'story',
};

const UserDetailsForm = ({ handleToggle }) => {
  const t = en;
  const local = isLocalApp();
  const { registerAndStoreUser } = useAuth();
  const [anError, setAnError] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isUpdateForm] = useState(false);
  const [activeTab, setActiveTab] = useState(TABS.account);

  const [userDetails, setUserDetails] = useState({
    photoURL: '',
    email: '',
    password: '',
    confirmPass: '',
    inviteCode: '',
    displayName: '',
    residence: '',
    lossDate: '',
    race: '',
    ethnicity: '',
    bioSex: '',
    education: '',
    household: '',
    hobbies: '',
    birthDate: '',
    kinship: '',
    cause: '',
    deceasedAge: '',
    lossExp: '',
    admin: false,
  });

  useEffect(() => {
    const avatarOptions = ["Bubba", "Chloe", "Bob", "Casper", "Boo", "Boots", "Abby", "Chester", "Charlie", "Cuddles", "Bandit", "Angel", "Baby", "Cookie", "Daisy"];
    const seed = avatarOptions[Math.floor(Math.random() * avatarOptions.length)];
    const avatarUrl = `https://api.dicebear.com/5.x/thumbs/svg?seed=${seed}`;
    setUserDetails(prev => ({ ...prev, photoURL: avatarUrl }));
  }, []);

  const cancelError = () => setAnError('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const validations = [
      { condition: !userDetails.email.trim(), error: local ? 'Username is required.' : t.register.errors.missing_email, tab: TABS.account },
      { condition: !userDetails.password, error: t.register.errors.missing_password, tab: TABS.account },
      { condition: userDetails.password !== userDetails.confirmPass, error: t.register.errors.password_mismatch, tab: TABS.account },
      { condition: !local && !String(userDetails.inviteCode || '').trim(), error: t.register.errors.missing_invite, tab: TABS.account },
    ];

    if (!local) {
      validations.push(
        {
          condition: !/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/.test(userDetails.password || ''),
          error: t.register.errors.weak_password,
          tab: TABS.account,
        },
        { condition: !userDetails.residence, error: t.register.errors.missing_residence, tab: TABS.personal },
        { condition: !userDetails.birthDate, error: t.register.errors.missing_birthdate, tab: TABS.personal },
        { condition: !over18Bouncer(userDetails.birthDate), error: t.register.errors.must_be_18, tab: TABS.personal },
        { condition: !userDetails.race, error: t.register.errors.missing_race, tab: TABS.personal },
        { condition: !userDetails.ethnicity, error: t.register.errors.missing_ethnicity, tab: TABS.personal },
        { condition: !userDetails.bioSex, error: t.register.errors.missing_bio_sex, tab: TABS.personal },
        { condition: !userDetails.education, error: t.register.errors.missing_education, tab: TABS.personal },
        { condition: !userDetails.household, error: t.register.errors.missing_household, tab: TABS.personal },
        { condition: !userDetails.lossDate, error: t.register.errors.missing_loss_date, tab: TABS.story },
        { condition: !userDetails.kinship, error: t.register.errors.missing_kinship, tab: TABS.story },
        { condition: !userDetails.cause, error: t.register.errors.missing_cause, tab: TABS.story },
        { condition: !userDetails.deceasedAge, error: t.register.errors.missing_deceased_age, tab: TABS.story },
        { condition: !userDetails.lossExp, error: t.register.errors.missing_loss_experience, tab: TABS.story },
      );
    }

    for (const v of validations) {
      if (v.condition) {
        setAnError(v.error);
        if (v.tab) setActiveTab(v.tab);
        setLoading(false);
        return;
      }
    }

    if (!consent && !local) {
      setAnError(t.register.errors.missing_consent);
      setLoading(false);
      return;
    }

    try {
      const { password, confirmPass, ...safeUserDetails } = userDetails;
      const createdUser = await registerAndStoreUser(userDetails.email, password, {
        ...safeUserDetails,
        consent,
      });

      console.log("User created and stored:", createdUser);
      // Verification gate off: AuthContext keeps the session and App routes to Dashboard.
      // Verification gate on: App shows VerifyEmail while token is set.
    } catch (err) {
      console.error("Registration error:", err);
      let friendly = t.register.errors.generic;
      if (err.code === 'auth/email-already-in-use') friendly = t.register.errors.email_in_use;
      setAnError(friendly);
    }

    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    if (name === 'consent') {
      setConsent(checked);
      setUserDetails(prev => ({ ...prev, consent: checked }));
    } else {
      setUserDetails(prev => ({ ...prev, [name]: value }));
    }
  };

  const over18Bouncer = (bdayString) => {
    const today = new Date();
    const birthDate = new Date(bdayString);
    const age = today.getFullYear() - birthDate.getFullYear();
    const month = today.getMonth() - birthDate.getMonth();
    return (month < 0 || (month === 0 && today.getDate() < birthDate.getDate())) ? age - 1 >= 18 : age >= 18;
  };

  const tabItems = [
    { id: TABS.account, label: t.register.sections.account_info },
    { id: TABS.personal, label: t.register.sections.personal_info },
    { id: TABS.story, label: t.register.sections.your_story },
  ];

  return (
    <div className='fields-container register'>
        <form onSubmit={handleSubmit}>
          <div className="reg-tabs" role="tablist" aria-label="Registration sections">
            {tabItems.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`reg-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`reg-panel-${tab.id}`}
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
              id={`reg-panel-${TABS.account}`}
              aria-labelledby={`reg-tab-${TABS.account}`}
              hidden={activeTab !== TABS.account}
            >
              <InputField label={local ? 'Username' : t.register.labels.email} type="text" name="email" placeholder="" id="email" value={userDetails.email} icon={<FaEnvelope aria-hidden="true" />} onChange={handleChange} hint={local ? '' : t.register.labels.email_screening_hint} />
              {!local && (
                <InputField label={t.register.labels.invite_code} type="text" name="inviteCode" placeholder="" id="inviteCode" value={userDetails.inviteCode} icon={<FaKey aria-hidden="true" />} onChange={handleChange} />
              )}
              <InputField label={t.register.labels.password} type="password" name="password" placeholder="" id="password" value={userDetails.password} icon={<FaLock aria-hidden="true" />} onChange={handleChange} />
              <InputField label={t.register.labels.confirm_password} type="password" name="confirmPass" placeholder="" id="confirmPass" value={userDetails.confirmPass} icon={<FaLock aria-hidden="true" />} onChange={handleChange} />
              <InputField label={t.register.labels.display_name} type="text" name="displayName" placeholder="" id="name" value={userDetails.displayName} icon={<FaUserAlt aria-hidden="true" />} onChange={handleChange} />
            </div>

            <div
              className={`reg-tab-panel${activeTab === TABS.personal ? ' is-active' : ''}`}
              role="tabpanel"
              id={`reg-panel-${TABS.personal}`}
              aria-labelledby={`reg-tab-${TABS.personal}`}
              hidden={activeTab !== TABS.personal}
            >
              <SelectField label={t.register.labels.home_state} name="residence" placeholder={t.register.labels.home_state} id="residence" value={userDetails.residence} onChange={handleChange} options={US_STATES_EN} />
              <InputField label={t.register.labels.birth_date} type="date" name="birthDate" placeholder="e.g. 01/01/1990" id="birthDate" value={userDetails.birthDate} onChange={handleChange} />
              <SelectField label={t.register.labels.race} name="race" placeholder={t.register.labels.race} id="race" value={userDetails.race} onChange={handleChange} options={RACE_OPTIONS_EN} />
              <SelectField label={t.register.labels.ethnicity} name="ethnicity" placeholder={t.register.labels.ethnicity} id="ethnicity" value={userDetails.ethnicity} onChange={handleChange} options={ETHNICITY_OPTIONS_EN} />
              <SelectField label={t.register.labels.bio_sex} name="bioSex" placeholder={t.register.labels.bio_sex} id="bioSex" value={userDetails.bioSex} onChange={handleChange} options={BIOLOGICAL_SEX_OPTIONS_EN} />
              <SelectField label={t.register.labels.education} name="education" placeholder={t.register.labels.education} id="education" value={userDetails.education} onChange={handleChange} options={EDUCATION_OPTIONS_EN} />
              <SelectField label={t.register.labels.household} name="household" placeholder={t.register.labels.household} id="household" value={userDetails.household} onChange={handleChange} options={HOUSEHOLD_OPTIONS_EN} />
              <InputField label={t.register.labels.hobbies} type="textarea" name="hobbies" placeholder={t.register.labels.hobbies} id="hobbies" value={userDetails.hobbies} onChange={handleChange} />
            </div>

            <div
              className={`reg-tab-panel${activeTab === TABS.story ? ' is-active' : ''}`}
              role="tabpanel"
              id={`reg-panel-${TABS.story}`}
              aria-labelledby={`reg-tab-${TABS.story}`}
              hidden={activeTab !== TABS.story}
            >
              <InputField label={t.register.labels.loss_date} type="date" name="lossDate" placeholder="e.g. 01/01/1990" id="lossDate" value={userDetails.lossDate} onChange={handleChange} />
              <SelectField label={t.register.labels.kinship} name="kinship" placeholder={t.register.labels.kinship} id="kinship" value={userDetails.kinship} onChange={handleChange} options={KINSHIP_OPTIONS_EN} />
              <SelectField label={t.register.labels.cause} name="cause" placeholder={t.register.labels.cause} id="cause" value={userDetails.cause} onChange={handleChange} options={CAUSE_OPTIONS_EN} />
              <InputField label={t.register.labels.deceased_age} type="number" name="deceasedAge" placeholder="age" id="deceasedAge" value={userDetails.deceasedAge} onChange={handleChange} />
              <InputField label={t.register.labels.loss_experience} type="textarea" name="lossExp" placeholder="" id="lossExp" value={userDetails.lossExp} onChange={handleChange} />
            </div>
          </div>

          <div className="reg-finish">
            <div className='consent'>
              <input type="checkbox" name="consent" id="consent" checked={consent} onChange={handleChange} />
              <div>
                <label htmlFor="consent">
                  {t.register.labels.consent_label}
                </label>
              </div>
            </div>

            {anError && <SystemMessage message={anError} cancelMessage={cancelError} />}

            <div className="reg-finish-buttons">
              <input className="btn sub-btn" type="submit" value={loading ? t.register.buttons.submitting : t.register.buttons.submit} disabled={loading} />
              <button type="button" onClick={() => handleToggle('login')} className='btn btn-back'>
                {isUpdateForm ? t.register.buttons.return_home : t.register.buttons.back_to_login}
              </button>
            </div>
          </div>
        </form>
      </div>
  );
};

UserDetailsForm.propTypes = {
  handleToggle: PropTypes.func.isRequired,
};

export default UserDetailsForm;
