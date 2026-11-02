import type { ClientFormType, FormAnswers, FormLocale, SignerRole } from '@/types/api';

/**
 * THE LOUNGE'S CLINICAL FORMS
 * ---------------------------
 * Both paper forms — the health form and the session record — written down
 * once as data. The editor, the read-only view, the printout and the health
 * alerts on a client's page are all drawn from these definitions, so a
 * question is reworded, added or translated here and nowhere else.
 *
 * Question keys are the contract with the server: they must match the answer
 * schemas in `backend/src/validators/clientForm.validators.ts`, and every
 * `requiredToSign` here mirrors `REQUIRED_TO_SIGN` there.
 *
 * The Arabic is the lounge's own wording, reproduced as written. Choices are
 * stored as codes (`YES`, `LATEX`), so a form filled in one language reads
 * correctly in the other; only free text stays in the language it was typed.
 */

export type Localized = Record<FormLocale, string>;

export interface Option {
  value: string;
  label: Localized;
}

/** Shows a question or section only while another answer is (or is not) one of these. */
export interface Condition {
  field: string;
  in?: string[];
  notIn?: string[];
}

interface FieldBase {
  key: string;
  label: Localized;
  hint?: Localized;
  /** Must be answered before signing — but only while the question is shown. */
  requiredToSign?: boolean;
  showWhen?: Condition;
}

export type FieldDef =
  | (FieldBase & {
      kind: 'text' | 'tel' | 'date';
      /** Offers the lounge's treatments as suggestions while still accepting anything. */
      suggest?: 'services';
    })
  | (FieldBase & { kind: 'textarea' })
  | (FieldBase & { kind: 'choice' | 'multi'; options: Option[] });

export interface SectionDef {
  key: string;
  title: Localized;
  intro?: Localized;
  /** A standing note printed at the end of the section. */
  note?: Localized;
  showWhen?: Condition;
  fields: FieldDef[];
}

export interface FormDef {
  type: ClientFormType;
  /** The URL segment: `/admin/clients/:id/forms/new/<slug>`. */
  slug: 'health' | 'session';
  title: Localized;
  subtitle: Localized;
  /** The file details printed under the title. */
  header: FieldDef[];
  sections: SectionDef[];
  /** What the signer confirms by signing. */
  declaration?: Localized;
  signatureLabel: Localized;
  signerRoles: SignerRole[];
  disclaimer?: Localized;
}

// --- Shared choices -----------------------------------------------------------

const YES: Option = { value: 'YES', label: { en: 'Yes', ar: 'نعم' } };
const NO: Option = { value: 'NO', label: { en: 'No', ar: 'لا' } };
const UNKNOWN: Option = { value: 'UNKNOWN', label: { en: 'Unknown', ar: 'غير معروف' } };
const NOT_APPLICABLE: Option = { value: 'NA', label: { en: 'Not applicable', ar: 'لا ينطبق' } };

const YES_NO = [YES, NO];
const YES_NO_UNKNOWN = [YES, NO, UNKNOWN];
const YES_NO_NA = [YES, NO, NOT_APPLICABLE];

const FILE_NUMBER: FieldDef = {
  key: 'fileNumber',
  kind: 'text',
  label: { en: 'File number', ar: 'رقم الملف' },
};

// --- Form 1: health form ------------------------------------------------------

const hasAllergy: Condition = { field: 'hasKnownAllergy', in: ['YES'] };

