/** Row shape from `public.users` (extend as your schema grows). */
export type PublicUser = {
  id: string;
  name?: string | null;
  phone?: string | null;
  role?: string | null;
  verification_status?: string | null;
  [key: string]: unknown;
};
