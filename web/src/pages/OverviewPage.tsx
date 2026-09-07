import React from 'react';
import type { Room, AnomalyReport, OnlineScannerInfo } from '../types';
import { RoomGrid } from '../components/RoomGrid';
import { LiveFeed } from '../components/LiveFeed';
import { AnomaliesCenter } from '../components/AnomaliesCenter';

interface OverviewPageProps {
  rooms: Room[];
  anomalies: AnomalyReport | null;
  onlineScannersCount: number;
  onlineScanners: OnlineScannerInfo[];
  onManageRooms: () => void;
  onRefresh: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  rooms,
  anomalies,
  onlineScannersCount,
  onlineScanners,
  onManageRooms,
  onRefresh,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RoomGrid rooms={rooms} onManageRooms={onManageRooms} />
        </div>
        <div>
          <LiveFeed onlineScannersCount={onlineScannersCount} onlineScanners={onlineScanners} />
        </div>
      </div>

      <AnomaliesCenter anomalies={anomalies} onRefresh={onRefresh} />
    </div>
  );
};

export default OverviewPage;