export const HEALTH_INTAKE_FORM: FormDef = {
  type: 'HEALTH_INTAKE',
  slug: 'health',
  title: {
    en: 'Client information and health history',
    ar: 'استمارة معلومات المريض والتاريخ الصحي',
  },
  subtitle: {
    en: 'Confidential file for professional use • Completed before the session and updated at every visit.',
    ar: 'ملف سري للاستخدام المهني • يُعبّأ قبل الجلسة وتُحدّث المعلومات عند كل زيارة.',
  },
  header: [
    FILE_NUMBER,
    { key: 'fileOpenedAt', kind: 'date', label: { en: 'File opened on', ar: 'تاريخ فتح الملف' } },
  ],
  sections: [
    {
      key: 'personal',
      title: { en: 'Personal information', ar: 'المعلومات الشخصية' },
      fields: [
        {
          key: 'fullName',
          kind: 'text',
          label: { en: 'Full name', ar: 'الاسم الكامل' },
          requiredToSign: true,
        },
        { key: 'dateOfBirth', kind: 'date', label: { en: 'Date of birth', ar: 'تاريخ الميلاد' } },
        { key: 'phone', kind: 'tel', label: { en: 'Phone', ar: 'الهاتف' } },
        {
          key: 'emergencyContact',
          kind: 'text',
          label: {
            en: 'Emergency contact and phone number',
            ar: 'جهة اتصال للطوارئ ورقم الهاتف',
          },
        },
      ],
    },
    {
      key: 'allergies',
      title: { en: 'Allergies and previous reactions', ar: 'الحساسية وردود الفعل السابقة' },
      fields: [
        {
          key: 'hasKnownAllergy',
          kind: 'choice',
          label: { en: 'Do you have any known allergies?', ar: 'هل لديك حساسية معروفة؟' },
          options: YES_NO_UNKNOWN,
          requiredToSign: true,
        },
        {
          key: 'allergySources',
          kind: 'multi',
          label: { en: 'Source', ar: 'المصدر' },
          showWhen: hasAllergy,
          options: [
            { value: 'MEDICATION', label: { en: 'Medication', ar: 'دواء' } },
            { value: 'LOCAL_ANAESTHETIC', label: { en: 'Local anaesthetic', ar: 'مخدّر موضعي' } },
            { value: 'LATEX', label: { en: 'Latex', ar: 'لاتكس' } },
            { value: 'ANTISEPTIC', label: { en: 'Antiseptic', ar: 'مطهّر' } },
            { value: 'COSMETIC', label: { en: 'Cosmetic product', ar: 'مستحضر' } },
            { value: 'FOOD', label: { en: 'Food', ar: 'طعام' } },
            { value: 'OTHER', label: { en: 'Other', ar: 'غيره' } },
          ],
        },
        {
          key: 'allergen',
          kind: 'text',
          label: {
            en: 'Substance or product that causes the allergy',
            ar: 'اسم المادة أو المنتج المسبب للحساسية',
          },
          showWhen: hasAllergy,
          requiredToSign: true,
        },
        {
          key: 'allergyReaction',
          kind: 'textarea',
          label: {
            en: 'Symptoms and how severe they were, when it happened, and the treatment received',
            ar: 'الأعراض وشدّتها وتاريخ حدوثها والعلاج الذي تلقيته',
          },
          showWhen: hasAllergy,
        },
        {
          key: 'severeReaction',
          kind: 'choice',
          label: {
            en: 'Have you ever had a severe allergic reaction, difficulty breathing or swelling after a product or procedure?',
            ar: 'هل سبق حصول تحسس شديد أو صعوبة تنفّس أو تورّم بعد منتج أو إجراء؟',
          },
          options: YES_NO_UNKNOWN,
          requiredToSign: true,
        },
        {
          key: 'severeReactionDetails',
          kind: 'textarea',
          label: { en: 'Details', ar: 'التفاصيل' },
          showWhen: { field: 'severeReaction', in: ['YES'] },
          requiredToSign: true,
        },
      ],
    },
    {
      key: 'health',
      title: { en: 'Medical history and medications', ar: 'التاريخ الصحي والأدوية' },
      intro: {
        en: 'Tick everything that applies, and give the details below.',
        ar: 'ضعي علامة بجانب ما ينطبق، واكتبي التفاصيل أدناه.',
      },
      fields: [
        {
          key: 'conditions',
          kind: 'multi',
          label: { en: 'Conditions', ar: 'الحالات الصحية' },
          options: [
            { value: 'DIABETES', label: { en: 'Diabetes', ar: 'سكري' } },
            { value: 'BLEEDING_DISORDER', label: { en: 'Bleeding disorder', ar: 'اضطراب نزف' } },
            { value: 'AUTOIMMUNE', label: { en: 'Autoimmune disease', ar: 'مرض مناعي' } },
            { value: 'IMMUNOCOMPROMISED', label: { en: 'Weakened immunity', ar: 'ضعف مناعة' } },
            { value: 'OTHER_CHRONIC', label: { en: 'Other chronic illness', ar: 'أمراض مزمنة أخرى' } },
            { value: 'HERPES', label: { en: 'Cold sores or herpes', ar: 'قروح برد أو هربس' } },
            { value: 'KELOID', label: { en: 'Raised (keloid) scars', ar: 'ندبات بارزة' } },
            { value: 'DELAYED_HEALING', label: { en: 'Slow healing', ar: 'تأخّر التئام' } },
            {
              value: 'INFECTION_AT_SITE',
              label: {
                en: 'Infection or wound in the treatment area',
                ar: 'التهاب أو جرح في منطقة العلاج',
              },
            },
          ],
        },
        {
          key: 'pregnant',
          kind: 'choice',
          label: { en: 'Pregnant or possibly pregnant', ar: 'حمل أو احتمال حمل' },
          options: YES_NO_NA,
          requiredToSign: true,
        },
        {
          key: 'breastfeeding',
          kind: 'choice',
          label: { en: 'Breastfeeding', ar: 'رضاعة' },
          options: YES_NO_NA,
          requiredToSign: true,
        },
        {
          key: 'medicalHistory',
          kind: 'textarea',
          label: {
            en: 'Diagnoses, previous operations and any other health problem',
            ar: 'التشخيصات والعمليات السابقة وأي مشكلة صحية أخرى',
          },
        },
        {
          key: 'medications',
          kind: 'textarea',
          label: {
            en: 'Current medications and supplements with their dose — including blood thinners and isotretinoin',
            ar: 'الأدوية والمكمّلات الحالية مع الجرعة، ومنها مميّعات الدم والإيزوتريتينوين',
          },
        },
      ],
    },
    {
      key: 'products',
      title: { en: 'Products and previous treatments', ar: 'المنتجات والإجراءات السابقة' },
      fields: [
        {
          key: 'homeProducts',
          kind: 'textarea',
          label: {
            en: 'Products used at home, by name or brand — including creams, acids and retinol',
            ar: 'منتجات المنزل وأسماؤها أو علاماتها التجارية، ومنها الكريمات والأحماض والريتينول',
          },
        },
        {
          key: 'productUsage',
          kind: 'textarea',
          label: {
            en: 'How they are used, when last used, and any irritation they caused',
            ar: 'طريقة الاستعمال وتاريخ آخر استخدام وأي تهيّج سبّبته',
          },
        },
        {
          key: 'previousProcedures',
          kind: 'textarea',
          label: {
            en: 'Previous cosmetic treatments — substance used, area, date and any complications',
            ar: 'إجراءات تجميل سابقة ونوع المادة والمنطقة والتاريخ وأي مضاعفات',
          },
        },
      ],
    },
  ],
  declaration: {
    en: 'I confirm that the information above is correct to the best of my knowledge, and I will tell my provider about any change.',
    ar: 'أقرّ بأن المعلومات أعلاه صحيحة حسب علمي، وألتزم بإبلاغ مقدم الخدمة بأي تغيير.',
  },
  signatureLabel: { en: 'Signature of client or guardian', ar: 'توقيع المريض أو ولي الأمر' },
  signerRoles: ['CLIENT', 'GUARDIAN'],
};

