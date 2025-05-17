
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
