import React from 'react';

interface LoadingHandlerProps {
  children: React.ReactNode;
  isLoading: boolean;
}

export const LoadingHandler: React.FC<LoadingHandlerProps> = ({
  children,
  isLoading,
}) => {
  return (
    <div className="relative h-fit">
      {isLoading && (
        <div className="absolute inset-0 bg-white opacity-10 flex items-center justify-center z-10">
          Loading...
        </div>
      )}
      {children}
    </div>
  );
};
