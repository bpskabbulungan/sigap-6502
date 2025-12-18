import { createContext, useCallback, useContext, useMemo } from 'react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

const ToastContext = createContext({ add: () => {} });

export function ToastProvider({ children }) {
  const add = useCallback((message, { type = 'info', duration = 3000 } = {}) => {
    const icon = type === 'error' ? 'error' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'info';
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title: message,
      showConfirmButton: false,
      timer: Math.max(1000, duration || 3000),
      timerProgressBar: true,
    });
  }, []);

  const value = useMemo(() => ({ add }), [add]);

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext);
}
