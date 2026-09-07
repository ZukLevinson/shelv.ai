import { Routes, Route, Navigate } from 'react-router-dom';
import type { Room, OfficialItem, AnomalyReport, InventoryHolder, OnlineScannerInfo, User } from '../types';
import { OverviewPage } from '../pages/OverviewPage';
import { ScansPage } from '../pages/ScansPage';
import { HoldersPage } from '../pages/HoldersPage';
import { MashaRegistryPage } from '../pages/MashaRegistryPage';
import { ItemsPage } from '../pages/ItemsPage';
import { UsersPage } from '../pages/UsersPage';

export interface AppRoutesProps {
  user: User | null;
  displayRooms: Room[];
  displayItems: OfficialItem[];
  displayAnomalies: AnomalyReport | null;
  holders: InventoryHolder[];
  mashaList: any[];
  onlineScannersCount: number;
  onlineScanners: OnlineScannerInfo[];
  myInventoryOnly: boolean;
  onManageRooms: () => void;
  onRefresh: () => void;
}

export function AppRoutes({
  user,
  displayRooms,
  displayItems,
  displayAnomalies,
  holders,
  mashaList,
  onlineScannersCount,
  onlineScanners,
  myInventoryOnly,
  onManageRooms,
  onRefresh,
}: AppRoutesProps) {
  const displayHolders = myInventoryOnly && user?.holder_id
    ? holders.filter((h) => h.id === user.holder_id)
    : holders;

  const filterHolderId = myInventoryOnly && user?.holder_id ? user.holder_id : undefined;
  const filterHolderName = myInventoryOnly && user?.holder_name ? user.holder_name : undefined;

  return (
    <Routes>
      <Route
        path="/"
        element={
          <OverviewPage
            rooms={displayRooms}
            anomalies={displayAnomalies}
            onlineScannersCount={onlineScannersCount}
            onlineScanners={onlineScanners}
            onManageRooms={onManageRooms}
            onRefresh={onRefresh}
            filterHolderId={filterHolderId}
            filterHolderName={filterHolderName}
          />
        }
      />
      <Route path="/overview" element={<Navigate to="/" replace />} />
      <Route
        path="/scans"
        element={
          <ScansPage
            rooms={displayRooms}
            onlineScannersCount={onlineScannersCount}
            onlineScanners={onlineScanners}
          />
        }
      />
      <Route
        path="/holders"
        element={
          <HoldersPage
            holders={displayHolders}
            rooms={displayRooms}
            onRefresh={onRefresh}
            onOpenRoomModal={onManageRooms}
          />
        }
      />
      <Route
        path="/masha-registry"
        element={
          <MashaRegistryPage
            mashaList={mashaList}
            onRefresh={onRefresh}
          />
        }
      />
      <Route path="/masha" element={<Navigate to="/masha-registry" replace />} />
      <Route
        path="/items"
        element={<ItemsPage items={displayItems} />}
      />
      <Route path="/catalog" element={<Navigate to="/items" replace />} />
      <Route
        path="/users"
        element={
          <UsersPage
            holders={holders}
            onRefreshHolders={onRefresh}
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
