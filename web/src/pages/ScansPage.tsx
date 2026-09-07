import React from 'react';
import type { Room, OnlineScannerInfo } from '../types';
import { ScanManagement } from '../components/ScanManagement';

interface ScansPageProps {
  rooms: Room[];
  onlineScannersCount: number;
  onlineScanners: OnlineScannerInfo[];
}

export const ScansPage: React.FC<ScansPageProps> = ({
  rooms,
  onlineScannersCount,
  onlineScanners,
}) => {
  return (
    <ScanManagement
      rooms={rooms}
      onlineScannersCount={onlineScannersCount}
      onlineScanners={onlineScanners}
    />
  );
};

export default ScansPage;