// --- Form 2: session record ---------------------------------------------------

/** The treatment sections only apply once the decision is to go ahead. */
const notPostponed: Condition = { field: 'decision', notIn: ['POSTPONE', 'REFER'] };

export const SESSION_RECORD_FORM: FormDef = {
  type: 'SESSION_RECORD',
  slug: 'session',
  title: { en: 'Session and follow-up record', ar: 'سجل الجلسة والمتابعة' },
  subtitle: {
    en: 'A new record for every session, kept with the health form.',
    ar: 'تُستخدم نسخة جديدة لكل جلسة، وتُحفظ مع استمارة المعلومات الصحية.',
  },
  header: [
    FILE_NUMBER,
    {
      key: 'sessionDate',
      kind: 'date',
      label: { en: 'Session date', ar: 'تاريخ الجلسة' },
      requiredToSign: true,
    },
    {
      key: 'providerName',
      kind: 'text',
      label: { en: 'Provider name', ar: 'اسم مقدم الخدمة' },
      requiredToSign: true,
    },
  ],
  sections: [
    {
      key: 'request',
      title: {
        en: 'Requested treatment and chosen product, before the session',
        ar: 'الإجراء المطلوب والمنتج المختار قبل الجلسة',
      },
      fields: [
        {
          key: 'chiefComplaint',
          kind: 'textarea',
          label: {
            en: 'Main concern and the result the client wants',
            ar: 'الشكوى الأساسية والنتيجة التي يرغب بها المريض',
          },
        },
        {
          key: 'requestedProcedure',
          kind: 'text',
          suggest: 'services',
          label: {
            en: 'Treatment the client would like',
            ar: 'اسم الإجراء الذي يرغب المريض بإجرائه',
          },
        },
        {
          key: 'treatmentArea',
          kind: 'text',
          label: { en: 'Area to be treated', ar: 'المنطقة المطلوب علاجها' },
        },
        {
          key: 'proposedProduct',
          kind: 'text',
          label: { en: 'Product proposed for use', ar: 'اسم البرودكت المقترح استخدامه' },
        },
        {
          key: 'proposedProductDetails',
          kind: 'text',
          label: {
            en: 'Product type or substance, brand and manufacturer',
            ar: 'نوع البرودكت أو المادة والماركة والشركة المصنّعة',
          },
        },
        {
          key: 'historyReviewed',
          kind: 'choice',
          label: {
            en: 'Allergies, medications and health history reviewed',
            ar: 'تمت مراجعة الحساسية والأدوية والتاريخ الصحي',
          },
          options: YES_NO,
          requiredToSign: true,
        },
        {
          key: 'changesSinceLastVisit',
          kind: 'textarea',
          label: {
            en: 'Any change in health or medication since the last visit',
            ar: 'أي تغيير صحي أو دوائي منذ الزيارة السابقة',
          },
        },
        {
          key: 'preAssessment',
          kind: 'textarea',
          label: {
            en: 'Assessment of the area and notes before the treatment',
            ar: 'تقييم المنطقة والملاحظات قبل الإجراء',
          },
        },
        {
          key: 'decision',
          kind: 'choice',
          label: { en: 'Decision after assessment', ar: 'القرار بعد التقييم' },
          options: [
            { value: 'PROCEED', label: { en: 'Go ahead with the session', ar: 'إجراء الجلسة' } },
            { value: 'POSTPONE', label: { en: 'Postpone', ar: 'تأجيل' } },
            { value: 'REFER', label: { en: 'Refer for medical assessment', ar: 'إحالة لتقييم طبي' } },
          ],
          requiredToSign: true,
        },
        {
          key: 'decisionReason',
          kind: 'textarea',
          label: {
            en: 'Reason for postponing or referring',
            ar: 'سبب التأجيل أو الإحالة عند الحاجة',
          },
          showWhen: { field: 'decision', in: ['POSTPONE', 'REFER'] },
          requiredToSign: true,
        },
      ],
    },
    {
      key: 'treatment',
      title: { en: 'Treatment and products used', ar: 'توثيق الإجراء والمنتجات' },
      showWhen: notPostponed,
      fields: [
        {
          key: 'performedProcedure',
          kind: 'textarea',
          label: {
            en: 'Treatment performed and area treated',
            ar: 'الإجراء المنفّذ والمنطقة المعالجة',
          },
        },
        {
          key: 'productUsed',
          kind: 'text',
          label: {
            en: 'Product actually used — name, brand and manufacturer',
            ar: 'اسم البرودكت المستخدم فعلياً والماركة والشركة المصنّعة',
          },
        },
        {
          key: 'productConcentration',
          kind: 'text',
          label: {
            en: 'Product type or substance, and its concentration',
            ar: 'نوع البرودكت أو المادة وتركيزها',
          },
        },
        {
          key: 'quantity',
          kind: 'text',
          label: { en: 'Amount used, with its unit', ar: 'الكمية المستخدمة ووحدة القياس' },
        },
        { key: 'batchNumber', kind: 'text', label: { en: 'Batch number', ar: 'رقم التشغيلة' } },
        { key: 'expiryDate', kind: 'date', label: { en: 'Expiry date', ar: 'تاريخ انتهاء الصلاحية' } },
        {
          key: 'anaesthetic',
          kind: 'text',
          label: {
            en: 'Anaesthetic or supporting products used',
            ar: 'المخدّر أو المنتجات المساعدة المستخدمة',
          },
        },
        {
          key: 'device',
          kind: 'text',
          label: {
            en: 'Device used and its settings',
            ar: 'اسم الجهاز والإعدادات عند استخدامه',
          },
        },
        {
          key: 'procedureNotes',
          kind: 'textarea',
          label: {
            en: 'Treatment details, notes and any reaction during the session',
            ar: 'تفاصيل الإجراء والملاحظات أو أي تفاعل أثناء الجلسة',
          },
        },
        {
          key: 'additionalProducts',
          kind: 'textarea',
          label: {
            en: 'Product label details, or any additional products',
            ar: 'بيانات ملصق المنتج أو بيانات منتجات إضافية',
          },
          hint: {
            en: 'A photo of the product label can be uploaded under the client’s Files.',
            ar: 'يمكن تصوير ملصق المنتج ورفع الصورة في قسم الملفات.',
          },
        },
      ],
    },
    {
      key: 'consent',
      title: { en: 'Consent and documentation', ar: 'الموافقة والتوثيق' },
      showWhen: notPostponed,
      note: {
        en: 'Using photographs for publication or marketing needs separate, explicit consent.',
        ar: 'استخدام الصور للنشر أو التسويق يحتاج موافقة منفصلة وصريحة.',
      },
      fields: [
        {
          key: 'procedureConsent',
          kind: 'choice',
          label: {
            en: 'Consent for this treatment, after explaining its risks and alternatives',
            ar: 'الموافقة الخاصة بالإجراء بعد شرح مخاطره وبدائله',
          },
          options: [
            { value: 'SIGNED', label: { en: 'Signed and attached', ar: 'موقّعة ومرفقة' } },
            { value: 'INCOMPLETE', label: { en: 'Not completed', ar: 'لم تُستكمل' } },
          ],
        },
        {
          key: 'photoConsent',
          kind: 'choice',
          label: {
            en: 'Consent to photographs for the clinical record',
            ar: 'موافقة التصوير للتوثيق الطبي',
          },
          options: [
            { value: 'AGREE', label: { en: 'Agrees', ar: 'موافق' } },
            { value: 'DECLINE', label: { en: 'Does not agree', ar: 'غير موافق' } },
            NOT_APPLICABLE,
          ],
        },
      ],
    },
    {
      key: 'aftercare',
      title: { en: 'After the session and follow-up', ar: 'بعد الجلسة والمتابعة' },
      showWhen: notPostponed,
      fields: [
        {
          key: 'postSessionCondition',
          kind: 'textarea',
          label: {
            en: 'Condition of the area after the session, and any notes or symptoms',
            ar: 'حالة المنطقة بعد الجلسة وأي ملاحظات أو أعراض',
          },
        },
        {
          key: 'aftercareExplained',
          kind: 'textarea',
          label: {
            en: 'Aftercare, warning signs and how to get in touch — as explained to the client',
            ar: 'تعليمات العناية وعلامات الإنذار وطريقة التواصل التي شُرحت للمريض',
          },
        },
        {
          key: 'writtenInstructions',
          kind: 'choice',
          label: { en: 'Written instructions given', ar: 'تعليمات مكتوبة سُلّمت' },
          options: YES_NO,
        },
        { key: 'followUpDate', kind: 'date', label: { en: 'Follow-up date', ar: 'موعد المتابعة' } },
        {
          key: 'followUpOutcome',
          kind: 'textarea',
          label: {
            en: 'Follow-up outcome and any action taken',
            ar: 'نتيجة المتابعة والإجراءات المتخذة عند الحاجة',
          },
        },
      ],
    },
  ],
  signatureLabel: { en: 'Provider signature', ar: 'توقيع مقدم الخدمة' },
  signerRoles: ['PROVIDER'],
  disclaimer: {
    en: 'This form gathers information and records the session. It does not replace a medical assessment or the consent specific to each treatment.',
    ar: 'هذه الاستمارة لجمع المعلومات والتوثيق، ولا تحل محل التقييم الطبي أو الموافقة الخاصة بكل إجراء.',
  },
};

