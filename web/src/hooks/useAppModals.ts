import { useState, useCallback } from 'react';

export const useAppModals = () => {
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [isRoomModalOpen, setRoomModalOpen] = useState(false);
  const [isActionHistoryOpen, setActionHistoryOpen] = useState(false);
  const [isEditPNModalOpen, setIsEditPNModalOpen] = useState(false);

  const openUploadModal = useCallback(() => setUploadModalOpen(true), []);
  const closeUploadModal = useCallback(() => setUploadModalOpen(false), []);

  const openRoomModal = useCallback(() => setRoomModalOpen(true), []);
  const closeRoomModal = useCallback(() => setRoomModalOpen(false), []);

  const openActionHistory = useCallback(() => setActionHistoryOpen(true), []);
  const closeActionHistory = useCallback(() => setActionHistoryOpen(false), []);

  const openEditPNModal = useCallback(() => setIsEditPNModalOpen(true), []);
  const closeEditPNModal = useCallback(() => setIsEditPNModalOpen(false), []);

  return {
    isUploadModalOpen,
    setUploadModalOpen,
    openUploadModal,
    closeUploadModal,
    isRoomModalOpen,
    setRoomModalOpen,
    openRoomModal,
    closeRoomModal,
    isActionHistoryOpen,
    setActionHistoryOpen,
    openActionHistory,
    closeActionHistory,
    isEditPNModalOpen,
    setIsEditPNModalOpen,
    openEditPNModal,
    closeEditPNModal,
  };
};
