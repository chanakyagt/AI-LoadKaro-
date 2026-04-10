/** Row shape from `public.users` for admin tables (extend as schema grows). */
export type UserRow = {
  id: string;
  name: string | null;
  phone: string | null;
  role: string | null;
  verification_status: string | null;
  subscription: string | null;
  created_at: string | null;
};

export {
  USER_ROLE_OPTIONS as ROLE_OPTIONS,
  USER_VERIFICATION_STATUS_OPTIONS as VERIFICATION_OPTIONS,
} from "@/lib/schema/enums";