export const FORMS: Record<ClientFormType, FormDef> = {
  HEALTH_INTAKE: HEALTH_INTAKE_FORM,
  SESSION_RECORD: SESSION_RECORD_FORM,
};

export const formBySlug = (slug: string | undefined): FormDef | undefined =>
  Object.values(FORMS).find((form) => form.slug === slug);

// --- Text around the questions ------------------------------------------------

export const FORM_UI = {
  en: {
    language: 'Language',
    clientName: 'Client name',
    linkedAppointment: 'Linked appointment',
    noAppointment: 'Not linked to an appointment',
    signedBy: 'Signed by',
    signerName: 'Name of the person signing',
    signerRole: { CLIENT: 'Client', GUARDIAN: 'Parent or guardian', PROVIDER: 'Provider' },
    signHint: 'Sign inside the box with a finger, stylus or mouse.',
    clearSignature: 'Clear',
    signaturePad: 'Signature pad',
    date: 'Date',
    saveDraft: 'Save draft',
    signAndSave: 'Sign and save',
    required: 'Required before signing',
    fixBeforeSigning: 'Please answer the highlighted questions before signing.',
    signatureMissing: 'Please sign inside the box.',
    signerNameMissing: 'Enter the name of the person signing.',
    notAnswered: '—',
    draft: 'Draft',
    signed: 'Signed',
    lockedNote: 'This form is signed and can no longer be changed.',
    confidential: 'NURELLA • CONFIDENTIAL',
  },
  ar: {
    language: 'اللغة',
    clientName: 'اسم المريض',
    linkedAppointment: 'الموعد المرتبط',
    noAppointment: 'غير مرتبط بموعد',
    signedBy: 'الموقّع',
    signerName: 'اسم الموقّع',
    signerRole: { CLIENT: 'المريض', GUARDIAN: 'ولي الأمر', PROVIDER: 'مقدم الخدمة' },
    signHint: 'يُرجى التوقيع داخل المربع بالإصبع أو القلم أو الفأرة.',
    clearSignature: 'مسح',
    signaturePad: 'لوحة التوقيع',
    date: 'التاريخ',
    saveDraft: 'حفظ كمسودة',
    signAndSave: 'التوقيع والحفظ',
    required: 'مطلوب قبل التوقيع',
    fixBeforeSigning: 'يُرجى الإجابة عن الأسئلة المحددة قبل التوقيع.',
    signatureMissing: 'يُرجى التوقيع داخل المربع.',
    signerNameMissing: 'يُرجى كتابة اسم الموقّع.',
    notAnswered: '—',
    draft: 'مسودة',
    signed: 'موقّعة',
    lockedNote: 'هذه الاستمارة موقّعة ولا يمكن تعديلها.',
    confidential: 'NURELLA • سري',
  },
} as const;

