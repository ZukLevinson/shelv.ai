import React from 'react';
import { MashaRegistryTable } from '../components/MashaRegistryTable';

interface MashaRegistryPageProps {
  mashaList: any[];
  onRefresh: () => void;
}

export const MashaRegistryPage: React.FC<MashaRegistryPageProps> = ({
  mashaList,
  onRefresh,
}) => {
  return (
    <MashaRegistryTable
      mashaList={mashaList}
      onRefresh={onRefresh}
    />
  );
};

export default MashaRegistryPage;
