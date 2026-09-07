import React from 'react';
import { Navigate } from 'react-router-dom';
import type { InventoryHolder } from '../types';
import { UserManagement } from '../components/UserManagement';
import { useAuth } from '../context/AuthContext';

interface UsersPageProps {
  holders: InventoryHolder[];
  onRefreshHolders: () => void;
}

export const UsersPage: React.FC<UsersPageProps> = ({
  holders,
  onRefreshHolders,
}) => {
  const { isManager } = useAuth();

  if (!isManager) {
    return <Navigate to="/" replace />;
  }

  return (
    <UserManagement
      holders={holders}
      onRefreshHolders={onRefreshHolders}
    />
  );
};

export default UsersPage;
