"use client";

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function usePageLoading() {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsLoading(false);
  }, [pathname]);

  const startLoading = () => {
    setIsLoading(true);
  };

  return { isLoading, startLoading };
}