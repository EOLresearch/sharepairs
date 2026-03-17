export interface UserProfile {
  userId: string;             // FK → AuthUser.id
  displayName: string;
  photoURL?: string;
  bioSex?: string;
  birthDate?: string;
  education?: string;
  ethnicity?: string;
  race?: string;
  residence?: string;
  country?: string;
  hobbies?: string;
  consent: boolean;
  updatedAt: Date;
}
