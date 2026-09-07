import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getPageMeta } from '../utils/navigation';
import type { PageMeta } from '../types/navigation';

export const usePageTitle = (): PageMeta => {
  const location = useLocation();
  const pageMeta = useMemo(() => getPageMeta(location.pathname), [location.pathname]);

  useEffect(() => {
    document.title = `${pageMeta.title} | shelv.ai`;
  }, [pageMeta.title]);

  return pageMeta;
};
