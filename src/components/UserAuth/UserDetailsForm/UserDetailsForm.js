import React, { useState, useEffect } from "react";
import PropTypes from 'prop-types';
import SystemMessage from '../../SystemMessage/SystemMessage';
import './userdetailsform.css';

import Section from './Section';
import InputField from './InputField';
import SelectField from './SelectField';
import { useAuth } from '../AuthContext';

import {
  US_STATES_EN,
  US_STATES_TR,
  RACE_OPTIONS_EN,
  RACE_OPTIONS_TR,
  ETHNICITY_OPTIONS_EN,
  ETHNICITY_OPTIONS_TR,
  BIOLOGICAL_SEX_OPTIONS_EN,
  BIOLOGICAL_SEX_OPTIONS_TR,
  EDUCATION_OPTIONS_EN,
  EDUCATION_OPTIONS_TR,
  HOUSEHOLD_OPTIONS_EN,
  HOUSEHOLD_OPTIONS_TR,
  KINSHIP_OPTIONS_EN,
  KINSHIP_OPTIONS_TR,
  CAUSE_OPTIONS_EN,
  CAUSE_OPTIONS_TR,
  TURKISH_PROVINCES_EN,
  TURKISH_PROVINCES_TR
} from "../../../helpers/optionsArrays";

import en from '../../../translations/en';
import tr from '../../../translations/tr';