export const LOCALE_NAMES: Record<FormLocale, string> = { en: 'English', ar: 'العربية' };

export const directionOf = (locale: FormLocale): 'rtl' | 'ltr' => (locale === 'ar' ? 'rtl' : 'ltr');

// --- Working with answers -----------------------------------------------------

export function isShown(condition: Condition | undefined, answers: FormAnswers): boolean {
  if (!condition) return true;
  const value = answers[condition.field];
  const current = typeof value === 'string' ? value : '';
  if (condition.in && !condition.in.includes(current)) return false;
  if (condition.notIn && condition.notIn.includes(current)) return false;
  return true;
}

/** Every question currently on screen, header first, in form order. */
export function visibleFields(form: FormDef, answers: FormAnswers): FieldDef[] {
  return [
    ...form.header,
    ...form.sections
      .filter((section) => isShown(section.showWhen, answers))
      .flatMap((section) => section.fields),
  ].filter((field) => isShown(field.showWhen, answers));
}

const hasValue = (value: FormAnswers[string]) =>
  Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.trim().length > 0;

/**
 * What is sent to the server: answers to the questions on screen, trimmed,
 * with blanks left out. A question hidden by a later answer — the allergy
 * details after "No allergies" — is dropped rather than kept contradicting it.
 */
export function answersToSave(form: FormDef, answers: FormAnswers): FormAnswers {
  const saved: FormAnswers = {};
  for (const field of visibleFields(form, answers)) {
    const value = answers[field.key];
    if (!hasValue(value)) continue;
    saved[field.key] = typeof value === 'string' ? value.trim() : value;
  }
  return saved;
}

