import { ExcelUploadModal } from '../ExcelUploadModal';
import { RoomManagementModal } from '../RoomManagementModal';
import { UndoToast, type UndoToastData } from '../UndoToast';
import { ActionHistoryModal } from '../ActionHistoryModal';
import { OnboardingModal } from '../OnboardingModal';
import { EditPersonalNumberModal } from '../EditPersonalNumberModal';
import type { Room } from '../../types';

export interface AppModalsProps {
  isManager: boolean;
  needsOnboarding: boolean;
  rooms: Room[];
  isUploadModalOpen: boolean;
  onCloseUploadModal: () => void;
  isRoomModalOpen: boolean;
  onCloseRoomModal: () => void;
  isActionHistoryOpen: boolean;
  onCloseActionHistory: () => void;
  isEditPNModalOpen: boolean;
  onCloseEditPNModal: () => void;
  undoToast: UndoToastData | null;
  onCloseUndoToast: () => void;
  onRefreshData: () => void;
}

export function AppModals({
  isManager,
  needsOnboarding,
  rooms,
  isUploadModalOpen,
  onCloseUploadModal,
  isRoomModalOpen,
  onCloseRoomModal,
  isActionHistoryOpen,
  onCloseActionHistory,
  isEditPNModalOpen,
  onCloseEditPNModal,
  undoToast,
  onCloseUndoToast,
  onRefreshData,
}: AppModalsProps) {
  return (
    <>
      {/* Excel Upload Modal */}
      {isManager && (
        <ExcelUploadModal
          isOpen={isUploadModalOpen}
          onClose={onCloseUploadModal}
          onSuccess={() => {
            onCloseUploadModal();
            onRefreshData();
          }}
        />
      )}

      {/* Room Management Modal */}
      <RoomManagementModal
        isOpen={isRoomModalOpen}
        onClose={onCloseRoomModal}
        onSuccess={onRefreshData}
        rooms={rooms}
      />

      {/* Instant Undo Toast Notification */}
      <UndoToast
        toast={undoToast}
        onClose={onCloseUndoToast}
        onReverted={onRefreshData}
      />

      {/* Universal Action History & Undo Modal */}
      <ActionHistoryModal
        isOpen={isActionHistoryOpen}
        onClose={onCloseActionHistory}
        onActionReverted={onRefreshData}
      />

      {/* Onboarding Modal for First Login / Role & מ"א Setup */}
      <OnboardingModal isOpen={needsOnboarding} />

      {/* Edit Personal Number (מ"א) Modal */}
      <EditPersonalNumberModal
        isOpen={isEditPNModalOpen}
        onClose={onCloseEditPNModal}
        onSuccess={onRefreshData}
      />
    </>
  );
}
