import { UsersDirectoryPage } from '@/features/users/components/users-directory-page';
import { STAFF_ROLES } from '@/lib/user-role';

export const metadata = { title: 'Staff' };

export default function StaffPage() {
  return (
    <UsersDirectoryPage
      title="Staff"
      description="Kitchen staff, admins, and super admins — roles and account status."
      roleOptions={STAFF_ROLES}
    />
  );
}