/** Keys of the required questions still unanswered, in form order. */
export function missingToSign(form: FormDef, answers: FormAnswers): string[] {
  return visibleFields(form, answers)
    .filter((field) => field.requiredToSign && !hasValue(answers[field.key]))
    .map((field) => field.key);
}

/** An answer as text in the given language — option labels for choices. */
export function answerText(field: FieldDef, value: FormAnswers[string], locale: FormLocale): string {
  if (!hasValue(value)) return '';
  if (field.kind === 'choice' || field.kind === 'multi') {
    const values = Array.isArray(value) ? value : [value as string];
    return values
      .map((code) => field.options.find((option) => option.value === code)?.label[locale] ?? code)
      .join(locale === 'ar' ? '، ' : ', ');
  }
  if (field.kind === 'date') return formatFormDate(value as string, locale);
  return value as string;
}

/**
 * A `YYYY-MM-DD` answer as a date in the given language. Parsed as a calendar
 * date, never an instant, so it cannot shift a day in another timezone. Latin
 * digits in Arabic too, matching what is typed into the form.
 */
export function formatFormDate(value: string, locale: FormLocale): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Today in the browser's own calendar, as `YYYY-MM-DD`. */
export function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// --- Health alerts ------------------------------------------------------------

export interface HealthAlert {
  key: string;
  label: string;
  detail?: string;
  /** Allergies and past severe reactions are the ones that stop a treatment. */
  severe: boolean;
}

