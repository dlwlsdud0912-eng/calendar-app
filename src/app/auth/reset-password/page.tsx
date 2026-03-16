'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ResetPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    // reset-password는 forgot-password 흐름 내에서 처리됨
    router.replace('/auth/forgot-password');
  }, [router]);

  return null;
}
