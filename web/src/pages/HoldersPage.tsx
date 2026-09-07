import React from 'react';
import type { InventoryHolder, Room } from '../types';
import { HoldersManagement } from '../components/HoldersManagement';

interface HoldersPageProps {
  holders: InventoryHolder[];
  rooms: Room[];
  onRefresh: () => void;
  onOpenRoomModal: () => void;
}

export const HoldersPage: React.FC<HoldersPageProps> = ({
  holders,
  rooms,
  onRefresh,
  onOpenRoomModal,
}) => {
  return (
    <HoldersManagement
      holders={holders}
      rooms={rooms}
      onRefresh={onRefresh}
      onOpenRoomModal={onOpenRoomModal}
    />
  );
};

export default HoldersPage;
