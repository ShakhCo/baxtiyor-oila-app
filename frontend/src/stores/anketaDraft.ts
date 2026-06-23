import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Tariff = 'basic' | 'standart';
export type Gender = 'male' | 'female';
export type Status = 'pending' | 'approved' | 'rejected';

export type FormShape = {
  full_name: string;
  gender: Gender | '';
  age: string;
  birthplace_region: string;
  current_residence_germany: string;
  height_weight: string;
  education: string;
  profession_hobbies: string;
  marital_status: string;
  family_info: string;
  nationality_languages: string;
  religion: string;
  germany_status: string;
  self_description: string;
  partner_expectations: string;
  contact_info: string;
  tariff: Tariff | '';
};

export const EMPTY_FORM: FormShape = {
  full_name: '',
  gender: '',
  age: '',
  birthplace_region: '',
  current_residence_germany: '',
  height_weight: '',
  education: '',
  profession_hobbies: '',
  marital_status: '',
  family_info: '',
  nationality_languages: '',
  religion: '',
  germany_status: '',
  self_description: '',
  partner_expectations: '',
  contact_info: '',
  tariff: '',
};

type AnketaDraftState = {
  form: FormShape;
  step: number;
  /** null = not submitted yet; otherwise the cached server status. Lets the
   *  page show the success screen instantly on revisit, without a loading flash. */
  submittedStatus: Status | null;
  setField: <K extends keyof FormShape>(key: K, value: FormShape[K]) => void;
  setForm: (form: FormShape) => void;
  setStep: (step: number) => void;
  setSubmittedStatus: (status: Status | null) => void;
  reset: () => void;
};

/**
 * Persisted anketa state: the in-progress draft (so a reload never loses typed
 * input) plus a cache of the submitted status + data, so a returning user who
 * already submitted sees the success screen immediately instead of loading.
 */
export const useAnketaDraft = create<AnketaDraftState>()(
  persist(
    (set) => ({
      form: EMPTY_FORM,
      step: 1,
      submittedStatus: null,
      setField: (key, value) => set((state) => ({ form: { ...state.form, [key]: value } })),
      setForm: (form) => set({ form }),
      setStep: (step) => set({ step }),
      setSubmittedStatus: (submittedStatus) => set({ submittedStatus }),
      reset: () => set({ form: EMPTY_FORM, step: 1 }),
    }),
    {
      name: 'baxtiyor-anketa-draft',
      version: 2,
      // v1 → v2 added `gender`; backfill any keys a stored draft is missing
      // so every form field stays a controlled (defined) value.
      migrate: (persisted) => {
        const p = (persisted ?? {}) as { form?: Partial<FormShape> };
        return { ...p, form: { ...EMPTY_FORM, ...(p.form ?? {}) } };
      },
      partialize: (state) => ({
        form: state.form,
        step: state.step,
        submittedStatus: state.submittedStatus,
      }),
    },
  ),
);
