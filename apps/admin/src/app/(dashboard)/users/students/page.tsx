import { UsersDirectoryPage } from '@/features/users/components/users-directory-page';

export const metadata = { title: 'Students' };

export default function StudentsPage() {
  return (
    <UsersDirectoryPage
      title="Students"
      description="Every registered student account — searchable, filterable, real-time."
      lockedRole="student"
    />
  );
}
