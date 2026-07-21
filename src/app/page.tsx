import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from '@/lib/auth';

export default async function RootPage() {
  const cookieStore = await cookies();
  const authed = cookieStore.get(AUTH_COOKIE_NAME);
  if (authed?.value === '1') {
    redirect('/dashboard');
  }
  redirect('/login');
}
