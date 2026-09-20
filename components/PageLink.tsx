import { useState, type ComponentProps } from 'react';
import { openLink } from '../lib/client';

/** Normal clicks reuse matching tabs; modified clicks retain standard browser behavior. */
export function PageLink({
  href,
  children,
  onClick,
  ...props
}: ComponentProps<'a'> & { href: string }) {
  const [error, setError] = useState('');
  return (
    <>
      <a
        {...props}
        href={href}
        onClick={(event) => {
          onClick?.(event);
          if (
            event.defaultPrevented ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          )
            return;
          event.preventDefault();
          void openLink(href)
            .then(() => setError(''))
            .catch(() => setError('Could not open this page. Please try again.'));
        }}
      >
        {children}
      </a>
      {error && (
        <span role="alert" className="form-error">
          {error}
        </span>
      )}
    </>
  );
}