const UserDetailsForm = ({ handleToggle, language }) => {
  const t = language === 'tr' ? tr : en;
  const { registerAndStoreUser } = useAuth();
  const [anError, setAnError] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isUpdateForm, setIsUpdateForm] = useState(false);

  const [userDetails, setUserDetails] = useState({
    photoURL: '',
    email: '',
    password: '',
    confirmPass: '',
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
    country: '',
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
      { condition: !userDetails.email.trim(), error: t.register.errors.missing_email },
      { condition: !userDetails.password, error: t.register.errors.missing_password },
      { condition: userDetails.password !== userDetails.confirmPass, error: t.register.errors.password_mismatch },
      { condition: !userDetails.residence, error: t.register.errors.missing_residence },
      { condition: !userDetails.birthDate, error: t.register.errors.missing_birthdate },
      { condition: !over18Bouncer(userDetails.birthDate), error: t.register.errors.must_be_18 },
      { condition: !userDetails.race, error: t.register.errors.missing_race },
      { condition: !userDetails.ethnicity, error: t.register.errors.missing_ethnicity },
      { condition: !userDetails.bioSex, error: t.register.errors.missing_bio_sex },
      { condition: !userDetails.education, error: t.register.errors.missing_education },
      { condition: !userDetails.household, error: t.register.errors.missing_household },
      { condition: !userDetails.lossDate, error: t.register.errors.missing_loss_date },
      { condition: !userDetails.kinship, error: t.register.errors.missing_kinship },
      { condition: !userDetails.cause, error: t.register.errors.missing_cause },
      { condition: !userDetails.deceasedAge, error: t.register.errors.missing_deceased_age },
      { condition: !userDetails.lossExp, error: t.register.errors.missing_loss_experience },
      // { condition: !userDetails.country, error: t.register.errors.missing_country }
    ];

    for (const v of validations) {
      if (v.condition) {
        setAnError(v.error);
        setLoading(false);
        return;
      }
    }

    if (!consent) {
      setAnError(t.register.errors.missing_consent);
      setLoading(false);
      return;
    }

    try {
      const { password, confirmPass, ...safeUserDetails } = userDetails;
      const createdUser = await registerAndStoreUser(userDetails.email, password, safeUserDetails);

      console.log("User created and stored:", createdUser);
      handleToggle('login');

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

  function getResidenceOptions(language, country) {
    if (country === 'Turkey' || country === 'Türkiye') {
      return language === 'tr' ? TURKISH_PROVINCES_TR : TURKISH_PROVINCES_EN;
    }
    return US_STATES_EN; // Always English for US states
  }
const normalizedCountry = userDetails.country?.toLowerCase();

const residenceLabel =
  normalizedCountry === 'turkey' || normalizedCountry === 'türkiye'
    ? language === 'tr' ? 'İl' : 'Province'
    : language === 'tr' ? 'Eyalet' : 'Home State';


  const residenceOptions = getResidenceOptions(language, userDetails.country);



  const defaultForm = (
    <>
      <InputField label="" type="email" name="email" placeholder={t.register.labels.email} id="email" value={userDetails.email} iconClass="fas fa-envelope" onChange={handleChange} />
      <InputField label="" type="password" name="password" placeholder={t.register.labels.password} id="password" value={userDetails.password} iconClass="fas fa-lock" onChange={handleChange} />
      <InputField label="" type="password" name="confirmPass" placeholder={t.register.labels.confirm_password} id="confirmPass" value={userDetails.confirmPass} iconClass="fas fa-lock" onChange={handleChange} />
      <InputField label="" type="text" name="displayName" placeholder={t.register.labels.display_name} id="name" value={userDetails.displayName} iconClass="fas fa-user-alt" onChange={handleChange} />
    </>
  );

  return (
    <div className="auth-wrapper">
      <div className='fields-container register'>
        <form onSubmit={handleSubmit}>
          <Section title={t.register.sections.account_info} openIs={true}>
            {defaultForm}
          </Section>

          <Section title={t.register.sections.personal_info}>
            <SelectField label={t.register.labels.country} name="country" placeholder={t.register.labels.country} id="country" value={userDetails.country} onChange={handleChange} options={[language === 'tr' ? 'Amerika Birleşik Devletleri' : 'United States', language === 'tr' ? 'Türkiye' : 'Turkey']} />
            <SelectField label={residenceLabel} name="residence" placeholder={userDetails.country === 'Turkey' || 'Türkiye' ? (language === 'tr' ? 'İl' : 'Province') : (language === 'tr' ? 'Eyalet' : 'Home State')} id="residence" value={userDetails.residence} onChange={handleChange} options={residenceOptions} />
            <InputField label={t.register.labels.birth_date} type="date" name="birthDate" placeholder="e.g. 01/01/1990" id="birthDate" value={userDetails.birthDate} onChange={handleChange} />
            <SelectField label={t.register.labels.race} name="race" placeholder={t.register.labels.race} id="race" value={userDetails.race} onChange={handleChange} options={language === 'tr' ? RACE_OPTIONS_TR : RACE_OPTIONS_EN} />
            <SelectField label={t.register.labels.ethnicity} name="ethnicity" placeholder={t.register.labels.ethnicity} id="ethnicity" value={userDetails.ethnicity} onChange={handleChange} options={language === 'tr' ? ETHNICITY_OPTIONS_TR : ETHNICITY_OPTIONS_EN} />
            <SelectField label={t.register.labels.bio_sex} name="bioSex" placeholder={t.register.labels.bio_sex} id="bioSex" value={userDetails.bioSex} onChange={handleChange} options={language === 'tr' ? BIOLOGICAL_SEX_OPTIONS_TR : BIOLOGICAL_SEX_OPTIONS_EN} />
            <SelectField label={t.register.labels.education} name="education" placeholder={t.register.labels.education} id="education" value={userDetails.education} onChange={handleChange} options={language === 'tr' ? EDUCATION_OPTIONS_TR : EDUCATION_OPTIONS_EN} />
            <SelectField label={t.register.labels.household} name="household" placeholder={t.register.labels.household} id="household" value={userDetails.household} onChange={handleChange} options={language === 'tr' ? HOUSEHOLD_OPTIONS_TR : HOUSEHOLD_OPTIONS_EN} />
            <InputField label={t.register.labels.hobbies} type="textarea" name="hobbies" placeholder={t.register.labels.hobbies} id="hobbies" value={userDetails.hobbies} onChange={handleChange} />
          </Section>

          <Section title={t.register.sections.your_story}>
            <InputField label={t.register.labels.loss_date} type="date" name="lossDate" placeholder="e.g. 01/01/1990" id="lossDate" value={userDetails.lossDate} onChange={handleChange} />
            <SelectField label={t.register.labels.kinship} name="kinship" placeholder={t.register.labels.kinship} id="kinship" value={userDetails.kinship} onChange={handleChange} options={language === 'tr' ? KINSHIP_OPTIONS_TR : KINSHIP_OPTIONS_EN} />
            <SelectField label={t.register.labels.cause} name="cause" placeholder={t.register.labels.cause} id="cause" value={userDetails.cause} onChange={handleChange} options={language === 'tr' ? CAUSE_OPTIONS_TR : CAUSE_OPTIONS_EN} />
            <InputField label={t.register.labels.deceased_age} type="number" name="deceasedAge" placeholder="age" id="deceasedAge" value={userDetails.deceasedAge} onChange={handleChange} />
            <InputField label={t.register.labels.loss_experience} type="textarea" name="lossExp" placeholder="" id="lossExp" value={userDetails.lossExp} onChange={handleChange} />
          </Section>



          <div className='consent'>
            <input type="checkbox" name="consent" id="consent" checked={consent} onChange={handleChange} />
            <div>
              <label htmlFor="consent">
                {t.register.labels.consent_label}
              </label>
            </div>
          </div>

          {anError && <SystemMessage message={anError} cancelMessage={cancelError} />}

          <div className='btn-container'>
            <input className="btn sub-btn" type="submit" value={loading ? t.register.buttons.submitting : t.register.buttons.submit} disabled={loading} />
          </div>
        </form>

        <button onClick={() => handleToggle('login')} className='btn btn-back'>
          {isUpdateForm ? t.register.buttons.return_home : <strong>{t.register.buttons.back_to_login}</strong>}
        </button>
      </div>
    </div>
  );
};

UserDetailsForm.propTypes = {
  handleToggle: PropTypes.func.isRequired,
  language: PropTypes.string.isRequired
};

export default UserDetailsForm;