/**
 * What a provider must not miss, drawn from a signed health form: allergies,
 * a history of severe reaction, pregnancy, breastfeeding and the conditions
 * that contraindicate treatment. Always in English — this is staff-facing
 * chrome, whatever language the client filled the form in.
 */
export function healthAlerts(answers: FormAnswers): HealthAlert[] {
  const fields = HEALTH_INTAKE_FORM.sections.flatMap((section) => section.fields);
  const field = (key: string) => fields.find((candidate) => candidate.key === key) as FieldDef;
  const text = (key: string) => answerText(field(key), answers[key], 'en');
  const alerts: HealthAlert[] = [];

  if (answers.hasKnownAllergy === 'YES') {
    alerts.push({
      key: 'allergy',
      label: 'Allergy',
      detail: [answers.allergen, text('allergySources')].filter(Boolean).join(' — '),
      severe: true,
    });
  }
  if (answers.severeReaction === 'YES') {
    alerts.push({
      key: 'severe',
      label: 'History of severe reaction',
      detail: typeof answers.severeReactionDetails === 'string' ? answers.severeReactionDetails : undefined,
      severe: true,
    });
  }
  if (answers.pregnant === 'YES') alerts.push({ key: 'pregnant', label: 'Pregnant or possibly pregnant', severe: false });
  if (answers.breastfeeding === 'YES') alerts.push({ key: 'breastfeeding', label: 'Breastfeeding', severe: false });

  const conditions = text('conditions');
  if (conditions) alerts.push({ key: 'conditions', label: 'Conditions', detail: conditions, severe: false });

  return alerts;
}
