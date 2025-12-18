import { createContext, useCallback, useContext, useMemo } from 'react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

const ConfirmContext = createContext({ confirm: async () => false });

export function ConfirmProvider({ children }) {
  const confirm = useCallback(async ({ title = 'Konfirmasi', message = 'Apakah Anda yakin?', confirmText = 'Ya', cancelText = 'Batal', variant = 'warning' } = {}) => {
    const icon = variant === 'danger' ? 'warning' : variant === 'warning' ? 'warning' : 'question';
    const res = await Swal.fire({
      title,
      text: message,
      icon,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      reverseButtons: true,
      focusCancel: true,
    });
    return Boolean(res.isConfirmed);
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>{children}</ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  return useContext(ConfirmContext);
}
