import React, { useEffect, useState } from 'react';

const DEFAULT_FALLBACK = '/brand/raloa-logo-primary.svg';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

/** Keeps remote or user-supplied media from leaving broken-image chrome in the UI. */
export const SafeImage: React.FC<SafeImageProps> = ({ src, fallbackSrc = DEFAULT_FALLBACK, onError, ...props }) => {
  const [resolvedSrc, setResolvedSrc] = useState(src || fallbackSrc);

  useEffect(() => {
    setResolvedSrc(src || fallbackSrc);
  }, [src, fallbackSrc]);

  return (
    <img
      {...props}
      src={resolvedSrc}
      onError={(event) => {
        if (resolvedSrc !== fallbackSrc) setResolvedSrc(fallbackSrc);
        onError?.(event);
      }}
    />
  );
};
