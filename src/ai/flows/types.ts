
import {z} from 'zod';

export const EducationLevels = z.enum([
  'Preschool',
  'ElementarySchool', // K-5
  'MiddleSchool', // 6-8
  'HighSchool', // 9-12
  'College', // Undergraduate
  'Graduate', // Master's level
  'Masters', // Alias for Graduate, or specific Master's
  'PhD' // Doctoral level
]).describe('The education level of the user.');
export type EducationLevel = z.infer<typeof EducationLevels>;

export const SupportedLanguages = z.enum([
  "English",
  "Spanish",
  "French",
  "German",
  "Chinese (Simplified)",
  "Japanese",
  "Korean",
  "Arabic",
  "Hindi",
  "Swahili",
  "Portuguese"
]).describe('Supported languages for the quiz content.');
export type SupportedLanguage = z.infer<typeof SupportedLanguages>;
