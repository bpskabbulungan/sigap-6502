import clsx from 'clsx';

// CSS-based loader (no SVG). Uses borders and spin animation.
export function Spinner({ size = 'md', className, ...props }) {
  const dimension = size === 'xs' ? 'h-3 w-3' : size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : size === 'xl' ? 'h-10 w-10' : 'h-6 w-6';
  return (
    <span
      className={clsx(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent text-primary',
        dimension,
        className
      )}
      aria-label="Loading"
      role="status"
      {...props}
    />
  );
}
